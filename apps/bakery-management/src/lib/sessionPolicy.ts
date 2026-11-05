/**
 * Wann die App eine Sitzung von sich aus beendet (F1, roadmap D5).
 *
 * - **Station** (PIN am Laden- oder Backstube-Tablet): nach
 *   `NEXT_PUBLIC_STATION_IDLE_MINUTES` (Vorgabe 10) Minuten ohne Bedienung
 *   zurück zu den Namenskacheln, spätestens 12 h nach der PIN - so lange lebt
 *   die Stationssitzung auch auf dem Server.
 * - **Persönlich** (Benutzername + Passwort): nach
 *   `NEXT_PUBLIC_IDLE_LOGOUT_HOURS` (Vorgabe 12) Stunden ohne Bedienung.
 *
 * `NEXT_PUBLIC_*` wird beim `next build` eingesetzt (wie der Pilotschalter).
 */

import type { SessionKind } from './authSession'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

export const DEFAULT_STATION_IDLE_MINUTES = 10
export const DEFAULT_PERSONAL_IDLE_HOURS = 12
/** Wie `STATION_SESSION_TTL_SECONDS` der API. */
export const STATION_MAX_SESSION_MS = 12 * HOUR

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Leerlauf-Grenze je Sitzungsart in ms. */
export function idleLimitMs(
  kind: SessionKind,
  env: {
    stationMinutes?: string
    personalHours?: string
  } = {
    stationMinutes: process.env.NEXT_PUBLIC_STATION_IDLE_MINUTES,
    personalHours: process.env.NEXT_PUBLIC_IDLE_LOGOUT_HOURS,
  }
): number {
  return kind === 'station'
    ? positive(env.stationMinutes, DEFAULT_STATION_IDLE_MINUTES) * MINUTE
    : positive(env.personalHours, DEFAULT_PERSONAL_IDLE_HOURS) * HOUR
}

export type SessionEndReason = 'idle' | 'max_age'

/**
 * Ob eine Sitzung jetzt enden muss. `lastActivityAt` fehlt, wenn nie bedient
 * wurde - dann zählt die Anmeldezeit.
 */
export function sessionEndReason(
  session: {
    sessionKind: SessionKind
    startedAt: number
    lastActivityAt?: number | null
  },
  now: number,
  limitMs: number = idleLimitMs(session.sessionKind)
): SessionEndReason | null {
  if (
    session.sessionKind === 'station' &&
    now - session.startedAt >= STATION_MAX_SESSION_MS
  ) {
    return 'max_age'
  }
  const last = Math.max(session.startedAt, session.lastActivityAt ?? 0)
  return now - last >= limitMs ? 'idle' : null
}

/** Deutsche Begründung für die Anmeldeseite / Station. */
export const SESSION_END_MESSAGES: Record<
  SessionEndReason | 'expired',
  string
> = {
  idle: 'Wegen Inaktivität abgemeldet.',
  max_age: 'Die Sitzung ist nach 12 Stunden abgelaufen.',
  expired: 'Sitzung abgelaufen. Bitte erneut anmelden.',
}
