import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { apiClient } from '@bakery/shared/data-access'
import {
  SessionProvider,
  refreshSession,
  sessionFromIssued,
  useSession,
  type SessionContextValue,
} from './session'
import {
  loadSession,
  saveSession,
  saveStation,
  currentToken,
  loadLastActivity,
  loadUnattended,
  saveLastActivity,
  type SessionUser,
  type StoredSession,
} from './authSession'
import { useMemoryStorage } from './testing/memoryStorage'
import * as authApi from './authApi'

jest.mock('./authApi')
const api = authApi as jest.Mocked<typeof authApi>

const INHABER = {
  id: 1,
  username: 'test.inhaber',
  displayName: 'Test Inhaber',
  role: 'inhaber',
}

function stored(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    token: 'acc-alt',
    refreshToken: 'rt_alt',
    user: {
      id: 1,
      username: 'test.inhaber',
      displayName: 'Test Inhaber',
      role: 'inhaber',
    },
    sessionKind: 'personal',
    startedAt: Date.now(),
    ...overrides,
  }
}

function apiError(status: number, code = 'x', message = 'Fehler') {
  return Object.assign(new Error(message), { status, code })
}

let ctx: SessionContextValue
function Probe() {
  ctx = useSession()
  return (
    <div>
      <span data-testid="status">{ctx.status}</span>
      <span data-testid="user">{ctx.user?.displayName ?? '-'}</span>
      <span data-testid="reason">{ctx.endReason ?? '-'}</span>
      <span data-testid="unattended">
        {String(ctx.unattendedAtBackstube ?? false)}
      </span>
    </div>
  )
}

function renderProvider() {
  return render(
    <SessionProvider>
      <Probe />
    </SessionProvider>
  )
}

