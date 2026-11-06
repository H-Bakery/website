'use client'

/**
 * Sitzung der Management-App (F1): Anmeldung mit Passwort oder PIN,
 * Refresh bei 401, Leerlauf-Abmeldung, Abgleich zwischen Tabs.
 *
 * Ersetzt in dieser App den `AuthProvider` aus `@bakery/shared/contexts`:
 * der schickte alle 5 min einen leeren Refresh-Token und kannte weder
 * PIN-Stationen noch die Pilot-Rollen. Seiten lesen die Sitzung über
 * `useSession()` (bzw. `useOptionalSession()`, wenn sie auch ohne Provider
 * rendern müssen).
 *
 * Ablauf:
 * - Beim Start setzt `restoreSession()` das gespeicherte Token auf den
 *   `apiClient`, dann prüft `GET /api/auth/me`. Bis dahin ist `status`
 *   `'loading'` - der RouteGuard zeigt so lange nur einen Ladezustand.
 * - Antwortet eine Anfrage mit 401, fragt der `apiClient` einmal
 *   `refreshSession()`: ein Refresh je Tab (gemeinsames Promise), der neue
 *   Refresh-Token landet sofort im Speicher. 409 `refresh_superseded` heißt,
 *   ein anderer Tab hat gerade erneuert - dann wird dessen Token übernommen.
 *   Scheitert der Refresh mit 401, ist die Sitzung vorbei: `status` wird
 *   `'anonymous'`, der RouteGuard leitet zur Anmeldung bzw. Station.
 * - Ist die API nicht erreichbar, bleibt eine gespeicherte Sitzung bestehen
 *   (WLAN-Aussetzer im Laden sollen niemanden abmelden).
 */

import React from 'react'
import { apiClient, type ApiError } from '@bakery/shared/data-access'
import * as authApi from './authApi'
import {
  SESSION_STORAGE_KEY,
  clearSession,
  loadLastActivity,
  loadSession,
  loadStation,
  normalizeUser,
  restoreSession,
  saveLastActivity,
  saveSession,
  type SessionKind,
  type SessionUser,
  type StoredSession,
} from './authSession'
import {
  SESSION_END_MESSAGES,
  idleLimitMs,
  sessionEndReason,
  type SessionEndReason,
} from './sessionPolicy'

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous'

export interface SessionContextValue {
  status: SessionStatus
  user: SessionUser | null
  sessionKind: SessionKind | null
  isAuthenticated: boolean
  isLoading: boolean
  /** Warum die App zuletzt abgemeldet hat (deutsch), sonst `null`. */
  endReason: string | null
  /**
   * `true` nach „Abmelden" (bis zur nächsten Anmeldung). Der RouteGuard
   * leitet dann ohne `?next=` weiter - die nächste Person soll nicht auf der
   * letzten Seite der vorigen landen.
   */
  loggedOut: boolean
  clearEndReason: () => void
  login: (username: string, password: string) => Promise<SessionUser>
  pinLogin: (
    stationToken: string,
    userId: number | string,
    pin: string
  ) => Promise<SessionUser>
  /** Meldet ab; liefert das Ziel (`/station` auf einer Station, sonst `/admin/login`). */
  logout: () => Promise<string>
}

const SessionContext = React.createContext<SessionContextValue | null>(null)

/** Wie oft der Leerlauf geprüft wird. */
const IDLE_CHECK_MS = 15 * 1000
/** Höchstens so oft wird die letzte Bedienung gespeichert. */
const ACTIVITY_WRITE_MS = 5 * 1000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel']

/** Leerlauf-Grenze für die Seite, die gerade offen ist (Backstube-Tablet). */
function currentIdleLimit(kind: SessionKind, role: string | null | undefined) {
  const path = typeof window === 'undefined' ? null : window.location.pathname
  return idleLimitMs(kind, undefined, { role, path })
}

function statusOf(error: unknown): number | undefined {
  const status = (error as Partial<ApiError> | null)?.status
  return typeof status === 'number' ? status : undefined
}

/** Wohin nach dem Abmelden: Stationen zurück zu den Namenskacheln. */
export function logoutTarget(): string {
  return loadStation() ? '/station' : '/admin/login'
}

/**
 * Baut die zu speichernde Sitzung aus einer login/refresh/pin-Antwort.
 * Beim Refresh bleiben Anmeldezeit und (beim Mock ohne Rotation) der
 * Refresh-Token der vorigen Sitzung erhalten.
 */
