import {
  AuthError,
  LAST_USER_KEY,
  SESSION_KEY,
  currentSession,
  lastUser,
  login,
  logout,
  normalizeUser,
  permissionsFor,
  refreshSession,
  rememberLastUser,
  resetSessionCache,
  saveSession,
  type DeliverySession,
} from './session'

/** Antwort im Format von `fetch`, wie `postAuth` sie liest. */
const answer = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

const issued = (token: string, refreshToken: string, role = 'fahrer') => ({
  success: true,
  data: {
    user: { id: 42, username: 'fahrer.test', displayName: 'Test Fahrer', role },
    token,
    refreshToken,
    expiresIn: 3600,
    sessionKind: 'personal',
  },
})

const session: DeliverySession = {
  token: 'at_1',
  refreshToken: 'rt_1',
  user: {
    id: 42,
    username: 'fahrer.test',
    displayName: 'Test Fahrer',
    role: 'fahrer',
  },
}

let fetchMock: jest.Mock

beforeEach(() => {
  window.localStorage.clear()
  resetSessionCache()
  fetchMock = jest.fn()
  ;(global as { fetch?: unknown }).fetch = fetchMock
})

afterEach(() => {
  delete (global as { fetch?: unknown }).fetch
})

describe('normalizeUser', () => {
  it('liest den Benutzer der echten API', () => {
    expect(
      normalizeUser({
        id: 7,
        username: 'anna',
        displayName: 'Anna',
        role: 'verkauf',
        sessionKind: 'personal',
      })
    ).toEqual({ id: 7, username: 'anna', displayName: 'Anna', role: 'verkauf' })
  })

  it('versteht den Mock: E-Mail statt Benutzername, admin → inhaber', () => {
    expect(
      normalizeUser({
        id: 1,
        email: 'admin',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'admin',
      })
    ).toEqual({
      id: 1,
      username: 'admin',
      displayName: 'Test Admin',
      role: 'inhaber',
    })
    expect(normalizeUser({ id: 2, email: 'x', role: 'staff' })?.role).toBe(
      'verkauf'
    )
  })

  it('verwirft unbekannte Rollen und Benutzer ohne id', () => {
    expect(normalizeUser({ id: 1, role: 'gast' })).toBeNull()
    expect(normalizeUser({ role: 'fahrer' })).toBeNull()
    expect(normalizeUser(null)).toBeNull()
  })
})

describe('permissionsFor', () => {
  it('Inhaber plant und fährt, Fahrer fährt nur die eigenen, Verkauf liest', () => {
    expect(permissionsFor('inhaber')).toEqual({
      plan: true,
      drive: true,
      ownToursOnly: false,
    })
    expect(permissionsFor('fahrer')).toEqual({
      plan: false,
      drive: true,
      ownToursOnly: true,
    })
    expect(permissionsFor('verkauf')).toEqual({
      plan: false,
      drive: false,
      ownToursOnly: false,
    })
    expect(permissionsFor(undefined).drive).toBe(false)
  })
})

describe('login', () => {
  it('speichert Token, Refresh-Token und Benutzer', async () => {
    fetchMock.mockResolvedValue(answer(issued('at_1', 'rt_1')))

    const result = await login('fahrer.test', 'geheim-geheim')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/auth\/login$/)
    expect(JSON.parse(init.body)).toEqual({
      username: 'fahrer.test',
      password: 'geheim-geheim',
    })
    expect(result).toEqual(session)
    expect(
      JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null')
    ).toEqual(session)
    resetSessionCache()
    expect(currentSession()).toEqual(session)
  })

  it('reicht die deutsche Meldung der API weiter', async () => {
    fetchMock.mockResolvedValue(
      answer(
        {
          error: 'invalid_credentials',
          message: 'Benutzername oder Passwort falsch.',
        },
        401
      )
    )

    await expect(login('x', 'y')).rejects.toMatchObject({
      message: 'Benutzername oder Passwort falsch.',
      status: 401,
      code: 'invalid_credentials',
    })
    expect(currentSession()).toBeNull()
  })

  it('weist die Backstube ab und beendet ihre eben entstandene Sitzung', async () => {
    fetchMock
      .mockResolvedValueOnce(answer(issued('at_b', 'rt_b', 'backstube')))
      .mockResolvedValueOnce(answer({ success: true, message: 'Abgemeldet.' }))

    await expect(login('back', 'pw')).rejects.toBeInstanceOf(AuthError)
    expect(currentSession()).toBeNull()
    await Promise.resolve()
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toMatch(/\/api\/auth\/logout$/)
    expect(init.headers.Authorization).toBe('Bearer at_b')
  })

  it('ruft `prepare` vor dem Speichern auf', async () => {
    fetchMock.mockResolvedValue(answer(issued('at_1', 'rt_1')))
    const seen: Array<DeliverySession | null> = []

    await login('fahrer.test', 'pw', () => seen.push(currentSession()))

    expect(seen).toEqual([null])
  })
})

