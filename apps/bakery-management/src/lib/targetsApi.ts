/**
 * Client-seitiger Zugriff auf die Tagesziel-Endpunkte (`/api/finance/targets*`).
 *
 * Wie `financeApi.ts`: der `ApiClient` setzt den Bearer-Header selbst, 401
 * und 403 kommen als `ApiError` an und werden über `classifyFinanceError`
 * in „Anmeldung erforderlich" / „Keine Berechtigung" übersetzt.
 *
 * "Kein Ziel" ist kein Fehler: der Server antwortet dann mit
 * `status: 'no-target'` und einem Grund - und, wenn es die Config gab, mit
 * Kostenbasis und Stand, damit die Seite sagen kann, woran es liegt.
 */

import { apiClient } from '@bakery/shared/data-access'
import type {
  TargetPeriodResponse,
  TargetResult,
  TargetStatusResponse,
  TargetsResponse,
} from './targetsTypes'

export { classifyFinanceError } from './financeApi'
export type { FinanceAccessProblem } from './financeApi'

interface TargetsEnvelope<T> {
  success: boolean
  status?: 'ok' | 'no-target'
  data?: T | null
  message?: string
}

function toResult<T>(
  response: TargetsEnvelope<T> | undefined
): TargetResult<T> {
  if (!response || response.status !== 'ok' || !response.data) {
    return {
      status: 'no-target',
      reason: response?.message || 'Kein Tagesziel verfügbar.',
      partial:
        response && response.data
          ? (response.data as unknown as Partial<TargetsResponse>)
          : undefined,
    }
  }
  return { status: 'ok', data: response.data }
}

export async function fetchTargets(): Promise<TargetResult<TargetsResponse>> {
  const res = (await apiClient.get<TargetsResponse>(
    '/api/finance/targets'
  )) as TargetsEnvelope<TargetsResponse>
  return toResult(res)
}

export async function fetchTargetStatus(
  date?: string
): Promise<TargetResult<TargetStatusResponse>> {
  const res = (await apiClient.get<TargetStatusResponse>(
    '/api/finance/targets/status',
    date ? { date } : undefined
  )) as TargetsEnvelope<TargetStatusResponse>
  return toResult(res)
}

export async function fetchTargetPeriod(
  from: string,
  to: string
): Promise<TargetResult<TargetPeriodResponse>> {
  const res = (await apiClient.get<TargetPeriodResponse>(
    '/api/finance/targets/period',
    { from, to }
  )) as TargetsEnvelope<TargetPeriodResponse>
  return toResult(res)
}