export function sessionFromIssued(
  issued: authApi.IssuedSession,
  fallbackKind: SessionKind,
  previous: StoredSession | null = null,
  now: number = Date.now()
): StoredSession {
  const user = normalizeUser(issued?.user) ?? previous?.user ?? null
  if (!issued?.token || !user) {
    throw new Error(
      'Die Anmeldung wurde vom Server nicht vollständig bestätigt (unbekannte Rolle?).'
    )
  }
  return {
    token: issued.token,
    refreshToken: issued.refreshToken ?? previous?.refreshToken ?? null,
    user,
    sessionKind: issued.sessionKind ?? previous?.sessionKind ?? fallbackKind,
    startedAt: previous?.startedAt ?? now,
  }
}

export type RefreshOutcome =
  | { ok: true; session: StoredSession }
  | { ok: false; ended: boolean }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function doRefresh(): Promise<RefreshOutcome> {
  const stored = loadSession()
  if (!stored?.refreshToken) {
    clearSession()
    return { ok: false, ended: true }
  }
  try {
    const issued = await authApi.refresh(stored.refreshToken)
    const next = sessionFromIssued(issued, stored.sessionKind, stored)
    saveSession(next)
    apiClient.setAuthToken(next.token)
    return { ok: true, session: next }
  } catch (error) {
    const status = statusOf(error)
    if (status === 409) {
      // Ein anderer Tab hat eben erneuert: dessen neuen Token übernehmen,
      // sobald er im Speicher steht.
      for (let attempt = 0; attempt < 5; attempt++) {
        await sleep(300)
        const again = loadSession()
        if (again && again.refreshToken !== stored.refreshToken) {
          apiClient.setAuthToken(again.token)
          return { ok: true, session: again }
        }
      }
      return { ok: false, ended: false }
    }
    if (status !== undefined && status >= 400 && status < 500) {
      clearSession()
      return { ok: false, ended: true }
    }
    // Netz oder Server weg: Sitzung behalten, die Anfrage scheitert.
    return { ok: false, ended: false }
  }
}

let inflightRefresh: Promise<RefreshOutcome> | null = null

