/**
 * Getippter Client für `/api/preorders` (B7) - Erfassung (P1), Liste und
 * Tagesübersicht (P3), Abholliste und Mörsbach-Seiten (P2).
 *
 * Kapselt `apiClient`, damit keine Seite Endpunkt-Strings dupliziert (wie
 * `partnerApi.ts`). Die API antwortet mit `{ success, data }`; `apiClient`
 * wirft bei nicht-2xx einen `ApiError` mit der deutschen `message` und dem
 * Maschinen-Code `code` (`invalid_quantity`, `already_picked_up`,
 * `variant_required`, …) - die Seiten zeigen `message` an und können auf
 * `code` reagieren (`preorderErrorCode`).
 */

import { apiClient } from '@bakery/shared/data-access'
import { ALL_DAYS_PARAM, ALL_DAYS_VALUE } from './preordersTypes'
import type {
  CatalogueProduct,
  PickupPoint,
  PickupPointInput,
  Preorder,
  PreorderDay,
  PreorderInput,
  PreorderListFilters,
  PreorderStatusChange,
  PreorderSums,
  PreorderVariants,
} from './preordersTypes'

const BASE = '/api/preorders'

function unwrap<T>(response: { data?: T } | undefined, fallback: T): T {
  const data = response?.data
  return (data === undefined || data === null ? fallback : data) as T
}

function idPath(id: number | string): string {
  return `${BASE}/${encodeURIComponent(String(id))}`
}

/** Query-String der Listenfilter (leere Werte fallen weg). */
export function preorderListQuery(filters: PreorderListFilters = {}): string {
  const params = new URLSearchParams()
  if (filters.date) params.set('date', filters.date)
  else {
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
  }
  if (filters.status && filters.status.length > 0) {
    params.set('status', filters.status.join(','))
  }
  if (filters.channel) params.set('channel', filters.channel)
  if (filters.pickupPointId) params.set('pickupPointId', filters.pickupPointId)
  const q = filters.q?.trim()
  if (q) params.set('q', q)
  return params.toString()
}

/**
 * Query-String der Listen-*Seite*: wie `preorderListQuery`, ohne Zeitraum
 * aber mit `range=alle` - sonst läse `filtersFromQuery` „Alle Tage“ nach dem
 * Neuladen als „keine Filter“ und zeigte wieder „ab heute“.
 */
export function preorderPageQuery(filters: PreorderListFilters = {}): string {
  const query = preorderListQuery(filters)
  if (filters.date || filters.from || filters.to) return query
  const marker = `${ALL_DAYS_PARAM}=${ALL_DAYS_VALUE}`
  return query ? `${query}&${marker}` : marker
}

export async function listPreorders(
  filters: PreorderListFilters = {}
): Promise<Preorder[]> {
  const query = preorderListQuery(filters)
  const res = await apiClient.get<Preorder[]>(
    `${BASE}${query ? `?${query}` : ''}`
  )
  return unwrap(res, [])
}

export async function getPreorder(id: number | string): Promise<Preorder> {
  const res = await apiClient.get<Preorder>(idPath(id))
  return unwrap(res, null as unknown as Preorder)
}

export async function createPreorder(input: PreorderInput): Promise<Preorder> {
  const res = await apiClient.post<Preorder>(BASE, input)
  return unwrap(res, null as unknown as Preorder)
}

/**
 * Code, wenn ein wiederholtes Speichern (gleiche `requestId`) anderes
 * enthält als die Bestellung, die der erste Versuch schon angelegt hat
 * (W4-Verifikation Runde 5) - die Maske wurde nach dem unklaren Versuch
 * geändert. Nichts wurde gespeichert; die Antwort nennt die Bestellung.
 */
export const REQUEST_ID_CHANGED = 'request_id_changed'

export interface EarlierPreorderRef {
  id: number
  code: string
  updatedAt: string | null
}

/** Die schon angelegte Bestellung aus einem `request_id_changed`, sonst `null`. */
export function requestIdChangedTarget(
  error: unknown
): EarlierPreorderRef | null {
  if (preorderErrorCode(error) !== REQUEST_ID_CHANGED) return null
  const ref = (error as { details?: { preorder?: unknown } } | null)?.details
    ?.preorder as Partial<EarlierPreorderRef> | undefined
  if (!ref || typeof ref.id !== 'number' || typeof ref.code !== 'string') {
    return null
  }
  return {
    id: ref.id,
    code: ref.code,
    updatedAt: typeof ref.updatedAt === 'string' ? ref.updatedAt : null,
  }
}

/**
 * Maschinen-Code, wenn eine Vorbestellung seit dem Laden an anderer Stelle
 * geändert wurde (`expectedUpdatedAt` passt nicht mehr) - die Seite lädt
 * dann neu, statt die fremde Änderung zu überschreiben.
 */
export const STALE_PREORDER = 'stale_preorder'

/**
 * `true`, wenn der Fehler heißt: die geladene Fassung ist überholt. Dazu
 * zählen neben `stale_preorder` die Sperren, die nur eine veraltete Maske
 * auslösen kann (inzwischen abgeholt oder storniert).
 */
