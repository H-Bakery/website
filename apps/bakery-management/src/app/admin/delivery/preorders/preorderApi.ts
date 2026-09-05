/**
 * Client-seitiger Zugriff auf die Vorbestell-Endpunkte der Liefer-API.
 *
 * Kapselt `apiClient`, damit die Seiten keine Endpunkt-Strings duplizieren -
 * dasselbe Muster wie `lib/partnerApi.ts`. Die Liefer-Endpunkte antworten mit
 * rohen Objekten; `apiClient` verpackt sie trotzdem in `{ success, data }`,
 * deshalb hier wieder auspacken. Bei nicht-2xx wirft `apiClient` eine `Error`
 * mit der deutschen `message` aus dem Body - die Aufrufer zeigen sie an.
 */

import { apiClient } from '@bakery/shared/data-access'
import {
  PickupPoint,
  PickupPointPayload,
  Preorder,
  PreorderPayload,
  PreorderProduct,
  PreorderStatus,
  PreorderSummary,
} from './preorderTypes'

function unwrap<T>(response: { data?: T } | undefined, fallback: T): T {
  const data = response?.data
  return (data === undefined || data === null ? fallback : data) as T
}

/** Produkt aus `GET /api/products`, so wie `hq` es liefert. */
interface HQProduct {
  id: string
  name: string
  category?: string
  price?: number | string
  available?: boolean
}

export async function fetchPickupPoints(): Promise<PickupPoint[]> {
  const res = await apiClient.get<PickupPoint[]>(
    '/api/deliveries/pickup-points'
  )
  return unwrap(res, [])
}

export async function savePickupPoint(
  id: string,
  payload: PickupPointPayload
): Promise<PickupPoint> {
  const res = await apiClient.put<PickupPoint>(
    `/api/deliveries/pickup-points/${encodeURIComponent(id)}`,
    payload
  )
  return unwrap(res, null as unknown as PickupPoint)
}

export async function fetchPreorders(query: {
  date?: string
  pickupPointId?: string
  status?: PreorderStatus
}): Promise<Preorder[]> {
  const params = new URLSearchParams()
  if (query.date) params.set('date', query.date)
  if (query.pickupPointId) params.set('pickupPointId', query.pickupPointId)
  if (query.status) params.set('status', query.status)
  const search = params.toString()
  const res = await apiClient.get<Preorder[]>(
    `/api/deliveries/preorders${search ? `?${search}` : ''}`
  )
  return unwrap(res, [])
}

export async function fetchPreorderSummary(
  date: string,
  pickupPointId?: string
): Promise<PreorderSummary> {
  const params = new URLSearchParams({ date })
  if (pickupPointId) params.set('pickupPointId', pickupPointId)
  const res = await apiClient.get<PreorderSummary>(
    `/api/deliveries/preorders/summary?${params.toString()}`
  )
  return unwrap(res, null as unknown as PreorderSummary)
}

export async function fetchPreorder(id: number | string): Promise<Preorder> {
  const res = await apiClient.get<Preorder>(`/api/deliveries/preorders/${id}`)
  return unwrap(res, null as unknown as Preorder)
}

export async function createPreorder(
  payload: PreorderPayload
): Promise<Preorder> {
  const res = await apiClient.post<Preorder>(
    '/api/deliveries/preorders',
    payload
  )
  return unwrap(res, null as unknown as Preorder)
}

export async function updatePreorder(
  id: number | string,
  payload: Partial<PreorderPayload>
): Promise<Preorder> {
  const res = await apiClient.patch<Preorder>(
    `/api/deliveries/preorders/${id}`,
    payload
  )
  return unwrap(res, null as unknown as Preorder)
}

/**
 * Storniert eine Vorbestellung. Gelöscht wird nichts: sie ist die einzige
 * Aufzeichnung dessen, was jemand bestellt hat, und bleibt durchgestrichen
 * in der Liste stehen.
 */
export async function cancelPreorder(id: number | string): Promise<Preorder> {
  const res = await apiClient.delete<Preorder>(
    `/api/deliveries/preorders/${id}`
  )
  return unwrap(res, null as unknown as Preorder)
}

/**
 * Sortiment für die Erfassungsmaske: alles, was `hq` als verfügbar und mit
 * Preis führt. Bestellbar ist nur, was auch verkauft wird.
 */
export async function fetchAvailableProducts(): Promise<PreorderProduct[]> {
  const res = await apiClient.get<HQProduct[]>('/api/products')
  const products = unwrap(res, [] as HQProduct[])
  return products
    .filter((product) => product && product.id && product.available !== false)
    .map((product) => ({
      productId: String(product.id),
      name: String(product.name ?? product.id),
      price: Number(product.price),
      category: String(product.category ?? ''),
    }))
    .filter((product) => Number.isFinite(product.price))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
}
