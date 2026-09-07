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

/** Fehlerklassen, die die Seite unterschiedlich darstellt. */
export type FinanceAccessProblem = 'unauthenticated' | 'forbidden' | 'error'

export function classifyFinanceError(err: unknown): {
  kind: FinanceAccessProblem
  message: string
} {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return { kind: 'unauthenticated', message: err.message }
    }
    if (err.status === 403) return { kind: 'forbidden', message: err.message }
    return { kind: 'error', message: err.message }
  }
  const message =
    err instanceof Error && err.message
      ? err.message
      : 'Die Finanzdaten konnten nicht geladen werden.'
  return { kind: 'error', message }
}