export function isPreorderConflict(error: unknown): boolean {
  const code = preorderErrorCode(error)
  return (
    code === STALE_PREORDER ||
    code === 'already_picked_up' ||
    code === 'cancelled'
  )
}

/** `expectedUpdatedAt` nur mitschicken, wenn die geladene Fassung einen hat. */
function versioned<T extends object>(
  body: T,
  expectedUpdatedAt: string | null | undefined
): T & { expectedUpdatedAt?: string } {
  return expectedUpdatedAt ? { ...body, expectedUpdatedAt } : body
}

/**
 * Ändert eine Vorbestellung (teilweise - nur die mitgeschickten Felder).
 * Positionen ersetzen die bisherigen; bestehende Positionen behalten ihren
 * Preis-Snapshot. Ändern sich Tag oder Ort, vergibt der Server einen neuen
 * Code. Mit `expectedUpdatedAt` (der `updatedAt` der geladenen Fassung)
 * antwortet der Server 409 `stale_preorder`, wenn sie inzwischen geändert
 * wurde.
 */
export async function updatePreorder(
  id: number | string,
  patch: Partial<PreorderInput>,
  expectedUpdatedAt?: string | null
): Promise<Preorder> {
  const res = await apiClient.patch<Preorder>(
    idPath(id),
    versioned(patch, expectedUpdatedAt)
  )
  return unwrap(res, null as unknown as Preorder)
}

export async function changePreorderStatus(
  id: number | string,
  change: PreorderStatusChange,
  expectedUpdatedAt?: string | null
): Promise<Preorder> {
  const res = await apiClient.post<Preorder>(
    `${idPath(id)}/status`,
    versioned(change, expectedUpdatedAt)
  )
  return unwrap(res, null as unknown as Preorder)
}

/** Ergebnis einer Bestellung in `POST /api/preorders/bulk-status` (W4). */
export type BulkStatusOutcome =
  | 'ok'
  | 'conflict'
  | 'anonymized'
  | 'not_found'
  | 'refused'

export interface BulkStatusResult {
  id: number
  result: BulkStatusOutcome
  /** Maschinen-Code bei Fehlschlag (`stale_preorder`, `forbidden`, …). */
  error?: string
  message?: string
  /** Fassung nach dem Schreiben (`ok`) bzw. aktuelle Fassung (Konflikt). */
  data?: Preorder
}

export interface BulkStatusAnswer {
  counts: Record<BulkStatusOutcome, number>
  results: BulkStatusResult[]
}

/**
 * Mehrere Bestellungen auf einmal umstellen (Abholliste: „alle bereit“,
 * Tagesabschluss) - **eine** Schreib-Transaktion auf dem Server, Ergebnis
 * je Bestellung. `versions` = `updatedAt` der geladenen Fassungen; wer
 * seither woanders geändert wurde, kommt als `conflict` zurück und bleibt
 * unberührt.
 */
export async function bulkPreorderStatus(
  preorders: Pick<Preorder, 'id' | 'updatedAt'>[],
  change: PreorderStatusChange
): Promise<BulkStatusAnswer> {
  const expectedUpdatedAt: Record<string, string> = {}
  for (const p of preorders) {
    if (p.updatedAt) expectedUpdatedAt[String(p.id)] = p.updatedAt
  }
  const res = await apiClient.post<BulkStatusAnswer>(`${BASE}/bulk-status`, {
    ids: preorders.map((p) => p.id),
    ...change,
    expectedUpdatedAt,
  })
  return unwrap(res, {
    counts: { ok: 0, conflict: 0, anonymized: 0, not_found: 0, refused: 0 },
    results: [],
  })
}

/**
 * Art eines gescheiterten Requests: `offline` (keine Antwort - WLAN,
 * Server aus, Zeitüberschreitung), `server` (5xx, auch Caddys 502-504),
 * `refused` (4xx - die API hat geantwortet und abgelehnt).
 */
export type RequestFailureKind = 'offline' | 'server' | 'refused'

export function requestFailureKind(error: unknown): RequestFailureKind {
  const status = (error as { status?: unknown } | null)?.status
  if (typeof status !== 'number' || status <= 0) return 'offline'
  return status >= 500 ? 'server' : 'refused'
}

/** Storniert - gelöscht wird nie. */
export async function cancelPreorder(
  id: number | string,
  expectedUpdatedAt?: string | null
): Promise<Preorder> {
  const res = await apiClient.post<Preorder>(
    `${idPath(id)}/cancel`,
    versioned({}, expectedUpdatedAt)
  )
  return unwrap(res, null as unknown as Preorder)
}

export async function fetchPreorderSums(
  date: string,
  pickupPointId?: string
): Promise<PreorderSums> {
  const params = new URLSearchParams({ date })
  if (pickupPointId) params.set('pickupPointId', pickupPointId)
  const res = await apiClient.get<PreorderSums>(
    `${BASE}/sums?${params.toString()}`
  )
  return unwrap(res, null as unknown as PreorderSums)
}

