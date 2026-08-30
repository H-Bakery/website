/**
 * Client-seitiger Zugriff auf die Verkaufspartner-Endpunkte.
 *
 * Kapselt `apiClient`, damit die Seiten keine Endpunkt-Strings duplizieren.
 * `apiClient` wirft bei nicht-2xx eine `Error` mit der `message` aus dem Body -
 * die Aufrufer fangen das und zeigen den Text an.
 */

import { apiClient } from '@bakery/shared/data-access'
import {
  DayDetail,
  Partner,
  PartnerDeliveryTemplate,
  PartnerStats,
  PartnerVisit,
  TemplateItem,
  VisitPayload,
} from './partnerTypes'

/** `apiClient` verpackt Antworten in `{ success, data }` - hier wieder auspacken. */
function unwrap<T>(response: { data?: T } | undefined, fallback: T): T {
  const data = response?.data
  return (data === undefined || data === null ? fallback : data) as T
}

export async function fetchPartners(): Promise<Partner[]> {
  const res = await apiClient.get<Partner[]>('/api/partners')
  return unwrap(res, [])
}

export async function fetchPartner(id: number | string): Promise<Partner> {
  const res = await apiClient.get<Partner>(`/api/partners/${id}`)
  return unwrap(res, null as unknown as Partner)
}

export async function fetchTemplates(
  partnerId: number | string
): Promise<PartnerDeliveryTemplate[]> {
  const res = await apiClient.get<PartnerDeliveryTemplate[]>(
    `/api/partners/${partnerId}/templates`
  )
  return unwrap(res, [])
}

export async function saveTemplate(
  partnerId: number | string,
  weekday: number,
  items: TemplateItem[]
): Promise<PartnerDeliveryTemplate> {
  const res = await apiClient.put<PartnerDeliveryTemplate>(
    `/api/partners/${partnerId}/templates/${weekday}`,
    { items }
  )
  return unwrap(res, null as unknown as PartnerDeliveryTemplate)
}

export async function fetchVisits(
  partnerId: number | string,
  range: { from?: string; to?: string } = {}
): Promise<PartnerVisit[]> {
  const params = new URLSearchParams()
  if (range.from) params.set('from', range.from)
  if (range.to) params.set('to', range.to)
  const query = params.toString()
  const res = await apiClient.get<PartnerVisit[]>(
    `/api/partners/${partnerId}/visits${query ? `?${query}` : ''}`
  )
  return unwrap(res, [])
}

export async function fetchToday(
  partnerId: number | string,
  businessDate?: string
): Promise<DayDetail & { visits: PartnerVisit[] }> {
  const query = businessDate ? `?date=${businessDate}` : ''
  const res = await apiClient.get<DayDetail & { visits: PartnerVisit[] }>(
    `/api/partners/${partnerId}/visits/today${query}`
  )
  return unwrap(res, {
    businessDate: businessDate ?? null,
    isOpen: true,
    timeline: [],
    visits: [],
    totals: null as never,
    byProduct: [],
  })
}

export async function createVisit(
  partnerId: number | string,
  payload: VisitPayload
): Promise<PartnerVisit> {
  const res = await apiClient.post<PartnerVisit>(
    `/api/partners/${partnerId}/visits`,
    payload
  )
  return unwrap(res, null as unknown as PartnerVisit)
}

export async function updateVisit(
  partnerId: number | string,
  visitId: number,
  payload: Partial<VisitPayload>
): Promise<PartnerVisit> {
  const res = await apiClient.patch<PartnerVisit>(
    `/api/partners/${partnerId}/visits/${visitId}`,
    payload
  )
  return unwrap(res, null as unknown as PartnerVisit)
}

export async function deleteVisit(
  partnerId: number | string,
  visitId: number
): Promise<void> {
  await apiClient.delete(`/api/partners/${partnerId}/visits/${visitId}`)
}

export async function fetchStats(
  partnerId: number | string,
  range: { from: string; to: string }
): Promise<PartnerStats> {
  const res = await apiClient.get<PartnerStats>(
    `/api/partners/${partnerId}/stats?from=${range.from}&to=${range.to}`
  )
  return unwrap(res, null as unknown as PartnerStats)
}

/** URL des CSV-Exports - wird als Download-Link verwendet, nicht gefetcht. */
export function reportCsvUrl(
  partnerId: number | string,
  range: { from: string; to: string }
): string {
  const base =
    (typeof process !== 'undefined' && process.env['NEXT_PUBLIC_API_URL']) ||
    'http://localhost:5000'
  return `${base.replace(
    /\/$/,
    ''
  )}/api/partners/${partnerId}/report.csv?from=${range.from}&to=${range.to}`
}
