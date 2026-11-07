/**
 * Client-seitiger Zugriff auf die rollengeschützten Finanz-Endpunkte.
 *
 * Kapselt `apiClient` wie `partnerApi.ts`. Der `ApiClient` setzt den
 * Bearer-Header selbst; ohne Anmeldung antwortet der Server mit 401, mit der
 * falschen Rolle mit 403 - beides kommt als `ApiError` mit `status` an, damit
 * die Seite einen Link zur Anmeldung zeigen kann statt einer Fehlermeldung.
 *
 * "Keine Daten" ist kein Fehler: der Server antwortet dann mit
 * `status: 'no-data'` und einem Grund, der so durchgereicht wird.
 */

import { apiClient, ApiError } from '@bakery/shared/data-access'
import { backzettelErrorText } from './backstubeErrors'
import type {
  FinanceMonthsResponse,
  FinanceResult,
  FinanceSummaryResponse,
} from './financeTypes'

interface FinanceEnvelope<T> {
  success: boolean
  status?: 'ok' | 'no-data'
  data?: T | null
  message?: string
}

function toResult<T>(
  response: FinanceEnvelope<T> | undefined
): FinanceResult<T> {
  if (!response || response.status === 'no-data' || !response.data) {
    return {
      status: 'no-data',
      reason: response?.message || 'Keine Finanzdaten vorhanden.',
    }
  }
  return { status: 'ok', data: response.data }
}

export async function fetchFinanceSummary(): Promise<
  FinanceResult<FinanceSummaryResponse>
> {
  const res = (await apiClient.get<FinanceSummaryResponse>(
    '/api/finance/summary'
  )) as FinanceEnvelope<FinanceSummaryResponse>
  return toResult(res)
}

export async function fetchFinanceMonths(
  range: { from?: string; to?: string } = {}
): Promise<FinanceResult<FinanceMonthsResponse>> {
  const res = (await apiClient.get<FinanceMonthsResponse>(
    '/api/finance/months',
    range
  )) as FinanceEnvelope<FinanceMonthsResponse>
  return toResult(res)
}

/**
 * Fehlerklassen, die die Seite unterschiedlich darstellt. `personal_session`:
 * Inhaber an einer PIN-Station - Finanzen und Tagesziel brauchen eine
 * Passwort-Sitzung (B4, 403 `personal_session_required`).
 */
export type FinanceAccessProblem =
  | 'unauthenticated'
  | 'forbidden'
  | 'personal_session'
  | 'error'

/** Hinweis für `personal_session` (F4) - überall derselbe Wortlaut. */
export const PERSONAL_SESSION_HINT =
  'An der PIN-Station nicht verfügbar – bitte am Büro-PC oder eigenen Gerät mit Passwort anmelden.'

/**
 * Fehlerklasse und deutscher Text. Ohne Antwort (WLAN weg, API gestoppt)
 * oder mit 502-504 von Caddy kommt der WLAN-Hinweis, nie die Browser- oder
 * Proxy-Meldung („Failed to fetch“, „HTTP 502: Bad Gateway“ - UI-Runde 2);
 * `fallback` beginnt den Text bei einem unerwarteten Serverfehler.
 */
export function classifyFinanceError(
  err: unknown,
  fallback = 'Die Finanzdaten konnten nicht geladen werden.'
): {
  kind: FinanceAccessProblem
  message: string
} {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return { kind: 'unauthenticated', message: err.message }
    }
    if (err.status === 403 && err.code === 'personal_session_required') {
      return { kind: 'personal_session', message: PERSONAL_SESSION_HINT }
    }
    if (err.status === 403) return { kind: 'forbidden', message: err.message }
  }
  // Ein Programmfehler (TypeError „Cannot read …“) gehört nicht auf den
  // Bildschirm; „Failed to fetch“ ist auch ein TypeError und bleibt der
  // WLAN-Hinweis.
  const text = backzettelErrorText(err, fallback)
  const message =
    err instanceof TypeError && text === err.message ? fallback : text
  return { kind: 'error', message }
}
