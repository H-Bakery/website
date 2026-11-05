/**
 * Produkte der Verwaltung - aus der API (F4), nicht mehr aus dem Dateisystem.
 *
 * Bis F4 las die Produktliste `hq/products` beim `next build` (statische
 * Seite, `generateStaticParams`): auf der Box fror das den Stand des Builds
 * ein, ein neu angelegtes Produkt hatte bis zum nächsten Deploy keine
 * Bearbeiten-Seite, und eine Änderung, die noch auf Freigabe wartet (D6),
 * war unsichtbar. Jetzt lesen Liste und Bearbeiten `GET /api/hq-products[/:id]`
 * - den Stand im Schreib-Worktree, auf dem ein `PUT` aufbaut, mit
 * `pendingApproval` und dem freigegebenen Stand als `approved` (B5).
 * Nicht auf `/api/products` umstellen: das ist der freigegebene Stand, und
 * das Formular schickt alle Felder - das zweite Speichern überschriebe die
 * wartende Änderung mit den alten Werten.
 */

import { apiClient, ApiError } from '@bakery/shared/data-access'

/** Ein Produkt, wie `/api/hq-products` es liefert (`HQProduct` der API). */
export interface ApiHqProduct {
  id: string
  numeric_id?: number
  name: string
  category: string
  price: number | string
  available?: boolean
  seasonal?: boolean
  image?: string | null
  short_description?: string
  description?: string
  pendingApproval?: boolean
  /** Freigegebener Stand, nur bei wartenden Produkten; `null` = neu. */
  approved?: ApiHqProduct | null
}

export const CATEGORY_LABELS: Record<string, string> = {
  brot: 'Brot',
  broetchen: 'Brötchen',
  baguette: 'Baguette',
  teilchen: 'Teilchen',
  snacks: 'Snacks',
  kuchen: 'Kuchen',
  torten: 'Torten',
}

const CATEGORY_FALLBACK_IMAGE: Record<string, string> = {
  brot: '/assets/images/products/brot-rund.svg',
  broetchen: '/assets/images/products/broetchen.svg',
  baguette: '/assets/images/products/baguette.svg',
  teilchen: '/assets/images/products/croissant.svg',
  snacks: '/assets/images/products/brezel.svg',
  kuchen: '/assets/images/products/kuchen.svg',
  torten: '/assets/images/products/kuchen.svg',
}

/**
 * Bild für die Anzeige: der Pfad aus der Datei, wenn er brauchbar ist (manche
 * hq-Dateien tragen den Platzhalter `images/`), sonst das Kategoriebild.
 */
export function displayImage(
  raw: string | null | undefined,
  category: string
): string | null {
  if (raw && raw !== 'images/' && raw.length > 10) return raw
  return CATEGORY_FALLBACK_IMAGE[category] || null
}

export type ProductStatus = 'active' | 'seasonal' | 'unavailable'

/** Freigegebener Stand eines wartenden Produkts (für den Hinweis). */
export interface ApprovedProductState {
  name: string
  price: number
  status: ProductStatus
}

export interface ManagementProduct {
  id: string
  name: string
  category: string
  categoryKey: string
  price: number
  status: ProductStatus
  image: string | null
  rawImage: string
  /** One-liner for list/teaser views (frontmatter `short_description`). */
  shortDescription: string
  /** Full body text of the product file. */
  description: string
  /** Weicht vom freigegebenen Stand ab - „wartet auf Freigabe" (D6, B5). */
  pendingApproval: boolean
  /** Freigegebener Stand, wenn wartend; `null` bei einem neuen Produkt. */
  approved: ApprovedProductState | null
}

function toPrice(value: unknown): number {
  const price = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(price) ? price : 0
}

function statusOf(product: {
  available?: boolean
  seasonal?: boolean
}): ProductStatus {
  if (product.available === false) return 'unavailable'
  return product.seasonal ? 'seasonal' : 'active'
}

export function toManagementProduct(product: ApiHqProduct): ManagementProduct {
  const categoryKey = String(product.category ?? '')
  const rawImage = typeof product.image === 'string' ? product.image : ''
  const approved = product.approved
  return {
    id: String(product.id),
    name: String(product.name ?? ''),
    category: CATEGORY_LABELS[categoryKey] || categoryKey,
    categoryKey,
    price: toPrice(product.price),
    status: statusOf(product),
    image: displayImage(rawImage, categoryKey),
    rawImage,
    shortDescription: product.short_description ?? '',
    description: product.description ?? '',
    pendingApproval: product.pendingApproval === true,
    approved:
      product.pendingApproval === true && approved
        ? {
            name: String(approved.name ?? ''),
            price: toPrice(approved.price),
            status: statusOf(approved),
          }
        : null,
  }
}

/** Alle Produkte für die Verwaltung (Schreib-Worktree, inkl. neuer). */
export async function fetchManagementProducts(): Promise<ManagementProduct[]> {
  const res = await apiClient.get<ApiHqProduct[]>('/api/hq-products')
  const list = Array.isArray(res?.data) ? res.data : []
  return list.map(toManagementProduct)
}

/** Ein Produkt; `null`, wenn die API 404 antwortet. */
export async function fetchManagementProduct(
  id: string
): Promise<ManagementProduct | null> {
  try {
    const res = await apiClient.get<ApiHqProduct>(
      `/api/hq-products/${encodeURIComponent(id)}`
    )
    return res?.data ? toManagementProduct(res.data) : null
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export const PENDING_APPROVAL_LABEL = 'wartet auf Freigabe'

/** Text für den Hinweis an einem wartenden Produkt (deutsch). */
export function pendingApprovalHint(product: ManagementProduct): string {
  if (!product.pendingApproval) return ''
  if (!product.approved) {
    return 'Neues Produkt - erscheint im Shop und in Vorbestellungen erst nach der Freigabe.'
  }
  const price = product.approved.price.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  })
  return `Diese Änderung wartet auf Freigabe. Bis dahin gilt der freigegebene Stand: ${product.approved.name}, ${price}.`
}