/** Ein Refresh je Tab, egal wie viele Anfragen gleichzeitig 401 bekommen. */
export function refreshSession(): Promise<RefreshOutcome> {
  if (!inflightRefresh) {
    inflightRefresh = doRefresh().finally(() => {
      inflightRefresh = null
    })
  }
  return inflightRefresh
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<StoredSession | null>(null)
  const [status, setStatus] = React.useState<SessionStatus>('loading')
  const [endReason, setEndReason] = React.useState<string | null>(null)
  const [loggedOut, setLoggedOut] = React.useState(false)

  const becomeAnonymous = React.useCallback((reason: string | null) => {
    setSession(null)
    setStatus('anonymous')
    setEndReason(reason)
  }, [])

  const endSession = React.useCallback(
    async (reason: SessionEndReason | null) => {
      const stored = loadSession()
      try {
        // Access-Token im Header, Refresh-Token im Body: so endet die
        // Sitzung auch, wenn das Access-Token (1 h) schon abgelaufen ist.
        await authApi.logout(stored?.refreshToken)
      } catch {
        // Abmelden klappt lokal auch ohne Server.
      }
      clearSession()
      becomeAnonymous(reason ? SESSION_END_MESSAGES[reason] : null)
    },
    [becomeAnonymous]
  )

  // Start: gespeicherte Sitzung prüfen, Refresh-Handler einhängen.
  React.useEffect(() => {
    let cancelled = false
    apiClient.setUnauthorizedHandler(async () => {
      const outcome = await refreshSession()
      if (cancelled) return outcome.ok
      if (outcome.ok) {
        setSession(outcome.session)
        return true
      }
      if (outcome.ended) becomeAnonymous(SESSION_END_MESSAGES.expired)
      return false
    })

    const stored = restoreSession()
    if (!stored) {
      setStatus('anonymous')
    } else {
      const reason = sessionEndReason(
        { ...stored, lastActivityAt: loadLastActivity() },
        Date.now(),
        currentIdleLimit(stored.sessionKind, stored.user?.role)
      )
      if (reason) {
        void endSession(reason)
      } else {
        authApi
          .fetchMe()
          .then((raw) => {
            if (cancelled) return
            const latest = loadSession() ?? stored
            const user = normalizeUser(raw)
            const next = user ? { ...latest, user } : latest
            if (user) saveSession(next)
            setSession(next)
            setStatus('authenticated')
          })
          .catch((error) => {
            if (cancelled) return
            const code = statusOf(error)
            if (code === 401 || code === 403) {
              clearSession()
              becomeAnonymous(SESSION_END_MESSAGES.expired)
            } else {
              // API nicht erreichbar: mit der gespeicherten Sitzung weiter.
              setSession(loadSession() ?? stored)
              setStatus('authenticated')
            }
          })
      }
    }

    return () => {
      cancelled = true
      apiClient.setUnauthorizedHandler(null)
    }
  }, [becomeAnonymous, endSession])

  // Andere Tabs: An- und Abmeldung übernehmen.
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_STORAGE_KEY) return
      const next = loadSession()
      if (next) {
        apiClient.setAuthToken(next.token)
        setSession(next)
        setStatus('authenticated')
      } else {
        apiClient.clearAuthToken()
        becomeAnonymous(null)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [becomeAnonymous])

  // Leerlauf: Bedienung merken, regelmäßig prüfen.
  const kind = session?.sessionKind
  const startedAt = session?.startedAt
  const role = session?.user?.role
  React.useEffect(() => {
    if (status !== 'authenticated' || !kind || startedAt === undefined) return
    let lastWrite = Date.now()
    saveLastActivity(lastWrite)
    const onActivity = () => {
      const now = Date.now()
      if (now - lastWrite >= ACTIVITY_WRITE_MS) {
        lastWrite = now
        saveLastActivity(now)
      }
    }
    ACTIVITY_EVENTS.forEach((name) =>
      window.addEventListener(name, onActivity, { passive: true })
    )
    const timer = window.setInterval(() => {
      const reason = sessionEndReason(
        { sessionKind: kind, startedAt, lastActivityAt: loadLastActivity() },
        Date.now(),
        // Je Prüfung neu: wer vom Backstube-Tablet weg navigiert, bekommt
        // wieder die kurze Grenze.
        currentIdleLimit(kind, role)
      )
      if (reason) void endSession(reason)
    }, IDLE_CHECK_MS)
    return () => {
      ACTIVITY_EVENTS.forEach((name) =>
        window.removeEventListener(name, onActivity)
      )
      window.clearInterval(timer)
    }
  }, [status, kind, startedAt, role, endSession])

  const establish = React.useCallback((next: StoredSession) => {
    saveSession(next)
    saveLastActivity(Date.now())
    apiClient.setAuthToken(next.token)
    setSession(next)
    setStatus('authenticated')
    setEndReason(null)
    setLoggedOut(false)
    return next.user
  }, [])

  const login = React.useCallback(
    async (username: string, password: string) => {
      const issued = await authApi.login(username, password)
      return establish(sessionFromIssued(issued, 'personal'))
    },
    [establish]
  )

  const pinLogin = React.useCallback(
    async (stationToken: string, userId: number | string, pin: string) => {
      const issued = await authApi.pinLogin(stationToken, userId, pin)
      // Wer vorher an diesem Gerät angemeldet war, ist es jetzt nicht mehr.
      const previous = loadSession()
      if (previous) {
        try {
          await authApi.logout(previous.refreshToken)
        } catch {
          // egal - die neue Sitzung gilt
        }
      }
      return establish(sessionFromIssued(issued, 'station'))
    },
    [establish]
  )

  const logout = React.useCallback(async () => {
    // Vor dem Zustandswechsel setzen: rendert der RouteGuard die Seite als
    // anonym, weiß er schon, dass das kein Ablauf war.
    setLoggedOut(true)
    await endSession(null)
    return logoutTarget()
  }, [endSession])

  const clearEndReason = React.useCallback(() => setEndReason(null), [])

  const value = React.useMemo<SessionContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      sessionKind: session?.sessionKind ?? null,
      isAuthenticated: status === 'authenticated' && session !== null,
      isLoading: status === 'loading',
      endReason,
      loggedOut,
      clearEndReason,
      login,
      pinLogin,
      logout,
    }),
    [
      status,
      session,
      endReason,
      loggedOut,
      clearEndReason,
      login,
      pinLogin,
      logout,
    ]
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

/** Die Sitzung; wirft außerhalb des `SessionProvider`. */
export function useSession(): SessionContextValue {
  const value = React.useContext(SessionContext)
  if (!value) {
    throw new Error('useSession muss innerhalb des SessionProvider stehen')
  }
  return value
}

/** Die Sitzung oder `null` ohne Provider (Seiten-Tests, Fehlerseiten). */
export function useOptionalSession(): SessionContextValue | null {
  return React.useContext(SessionContext)
}

/** Für Tests: einen festen Sitzungswert bereitstellen. */
export const SessionContextProvider = SessionContext.Provider
