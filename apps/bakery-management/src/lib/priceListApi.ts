/**
 * Preisliste (Export der Produktseite) - Zugriff auf `/api/price-list`.
 *
 * Das Dokument baut die API (`services/price-list.core.js`): Kategorien,
 * Zeilen, Varianten und fertig formatierte Preise. Hier wird nichts
 * gruppiert, sortiert oder formatiert - nur geholt und weitergereicht.
 */
import { apiClient } from '@bakery/shared/data-access'
import { saveBlob } from './partnerApi'

export type PriceListAudience = 'laden' | 'partner'

/** Was im Dialog gewählt wird - und als Query an API und Druckseite geht. */
export interface PriceListOptions {
  audience: PriceListAudience
  /** Nur bei `audience: 'partner'`. */
  partnerId?: number | null
  /** Kategorie-Schlüssel; leer/`null` = ganzes Sortiment. */
  categories?: string[] | null
  /** `YYYY-MM-DD` oder leer. */
  validFrom?: string | null
  includeUnavailable?: boolean
  allergens?: boolean
}

export interface PriceListVariant {
  productId: string
  numericId: number | null
  fullName: string
  /** „500 g“, „Stück“, „klein“ - leer, wenn der Name keine Einheit trägt. */
  label: string
  isWeight: boolean
  grams: number | null
  price: number
  /** „2,50 €“ - so gespeichert, nur auf zwei Stellen aufgefüllt. */
  priceText: string
  unavailable: boolean
  seasonal: boolean
  /** „saisonal“, „derzeit nicht erhältlich“ oder leer. */
  note: string
}

export interface PriceListRow {
  key: string
  name: string
  seasonal: boolean
  unavailable: boolean
  /** `null`, wenn die Liste ohne Allergene erstellt wurde. */
  allergens: { declared: boolean; text: string | null; partial: boolean } | null
  variants: PriceListVariant[]
}

export interface PriceListCategory {
  key: string
  label: string
  count: number
  layout: 'matrix' | 'list'
  /** Nur bei `layout: 'matrix'`: die Gewichts-Spalten. */
  columns?: string[]
  rows: PriceListRow[]
}

export interface PriceListCategoryOption {
  key: string
  label: string
  count: number
}

export interface PriceListDoc {
  status: 'ok' | 'no-data'
  audience: PriceListAudience
  title: string
  generatedOn: string | null
  generatedOnText: string
  validFrom: string | null
  validFromText: string
  options: {
    categories: string[] | null
    includeUnavailable: boolean
    withAllergens: boolean
  }
  partner: {
    id: number | null
    name: string
    street: string
    zip: string
    city: string
    settlementModel: 'commission' | 'firm_sale'
    settlementLabel: string
    assortmentSource: 'templates' | 'visits' | null
  } | null
  availableCategories: PriceListCategoryOption[]
  categories: PriceListCategory[]
  counts: {
    listed: number
    rows: number
    noPrice: number
    hiddenUnavailable: number
    assortment: number | null
  }
  omitted: {
    noPrice: {
      id: string
      name: string
      category: string
      categoryLabel: string
    }[]
  }
  dataWarnings: { id: string; name: string; code: string; message: string }[]
}

/** Query für API und Druckseite - nur, was von der Vorgabe abweicht. */
export function priceListQuery(options: PriceListOptions): string {
  const params = new URLSearchParams()
  if (options.audience === 'partner') {
    params.set('audience', 'partner')
    if (options.partnerId) params.set('partnerId', String(options.partnerId))
  }
  if (options.categories && options.categories.length > 0) {
    params.set('categories', options.categories.join(','))
  }
  if (options.validFrom) params.set('validFrom', options.validFrom)
  if (options.includeUnavailable) params.set('includeUnavailable', '1')
  if (options.allergens) params.set('allergens', '1')
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** Adresse der Druckansicht mit denselben Optionen. */
export function priceListHref(options: PriceListOptions): string {
  return `/admin/products/preisliste${priceListQuery(options)}`
}

type Query = Record<string, string | string[] | undefined>

/** Optionen aus der Adresse der Druckseite (unbekanntes fällt weg). */
export function priceListOptionsFromQuery(query: Query): PriceListOptions {
  const one = (key: string) => {
    const value = query[key]
    return Array.isArray(value) ? value[0] : value
  }
  const partnerId = Number(one('partnerId'))
  const categories = (one('categories') ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
  const validFrom = one('validFrom') ?? ''
  return {
    audience: one('audience') === 'partner' ? 'partner' : 'laden',
    partnerId: Number.isInteger(partnerId) && partnerId > 0 ? partnerId : null,
    categories: categories.length > 0 ? categories : null,
    validFrom: /^\d{4}-\d{2}-\d{2}$/.test(validFrom) ? validFrom : null,
    includeUnavailable: one('includeUnavailable') === '1',
    allergens: one('allergens') === '1',
  }
}

export async function fetchPriceList(
  options: PriceListOptions
): Promise<PriceListDoc> {
  const res = await apiClient.get<PriceListDoc>(
    `/api/price-list${priceListQuery(options)}`
  )
  if (!res?.data) throw new Error('Die Preisliste konnte nicht geladen werden.')
  return res.data
}

/**
 * CSV für Excel (Semikolon, Dezimalkomma, BOM). Über `getBlob`, weil ein
 * schlichter Link kein Token trüge (wie der Partner-Report).
 */
export async function downloadPriceListCsv(
  options: PriceListOptions,
  save: (blob: Blob, fileName: string) => void = saveBlob
): Promise<void> {
  const { blob, filename } = await apiClient.getBlob(
    `/api/price-list/export.csv${priceListQuery(options)}`
  )
  save(blob, filename || 'preisliste.csv')
}

/** Wer die Ladenliste erstellen darf (API: `inhaber`, `verkauf`). */
export function canExportPriceList(role: string | null | undefined): boolean {
  return role === 'inhaber' || role === 'verkauf'
}

/** Die Partnerliste erstellt nur der Inhaber (API: `inhaber`). */
export function canExportPartnerPriceList(
  role: string | null | undefined
): boolean {
  return role === 'inhaber'
}
