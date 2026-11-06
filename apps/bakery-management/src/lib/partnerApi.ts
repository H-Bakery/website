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

/** Antwort der API auf `DELETE …/visits/:id` (B6): 200, nicht 204. */
export interface DeletedVisit {
  id: number
  deleted: boolean
  message: string
}

/**
 * Löscht einen Besuch. Die echte API antwortet 200
 * `{ id, deleted: true, message: 'Besuch gelöscht.' }`; der Mock früher 204
 * ohne Body - dann gilt der Standardtext.
 */
export async function deleteVisit(
  partnerId: number | string,
  visitId: number
): Promise<DeletedVisit> {
  const res = await apiClient.delete<Partial<DeletedVisit>>(
    `/api/partners/${partnerId}/visits/${visitId}`
  )
  const data =
    res && typeof res.data === 'object' && res.data !== null ? res.data : {}
  return {
    id: typeof data.id === 'number' ? data.id : visitId,
    deleted: data.deleted !== false,
    message:
      typeof data.message === 'string' && data.message
        ? data.message
        : typeof res?.message === 'string' &&
          res.message &&
          res.message !== 'Request successful'
        ? res.message
        : 'Besuch gelöscht.',
  }
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

/** Dateiname des CSV-Exports, wenn der Server keinen nennt. */
export function reportCsvFileName(range: { from: string; to: string }): string {
  return `partner-report-${range.from}-bis-${range.to}.csv`
}

/**
 * CSV-Export des Partner-Reports (F4). Die echte API schützt jede Route mit
 * einer Sitzung - ein schlichter Link trüge kein `Authorization` und bekäme
 * 401. Deshalb `fetch` mit Token (`apiClient.getBlob`, inkl. Refresh bei 401)
 * und Download über eine Blob-URL. Fehler kommen als `ApiError` mit der
 * deutschen `message` der API.
 */
export async function downloadReportCsv(
  partnerId: number | string,
  range: { from: string; to: string },
  save: (blob: Blob, fileName: string) => void = saveBlob
): Promise<void> {
  const params = new URLSearchParams({ from: range.from, to: range.to })
  const { blob, filename } = await apiClient.getBlob(
    `/api/partners/${encodeURIComponent(
      String(partnerId)
    )}/report.csv?${params.toString()}`
  )
  save(blob, filename || reportCsvFileName(range))
}

/** Bietet einen Blob als Download an (unsichtbarer Link, danach aufräumen). */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Manche Browser lesen die URL erst nach dem Klick-Handler.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