describe('refreshSession', () => {
  beforeEach(() => saveSession(session))

  it('rotiert: der neue Refresh-Token steht sofort im Speicher', async () => {
    fetchMock.mockResolvedValue(answer(issued('at_2', 'rt_2')))

    const outcome = await refreshSession()

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      refreshToken: 'rt_1',
    })
    expect(outcome).toMatchObject({ ok: true, session: { token: 'at_2' } })
    expect(
      JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null')
        .refreshToken
    ).toBe('rt_2')
  })

  it('schickt bei gleichzeitigen 401 nur einen Refresh', async () => {
    fetchMock.mockResolvedValue(answer(issued('at_2', 'rt_2')))

    const [a, b] = await Promise.all([refreshSession(), refreshSession()])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
  })

  it('behält beim Mock (keine Rotation) den alten Refresh-Token', async () => {
    fetchMock.mockResolvedValue(
      answer({ success: true, data: { token: 'at_2', expiresIn: 3600 } })
    )

    const outcome = await refreshSession()

    expect(outcome).toMatchObject({
      ok: true,
      session: { token: 'at_2', refreshToken: 'rt_1', user: session.user },
    })
  })

  it('übernimmt bei 409 refresh_superseded den Token des anderen Tabs', async () => {
    fetchMock.mockImplementation(async () => {
      // Der andere Tab war schneller und hat schon gespeichert.
      window.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...session,
          token: 'at_tab2',
          refreshToken: 'rt_tab2',
        })
      )
      return answer(
        { error: 'refresh_superseded', message: 'Bereits erneuert.' },
        409
      )
    })

    const outcome = await refreshSession()

    expect(outcome).toMatchObject({ ok: true, session: { token: 'at_tab2' } })
    expect(currentSession()?.refreshToken).toBe('rt_tab2')
  })

  it('beendet die Sitzung bei einer Ablehnung (4xx)', async () => {
    fetchMock.mockResolvedValue(
      answer({ error: 'unauthorized', message: 'Sitzung beendet.' }, 401)
    )

    expect(await refreshSession()).toEqual({ ok: false, ended: true })
    expect(currentSession()).toBeNull()
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('behält die Sitzung im Funkloch und bei Serverfehlern', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await refreshSession()).toEqual({ ok: false, ended: false })
    expect(currentSession()).toEqual(session)

    fetchMock.mockResolvedValueOnce(answer({}, 502))
    expect(await refreshSession()).toEqual({ ok: false, ended: false })
    expect(currentSession()).toEqual(session)
  })

  it('ohne Refresh-Token ist die Sitzung vorbei', async () => {
    saveSession({ ...session, refreshToken: null })

    expect(await refreshSession()).toEqual({ ok: false, ended: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('logout', () => {
  it('beendet die Sitzung auf dem Server und im Speicher', async () => {
    saveSession(session)
    fetchMock.mockResolvedValue(answer({ success: true }))

    await logout()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/auth\/logout$/)
    expect(init.headers.Authorization).toBe('Bearer at_1')
    expect(JSON.parse(init.body)).toEqual({ refreshToken: 'rt_1' })
    expect(currentSession()).toBeNull()
  })

  it('meldet auch ohne Netz lokal ab', async () => {
    saveSession(session)
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await logout()

    expect(currentSession()).toBeNull()
  })
})

describe('lastUser', () => {
  it('merkt sich, wer zuletzt angemeldet war', () => {
    expect(lastUser()).toBeNull()
    rememberLastUser(42)
    expect(lastUser()).toBe('42')
    expect(window.localStorage.getItem(LAST_USER_KEY)).toBe('42')
  })
})