/**
 * Tagesübersicht. Mit `pickupPointId` (Sammelstelle oder `laden`) gelten
 * Kopfzahlen, Summen und Liste nur für diesen Abholort (P2 Abholliste,
 * Mörsbach-Seiten); `pickupPoints` bleibt vollständig.
 */
export async function fetchPreorderDay(
  date: string,
  pickupPointId?: string
): Promise<PreorderDay> {
  const params = new URLSearchParams({ date })
  if (pickupPointId) params.set('pickupPointId', pickupPointId)
  const res = await apiClient.get<PreorderDay>(
    `${BASE}/day?${params.toString()}`
  )
  return unwrap(res, null as unknown as PreorderDay)
}

export async function fetchPickupPoints(): Promise<PickupPoint[]> {
  const res = await apiClient.get<PickupPoint[]>(`${BASE}/pickup-points`)
  return unwrap(res, [])
}

/**
 * Maschinen-Code, wenn die Sammelstelle seit dem Laden an anderer Stelle
 * geändert wurde (`expectedUpdatedAt` passt nicht mehr, W4).
 */
export const STALE_PICKUP_POINT = 'stale_pickup_point'

/**
 * Stammdaten einer Sammelstelle ändern (nur Inhaber; keine Adresssuche).
 * Mit `expectedUpdatedAt` (Stand der geladenen Fassung) antwortet der
 * Server 409 `stale_pickup_point`, statt eine zwischenzeitliche Änderung
 * zu überschreiben.
 */
export async function savePickupPoint(
  id: string,
  input: PickupPointInput,
  expectedUpdatedAt?: string | null
): Promise<PickupPoint> {
  const res = await apiClient.put<PickupPoint>(
    `${BASE}/pickup-points/${encodeURIComponent(id)}`,
    versioned(input, expectedUpdatedAt)
  )
  return unwrap(res, null as unknown as PickupPoint)
}

export async function fetchPreorderVariants(): Promise<PreorderVariants> {
  const res = (await apiClient.get<Record<string, string[]>>(
    `${BASE}/variants`
  )) as { data?: Record<string, string[]>; configured?: boolean }
  const products = unwrap(res, {} as Record<string, string[]>)
  return { configured: res?.configured === true, products }
}

/** Produkt aus `GET /api/products`, so wie `hq` es liefert. */
interface HQProduct {
  id: string
  name?: string
  category?: string
  price?: number | string | null
  available?: boolean
  unit?: string
}

/**
 * Bestellbares Sortiment: alles, was `hq` (freigegebener Stand) als verfügbar
 * und mit Preis führt - ohne Preis lehnt der Server die Position ohnehin ab.
 */
export async function fetchCatalogue(): Promise<CatalogueProduct[]> {
  const res = await apiClient.get<HQProduct[]>('/api/products')
  return unwrap(res, [] as HQProduct[])
    .filter((p) => p && p.id && p.available !== false)
    .map((p) => ({
      productId: String(p.id),
      name: String(p.name ?? p.id),
      price:
        p.price === null || p.price === undefined || p.price === ''
          ? NaN
          : Number(p.price),
      category: String(p.category ?? ''),
      unit: String(p.unit ?? 'Stück'),
    }))
    .filter((p) => Number.isFinite(p.price))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

/** Maschinen-Code eines API-Fehlers (`ApiError.code`), sonst `undefined`. */
export function preorderErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : undefined
}

/** Was der Browser bei abgerissener Verbindung meldet (Chrome, Firefox, Safari). */
const NETWORK_FAILURE =
  /^(Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed|Network request failed|Request timeout)$/i
const RAW_HTTP = /^HTTP \d{3}\b/

/** Text, wenn der Server nicht erreicht wurde (wie Abholliste und Backstube). */
export const PREORDER_OFFLINE_TEXT =
  'Keine Verbindung zum Server – bitte WLAN prüfen.'

/**
 * Deutsche Meldung eines Fehlers, sonst `fallback`. Was der Browser oder ein
 * Proxy meldet („Failed to fetch“, „Request timeout“, „HTTP 502: Bad
 * Gateway“), gehört nicht in die Oberfläche (W4-Verifikation Runde 4): ohne
 * Antwort des Servers heißt es „Keine Verbindung …“, bei einem rohen
 * Serverfehler der `fallback` mit Statuscode.
 */
export function preorderErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback
  const status = (error as { status?: unknown }).status
  if (
    (typeof status !== 'number' && NETWORK_FAILURE.test(error.message)) ||
    (error.name === 'TypeError' && typeof status !== 'number') ||
    status === 0
  ) {
    return PREORDER_OFFLINE_TEXT
  }
  if (typeof status === 'number' && RAW_HTTP.test(error.message)) {
    return status >= 502 && status <= 504
      ? PREORDER_OFFLINE_TEXT
      : `${fallback} (Fehler ${status})`
  }
  return error.message
}