describe('SessionProvider', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    useMemoryStorage()
    apiClient.clearAuthToken()
    api.logout.mockResolvedValue(undefined)
  })

  it('ohne gespeicherte Sitzung: anonym, ohne Anfrage', async () => {
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    )
    expect(api.fetchMe).not.toHaveBeenCalled()
  })

  it('prüft eine gespeicherte Sitzung mit /me und übernimmt den aktuellen Benutzer', async () => {
    saveSession(stored())
    api.fetchMe.mockResolvedValue({ ...INHABER, displayName: 'Neu benannt' })
    renderProvider()
    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    )
    expect(screen.getByTestId('user')).toHaveTextContent('Neu benannt')
    expect(currentToken()).toBe('acc-alt')
    expect(loadSession()?.user.displayName).toBe('Neu benannt')
  })

  it('/me mit 401 (Refresh gescheitert): anonym mit Hinweis, Speicher leer', async () => {
    saveSession(stored())
    api.fetchMe.mockRejectedValue(apiError(401, 'unauthorized'))
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    )
    expect(screen.getByTestId('reason')).toHaveTextContent('Sitzung abgelaufen')
    expect(loadSession()).toBeNull()
  })

  it('API nicht erreichbar: die gespeicherte Sitzung gilt weiter', async () => {
    saveSession(stored())
    api.fetchMe.mockRejectedValue(new Error('Request timeout'))
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    )
  })

  it('login speichert Access- und Refresh-Token; logout beendet die Sitzung an der API', async () => {
    api.login.mockResolvedValue({
      user: INHABER,
      token: 'acc-neu',
      refreshToken: 'rt_neu',
      expiresIn: 3600,
      sessionKind: 'personal',
    })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    )
    await act(async () => {
      await ctx.login('test.inhaber', 'geheim123')
    })
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    expect(loadSession()).toMatchObject({
      token: 'acc-neu',
      refreshToken: 'rt_neu',
      sessionKind: 'personal',
    })
    expect(currentToken()).toBe('acc-neu')

    let target = ''
    await act(async () => {
      target = await ctx.logout()
    })
    expect(api.logout).toHaveBeenCalledWith('rt_neu')
    expect(target).toBe('/admin/login')
    expect(loadSession()).toBeNull()
    expect(currentToken()).toBeNull()
    expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
  })

  it('auf einer Station führt Abmelden zurück zu /station', async () => {
    saveStation({ token: 'st_x', name: 'Laden' })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    )
    let target = ''
    await act(async () => {
      target = await ctx.logout()
    })
    expect(target).toBe('/station')
  })

  it('PIN-Anmeldung beendet die vorige Sitzung dieses Geräts', async () => {
    saveSession(stored({ sessionKind: 'station', refreshToken: 'rt_vorher' }))
    api.fetchMe.mockResolvedValue(INHABER)
    api.pinLogin.mockResolvedValue({
      user: {
        id: 2,
        username: 'test.verkauf',
        displayName: 'Test Verkauf',
        role: 'verkauf',
      },
      token: 'acc-pin',
      refreshToken: 'rt_pin',
      expiresIn: 3600,
      sessionKind: 'station',
    })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    )
    await act(async () => {
      await ctx.pinLogin('st_x', 2, '0420')
    })
    expect(api.pinLogin).toHaveBeenCalledWith('st_x', 2, '0420')
    expect(api.logout).toHaveBeenCalledWith('rt_vorher')
    expect(loadSession()).toMatchObject({
      token: 'acc-pin',
      sessionKind: 'station',
      user: { role: 'verkauf' },
    })
  })

  it('meldet eine Station nach 10 min ohne Bedienung ab', async () => {
    jest.useFakeTimers()
    try {
      saveSession(stored({ sessionKind: 'station' }))
      api.fetchMe.mockResolvedValue(INHABER)
      renderProvider()
      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
      await act(async () => {
        jest.advanceTimersByTime(10 * 60 * 1000 + 20 * 1000)
      })
      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
      expect(screen.getByTestId('reason')).toHaveTextContent('Inaktivität')
      expect(api.logout).toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })

  describe('Backstube-Tablet (Z6)', () => {
    const BACKSTUBE: SessionUser = {
      id: 3,
      username: 'test.backstube',
      displayName: 'Test Backstube',
      role: 'backstube',
    }

    afterEach(() => window.history.replaceState({}, '', '/'))

    async function idleFor(ms: number) {
      await act(async () => {
        jest.advanceTimersByTime(ms)
      })
      await act(async () => {
        await Promise.resolve()
      })
    }

    async function startStation(user: SessionUser, path: string) {
      window.history.replaceState({}, '', path)
      saveSession(stored({ sessionKind: 'station', user }))
      api.fetchMe.mockResolvedValue(user)
      renderProvider()
      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    }

    it('bleibt auf /backstube ohne Bedienung angemeldet, bis 12 h nach der PIN', async () => {
      jest.useFakeTimers()
      try {
        await startStation(BACKSTUBE, '/backstube')
        await idleFor(3 * 3600 * 1000)
        expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
        expect(api.logout).not.toHaveBeenCalled()
        await idleFor(9 * 3600 * 1000)
        expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
        expect(screen.getByTestId('reason')).toHaveTextContent('12 Stunden')
      } finally {
        jest.useRealTimers()
      }
    })

    it('verlässt die Backstube die Seite, gelten wieder 10 min', async () => {
      jest.useFakeTimers()
      try {
        await startStation(BACKSTUBE, '/backstube')
        await idleFor(5 * 60 * 1000)
        window.history.replaceState({}, '', '/admin/backzettel')
        await idleFor(5 * 60 * 1000 + 20 * 1000)
        expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
        expect(screen.getByTestId('reason')).toHaveTextContent('Inaktivität')
      } finally {
        jest.useRealTimers()
      }
    })

    it('auch ein Inhaber per PIN auf /backstube bleibt angemeldet - bis 12 h nach der PIN (W4)', async () => {
      jest.useFakeTimers()
      try {
        await startStation(
          { ...INHABER, id: 1 } as typeof BACKSTUBE,
          '/backstube'
        )
        await idleFor(10 * 60 * 1000 + 20 * 1000)
        expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
        await idleFor(3 * 3600 * 1000)
        expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
        await idleFor(9 * 3600 * 1000)
        expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
        expect(screen.getByTestId('reason')).toHaveTextContent('12 Stunden')
      } finally {
        jest.useRealTimers()
      }
    })

    it('ein Inhaber per PIN, der /backstube verlässt: wieder 10 min', async () => {
      jest.useFakeTimers()
      try {
        await startStation(
          { ...INHABER, id: 1 } as typeof BACKSTUBE,
          '/backstube'
        )
        window.history.replaceState({}, '', '/admin')
        await idleFor(10 * 60 * 1000 + 20 * 1000)
        expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
        expect(screen.getByTestId('reason')).toHaveTextContent('Inaktivität')
      } finally {
        jest.useRealTimers()
      }
    })

    it('Inhaber per PIN: wer nach > 10 min Ruhe auf /backstube tippt, ist „unbeaufsichtigt“ (W4-Fixup)', async () => {
      jest.useFakeTimers()
      try {
        await startStation(
          { ...INHABER, id: 1 } as typeof BACKSTUBE,
          '/backstube'
        )
        // kurze Pause: nichts
        await idleFor(5 * 60 * 1000)
        await act(async () => {
          window.dispatchEvent(new Event('pointerdown'))
        })
        expect(screen.getByTestId('unattended')).toHaveTextContent('false')
        // lange Pause: die nächste Berührung markiert die Sitzung
        await idleFor(10 * 60 * 1000 + 1000)
        expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
        await act(async () => {
          window.dispatchEvent(new Event('pointerdown'))
        })
        expect(screen.getByTestId('unattended')).toHaveTextContent('true')
        // endUnattended meldet wegen Inaktivität ab (der RouteGuard ruft es
        // beim Verlassen von /backstube)
        await act(async () => {
          ctx.endUnattended?.()
        })
        await act(async () => {
          await Promise.resolve()
        })
        expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
        expect(screen.getByTestId('reason')).toHaveTextContent('Inaktivität')
        expect(screen.getByTestId('unattended')).toHaveTextContent('false')
      } finally {
        jest.useRealTimers()
      }
    })

    it('Inhaber per PIN: ein Neuladen auf /backstube nach > 10 min Ruhe ist „unbeaufsichtigt“ und bleibt es (W4-Verifikation)', async () => {
      window.history.replaceState({}, '', '/backstube')
      const pinAt = Date.now() - 30 * 60 * 1000
      saveSession(
        stored({
          sessionKind: 'station',
          user: { ...INHABER, id: 1 } as SessionUser,
          startedAt: pinAt,
        })
      )
      saveLastActivity(Date.now() - 11 * 60 * 1000)
      api.fetchMe.mockResolvedValue(INHABER)
      const first = renderProvider()
      await waitFor(() =>
        expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
      )
      // Das Neuladen selbst ist keine Bedienung: die alte Zeit bleibt stehen.
      expect(loadLastActivity()).toBeLessThan(Date.now() - 10 * 60 * 1000)
      expect(screen.getByTestId('unattended')).toHaveTextContent('true')

      // Jemand tippt, dann wird noch einmal neu geladen: die Markierung bleibt.
      await act(async () => {
        window.dispatchEvent(new Event('pointerdown'))
      })
      first.unmount()
      renderProvider()
      await waitFor(() =>
        expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
      )
      expect(screen.getByTestId('unattended')).toHaveTextContent('true')

      // Abmelden vergisst sie.
      await act(async () => {
        ctx.endUnattended?.()
      })
      await waitFor(() =>
        expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
      )
      expect(loadUnattended(pinAt)).toBe(false)
    })

    it('Inhaber per PIN: ein Neuladen auf /backstube nach kurzer Ruhe ist nicht „unbeaufsichtigt“', async () => {
      window.history.replaceState({}, '', '/backstube')
      saveSession(
        stored({
          sessionKind: 'station',
          user: { ...INHABER, id: 1 } as SessionUser,
        })
      )
      saveLastActivity(Date.now() - 2 * 60 * 1000)
      api.fetchMe.mockResolvedValue(INHABER)
      renderProvider()
      await waitFor(() =>
        expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
      )
      expect(screen.getByTestId('unattended')).toHaveTextContent('false')
    })

    it('die Rolle Backstube wird nach langer Ruhe nicht „unbeaufsichtigt“', async () => {
      jest.useFakeTimers()
      try {
        await startStation(BACKSTUBE, '/backstube')
        await idleFor(2 * 3600 * 1000)
        await act(async () => {
          window.dispatchEvent(new Event('pointerdown'))
        })
        expect(screen.getByTestId('unattended')).toHaveTextContent('false')
      } finally {
        jest.useRealTimers()
      }
    })

    it('ein Neuladen nach einer Stunde Ruhe auf /backstube meldet nicht ab', async () => {
      window.history.replaceState({}, '', '/backstube')
      const hourAgo = Date.now() - 3600 * 1000
      saveSession(
        stored({ sessionKind: 'station', user: BACKSTUBE, startedAt: hourAgo })
      )
      api.fetchMe.mockResolvedValue(BACKSTUBE)
      renderProvider()
      await waitFor(() =>
        expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
      )
      expect(api.fetchMe).toHaveBeenCalled()
    })
  })

  it('beendet eine beim Start schon zu lange ruhende Sitzung ohne /me', async () => {
    saveSession(
      stored({
        sessionKind: 'station',
        startedAt: Date.now() - 13 * 3600 * 1000,
      })
    )
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    )
    expect(api.fetchMe).not.toHaveBeenCalled()
    expect(screen.getByTestId('reason')).toHaveTextContent('12 Stunden')
  })
})

