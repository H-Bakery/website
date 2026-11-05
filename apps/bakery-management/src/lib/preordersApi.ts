/**
 * Getippter Client für `/api/preorders` (B7) - Erfassung (P1), Liste und
 * Tagesübersicht (P3), später die Abholliste (P2).
 *
 * Kapselt `apiClient`, damit keine Seite Endpunkt-Strings dupliziert (wie
 * `partnerApi.ts`). Die API antwortet mit `{ success, data }`; `apiClient`
 * wirft bei nicht-2xx einen `ApiError` mit der deutschen `message` und dem
 * Maschinen-Code `code` (`invalid_quantity`, `already_picked_up`,
 * `variant_required`, …) - die Seiten zeigen `message` an und können auf
 * `code` reagieren (`preorderErrorCode`).
 */

import { apiClient } from '@bakery/shared/data-access'
import type {
  CatalogueProduct,
  PickupPoint,
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
 * Ändert eine Vorbestellung (teilweise). Positionen ersetzen die bisherigen;
 * bestehende Positionen behalten ihren Preis-Snapshot. Ändern sich Tag oder
 * Ort, vergibt der Server einen neuen Code.
 */
export async function updatePreorder(
  id: number | string,
  patch: Partial<PreorderInput>
): Promise<Preorder> {
  const res = await apiClient.patch<Preorder>(idPath(id), patch)
  return unwrap(res, null as unknown as Preorder)
}

export async function changePreorderStatus(
  id: number | string,
  change: PreorderStatusChange
): Promise<Preorder> {
  const res = await apiClient.post<Preorder>(`${idPath(id)}/status`, change)
  return unwrap(res, null as unknown as Preorder)
}

/** Storniert - gelöscht wird nie. */
export async function cancelPreorder(id: number | string): Promise<Preorder> {
  const res = await apiClient.post<Preorder>(`${idPath(id)}/cancel`, {})
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

export async function fetchPreorderDay(date: string): Promise<PreorderDay> {
  const res = await apiClient.get<PreorderDay>(
    `${BASE}/day?date=${encodeURIComponent(date)}`
  )
  return unwrap(res, null as unknown as PreorderDay)
}

export async function fetchPickupPoints(): Promise<PickupPoint[]> {
  const res = await apiClient.get<PickupPoint[]>(`${BASE}/pickup-points`)
  return unwrap(res, [])
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

/** Deutsche Meldung eines Fehlers, sonst `fallback`. */
export function preorderErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
