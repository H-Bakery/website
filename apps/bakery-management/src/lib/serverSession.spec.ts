/**
 * @jest-environment node
 */
import {
  CACHE_TTL_MS,
  createSessionVerifier,
  decideAccess,
  mayLoadCashTile,
  principalFromMe,
  readTokenExpiry,
  type SessionVerifier,
} from './serverSession'

/** Ein JWT-förmiges Token (Signatur egal - geprüft wird an der API). */
function fakeJwt(payload: Record<string, unknown>): string {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${part({ alg: 'HS256' })}.${part(payload)}.sig`
}

function meResponse(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('readTokenExpiry', () => {
  it('liest exp aus dem Payload', () => {
    expect(readTokenExpiry(fakeJwt({ exp: 1234 }))).toBe(1234)
  })
  it('null für Unsinn', () => {
    expect(readTokenExpiry('abc')).toBeNull()
    expect(readTokenExpiry('a.!!!.c')).toBeNull()
    expect(readTokenExpiry(fakeJwt({}))).toBeNull()
  })
})

describe('principalFromMe', () => {
  it('echte API: Rolle und Sitzungsart', () => {
    expect(
      principalFromMe({
        success: true,
        data: { role: 'verkauf', sessionKind: 'station' },
      })
    ).toEqual({ role: 'verkauf', sessionKind: 'station' })
  })
  it('Mock: admin = inhaber, ohne Sitzungsart persönlich', () => {
    expect(principalFromMe({ data: { role: 'admin' } })).toEqual({
      role: 'inhaber',
      sessionKind: 'personal',
    })
  })
  it('unbekannte Rolle oder kaputte Antwort: null', () => {
    expect(principalFromMe({ data: { role: 'gast' } })).toBeNull()
    expect(principalFromMe(null)).toBeNull()
    expect(principalFromMe('x')).toBeNull()
  })
})

describe('createSessionVerifier', () => {
  const NOW = 1_700_000_000_000
  const valid = () => fakeJwt({ exp: NOW / 1000 + 3600, n: Math.random() })

  function setup(response: () => Promise<Response> | Response) {
    let now = NOW
    const fetchImpl = jest.fn(async () => response())
    const verify = createSessionVerifier({
      apiUrl: 'http://api.test/',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => now,
    })
    return { verify, fetchImpl, advance: (ms: number) => (now += ms) }
  }

  it('fragt /api/auth/me mit Bearer-Token', async () => {
    const { verify, fetchImpl } = setup(() =>
      meResponse(200, { data: { role: 'inhaber', sessionKind: 'personal' } })
    )
    const token = valid()
    await expect(verify(token)).resolves.toEqual({
      role: 'inhaber',
      sessionKind: 'personal',
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api.test/api/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
      })
    )
  })

  it('ohne Token oder mit abgelaufenem exp: null, ohne API-Anfrage', async () => {
    const { verify, fetchImpl } = setup(() => meResponse(200))
    await expect(verify(null)).resolves.toBeNull()
    await expect(verify('')).resolves.toBeNull()
    await expect(verify(fakeJwt({ exp: NOW / 1000 - 1 }))).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('401 der API: null', async () => {
    const { verify } = setup(() => meResponse(401))
    await expect(verify(valid())).resolves.toBeNull()
  })

  it('API nicht erreichbar: null (fail closed), nicht gemerkt', async () => {
    let fail = true
    const { verify, fetchImpl } = setup(() => {
      if (fail) throw new Error('ECONNREFUSED')
      return meResponse(200, { data: { role: 'fahrer' } })
    })
    const token = valid()
    await expect(verify(token)).resolves.toBeNull()
    fail = false
    await expect(verify(token)).resolves.toEqual({
      role: 'fahrer',
      sessionKind: 'personal',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('merkt sich gültige Tokens kurz', async () => {
    const { verify, fetchImpl, advance } = setup(() =>
      meResponse(200, { data: { role: 'inhaber' } })
    )
    const token = valid()
    await verify(token)
    await verify(token)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    advance(CACHE_TTL_MS + 1)
    await verify(token)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})

describe('decideAccess', () => {
  const as =
    (role: string | null, sessionKind = 'personal'): SessionVerifier =>
    async () =>
      role ? ({ role, sessionKind } as never) : null

  it('öffentliche Pfade ohne Prüfung', async () => {
    const verify = jest.fn(as(null))
    await expect(decideAccess('/admin/login', null, verify)).resolves.toEqual({
      kind: 'public',
    })
    await expect(decideAccess('/station', null, verify)).resolves.toEqual({
      kind: 'public',
    })
    expect(verify).not.toHaveBeenCalled()
  })

  it('ohne gültige Sitzung: deny für /admin/** und /backstube/**', async () => {
    for (const path of [
      '/admin',
      '/admin/reports',
      '/admin/reports/2026-01-06',
      '/backstube',
    ]) {
      await expect(decideAccess(path, 'x', as(null))).resolves.toEqual({
        kind: 'deny',
      })
    }
  })

  it('Rolle ohne Recht auf die Seite: deny', async () => {
    await expect(
      decideAccess('/admin/reports', 't', as('verkauf'))
    ).resolves.toEqual({ kind: 'deny' })
    await expect(
      decideAccess('/admin/reports/2026-01-06', 't', as('fahrer'))
    ).resolves.toEqual({ kind: 'deny' })
  })

  it('Inhaber an der Station: Benutzerverwaltung deny, Berichte allow', async () => {
    await expect(
      decideAccess('/admin/users', 't', as('inhaber', 'station'))
    ).resolves.toEqual({ kind: 'deny' })
    await expect(
      decideAccess('/admin/reports', 't', as('inhaber', 'station'))
    ).resolves.toMatchObject({ kind: 'allow' })
  })

  it('Backstubenleitung: API-Rolle wird erkannt (nicht „unbekannt“)', () => {
    expect(
      principalFromMe({
        success: true,
        data: { role: 'backstubenleiter', sessionKind: 'station' },
      })
    ).toEqual({ role: 'backstubenleiter', sessionKind: 'station' })
  })

  it('Rezepte: lesen auch die Backstube, die Formulare nur Leitung und Inhaber', async () => {
    const decision = async (path: string, role: string) =>
      (await decideAccess(path, 't', as(role, 'station'))).kind
    for (const role of ['inhaber', 'backstubenleiter', 'backstube']) {
      expect(await decision('/admin/rezepte', role)).toBe('allow')
      expect(await decision('/admin/rezepte/breads/musterkruste', role)).toBe(
        'allow'
      )
    }
    for (const path of [
      '/admin/rezepte/neu',
      '/admin/rezepte/bearbeiten/breads/musterkruste',
    ]) {
      expect(await decision(path, 'inhaber')).toBe('allow')
      expect(await decision(path, 'backstubenleiter')).toBe('allow')
      expect(await decision(path, 'backstube')).toBe('deny')
    }
    for (const role of ['verkauf', 'fahrer']) {
      expect(await decision('/admin/rezepte', role)).toBe('deny')
    }
    // alles, was die Backstube darf
    expect(await decision('/backstube', 'backstubenleiter')).toBe('allow')
    expect(
      await decision('/admin/backzettel/grundmengen', 'backstubenleiter')
    ).toBe('allow')
    expect(await decision('/admin/reports', 'backstubenleiter')).toBe('deny')
  })

  it('erlaubt: allow mit Rolle', async () => {
    await expect(
      decideAccess('/admin/reports', 't', as('inhaber'))
    ).resolves.toEqual({
      kind: 'allow',
      principal: { role: 'inhaber', sessionKind: 'personal' },
    })
  })
})

describe('mayLoadCashTile', () => {
  it('nur Rollen, die das Berichtsarchiv öffnen dürfen', () => {
    expect(mayLoadCashTile('inhaber', 'personal')).toBe(true)
    expect(mayLoadCashTile('inhaber', 'station')).toBe(true)
    expect(mayLoadCashTile('verkauf', 'station')).toBe(false)
    expect(mayLoadCashTile('backstube', 'personal')).toBe(false)
    expect(mayLoadCashTile('fahrer', 'personal')).toBe(false)
  })
  it('ohne Header: nein', () => {
    expect(mayLoadCashTile(null, null)).toBe(false)
    expect(mayLoadCashTile('quatsch', null)).toBe(false)
  })
})