describe('refreshSession', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    useMemoryStorage()
    apiClient.clearAuthToken()
  })

  it('rotiert den Refresh-Token und setzt das neue Access-Token', async () => {
    saveSession(stored())
    api.refresh.mockResolvedValue({
      user: INHABER,
      token: 'acc-neu',
      refreshToken: 'rt_neu',
      expiresIn: 3600,
      sessionKind: 'personal',
    })
    const outcome = await refreshSession()
    expect(outcome.ok).toBe(true)
    expect(api.refresh).toHaveBeenCalledWith('rt_alt')
    expect(loadSession()).toMatchObject({
      token: 'acc-neu',
      refreshToken: 'rt_neu',
    })
    expect(currentToken()).toBe('acc-neu')
  })

  it('erneuert bei gleichzeitigen 401 nur einmal', async () => {
    saveSession(stored())
    let resolve: (v: authApi.IssuedSession) => void = () => undefined
    api.refresh.mockReturnValue(new Promise((r) => (resolve = r)))
    const a = refreshSession()
    const b = refreshSession()
    resolve({
      user: INHABER,
      token: 'acc-neu',
      refreshToken: 'rt_neu',
      expiresIn: 1,
    })
    await Promise.all([a, b])
    expect(api.refresh).toHaveBeenCalledTimes(1)
  })

  it('409 refresh_superseded: übernimmt das Token, das ein anderer Tab gespeichert hat', async () => {
    saveSession(stored())
    api.refresh.mockImplementation(async () => {
      saveSession(stored({ token: 'acc-tab2', refreshToken: 'rt_tab2' }))
      throw apiError(409, 'refresh_superseded')
    })
    const outcome = await refreshSession()
    expect(outcome.ok).toBe(true)
    expect(currentToken()).toBe('acc-tab2')
  })

  it('401 am Refresh: Sitzung vorbei, Speicher leer', async () => {
    saveSession(stored())
    api.refresh.mockRejectedValue(apiError(401, 'unauthorized'))
    expect(await refreshSession()).toEqual({ ok: false, ended: true })
    expect(loadSession()).toBeNull()
  })

  it('Netzfehler am Refresh: Sitzung bleibt', async () => {
    saveSession(stored())
    api.refresh.mockRejectedValue(new Error('Failed to fetch'))
    expect(await refreshSession()).toEqual({ ok: false, ended: false })
    expect(loadSession()).not.toBeNull()
  })

  it('Mock ohne Rotation: der alte Refresh-Token und der Benutzer bleiben', () => {
    const prev = stored()
    const next = sessionFromIssued(
      { user: undefined, token: 'acc-neu', expiresIn: 10 },
      'personal',
      prev
    )
    expect(next).toMatchObject({
      token: 'acc-neu',
      refreshToken: 'rt_alt',
      user: prev.user,
      startedAt: prev.startedAt,
    })
  })
})
