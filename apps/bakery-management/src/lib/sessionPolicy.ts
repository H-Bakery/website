/**
 * Wann die App eine Sitzung von sich aus beendet (F1, roadmap D5).
 *
 * - **Station** (PIN am Laden- oder Backstube-Tablet): nach
 *   `NEXT_PUBLIC_STATION_IDLE_MINUTES` (Vorgabe 10) Minuten ohne Bedienung
 *   zurück zu den Namenskacheln, spätestens 12 h nach der PIN - so lange lebt
 *   die Stationssitzung auch auf dem Server.
 * - **Station zum Tagesende** (optional): ist
 *   `NEXT_PUBLIC_STATION_LOGOUT_AT` gesetzt (`HH:MM`, Ortszeit des Geräts,
 *   z. B. `13:30`), endet eine Stationssitzung, sobald nach der PIN diese
 *   Uhrzeit erreicht ist ("Abmeldung bei Ladenschluss", roadmap F1). Ohne
 *   Wert gibt es keine feste Uhrzeit - die Backstube arbeitet nachmittags
 *   (Vorbereitung 14-15 Uhr), ein Ladenschluss passt nicht für jede Station.
 * - **Backstube-Tablet** (Z6, W4): eine Stationssitzung auf `/backstube`
 *   steht dauerhaft offen - mit Teig an den Händen tippt niemand alle 10 min
 *   aufs Tablet, und der Zettel lädt von selbst neu. Dort gilt
 *   `NEXT_PUBLIC_BACKSTUBE_IDLE_MINUTES` (Vorgabe 720 = 12 h, also praktisch
 *   nur die 12-h-Grenze nach der PIN und ein gesetztes
 *   `NEXT_PUBLIC_STATION_LOGOUT_AT`) - **für jede Rolle**, die die Seite
 *   öffnen darf (Backstube und Inhaber): wer per PIN am Tablet in der
 *   Backstube steht, hat genauso Teig an den Händen. Die Seite selbst kann
 *   nichts verwalten; auf jeder anderen Seite gelten an der Station wieder
 *   die 10 min, sobald man sie öffnet.
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
/** Backstube-Tablet: so lange wie die Stationssitzung selbst. */
export const DEFAULT_BACKSTUBE_IDLE_MINUTES = 12 * 60
/** Wie `STATION_SESSION_TTL_SECONDS` der API. */
export const STATION_MAX_SESSION_MS = 12 * HOUR

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** `/backstube` und darunter - die Seite, die in der Backstube offen steht. */
export function isBackstubePath(path: string | null | undefined): boolean {
  return path === '/backstube' || !!path?.startsWith('/backstube/')
}

/**
 * Leerlauf-Grenze in ms - je Sitzungsart, und an der Station auf
 * `/backstube` (jede Rolle) die eigene, lange Grenze (siehe oben). `role`
 * bleibt im Signatur-Objekt, damit Aufrufer nichts ändern müssen.
 */
export function idleLimitMs(
  kind: SessionKind,
  env: {
    stationMinutes?: string
    personalHours?: string
    backstubeMinutes?: string
  } = {
    stationMinutes: process.env.NEXT_PUBLIC_STATION_IDLE_MINUTES,
    personalHours: process.env.NEXT_PUBLIC_IDLE_LOGOUT_HOURS,
    backstubeMinutes: process.env.NEXT_PUBLIC_BACKSTUBE_IDLE_MINUTES,
  },
  where: { role?: string | null; path?: string | null } = {}
): number {
  if (kind !== 'station') {
    return positive(env.personalHours, DEFAULT_PERSONAL_IDLE_HOURS) * HOUR
  }
  if (isBackstubePath(where.path)) {
    return (
      positive(env.backstubeMinutes, DEFAULT_BACKSTUBE_IDLE_MINUTES) * MINUTE
    )
  }
  return positive(env.stationMinutes, DEFAULT_STATION_IDLE_MINUTES) * MINUTE
}

export type SessionEndReason = 'idle' | 'max_age' | 'closing'

/** `"HH:MM"` → Minuten nach Mitternacht; sonst `null` (kein Tagesende). */
export function parseClockTime(
  value: string | null | undefined
): number | null {
  const match = /^\s*([01]?\d|2[0-3]):([0-5]\d)\s*$/.exec(value ?? '')
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/** Uhrzeit des Stations-Tagesendes in Minuten nach Mitternacht, oder `null`. */
export function stationLogoutAtMinutes(
  value: string | undefined = process.env.NEXT_PUBLIC_STATION_LOGOUT_AT
): number | null {
  return parseClockTime(value)
}

/**
 * Der erste Zeitpunkt (ms) nach `from`, an dem die lokale Uhr `minutes`
 * nach Mitternacht zeigt - am selben Tag oder am nächsten.
 */
export function nextClockTimeAfter(from: number, minutes: number): number {
  const date = new Date(from)
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  if (date.getTime() <= from) date.setDate(date.getDate() + 1)
  return date.getTime()
}

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
  limitMs: number = idleLimitMs(session.sessionKind),
  stationLogoutAt: number | null = stationLogoutAtMinutes()
): SessionEndReason | null {
  if (session.sessionKind === 'station') {
    if (now - session.startedAt >= STATION_MAX_SESSION_MS) return 'max_age'
    if (
      stationLogoutAt !== null &&
      now >= nextClockTimeAfter(session.startedAt, stationLogoutAt)
    ) {
      return 'closing'
    }
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
  closing: 'Zum Tagesende automatisch abgemeldet.',
  expired: 'Sitzung abgelaufen. Bitte erneut anmelden.',
}
