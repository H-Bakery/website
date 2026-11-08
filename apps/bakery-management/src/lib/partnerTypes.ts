/**
 * Typen und Hilfsfunktionen für Verkaufspartner.
 *
 * Bewusst frei von `fs`/`path`: diese Datei wird sowohl von Server- als auch
 * von Client-Komponenten importiert. Der Katalog-Loader steht in `partners.ts`.
 */

export type SettlementModel = 'commission' | 'firm_sale'
export type VisitType = 'initial' | 'refill' | 'pickup'

export interface Partner {
  id: number
  name: string
  slug: string
  street: string
  zip: string
  city: string
  contactName: string | null
  phone: string | null
  email: string | null
  /** ISO-Wochentage, 1 = Montag … 7 = Sonntag. CAP-Markt: [2,3,4,5,6] */
  deliveryDays: number[]
  settlementModel: SettlementModel
  active: boolean
  notes: string | null
}

export interface TemplateItem {
  productId: number
  productSlug: string
  quantity: number
}

export interface PartnerDeliveryTemplate {
  id: number
  partnerId: number
  weekday: number
  items: TemplateItem[]
  active: boolean
}

export interface PartnerVisitItem {
  id?: number
  productId: number
  productSlug: string
  /** Snapshot des Produktnamens zum Zeitpunkt des Besuchs. */
  productName: string
  /** Snapshot des HQ-Preises - hält Altberichte korrekt, wenn sich Preise ändern. */
  unitPrice: number
  /** Vorgefundener Restbestand. `null` = nicht gezählt. */
  countedQty: number | null
  deliveredQty: number
}

export interface PartnerVisit {
  id: number
  partnerId: number
  /** Geschäftstag `YYYY-MM-DD` - Gruppierungsschlüssel aller Auswertungen. */
  businessDate: string
  visitAt: string
  visitType: VisitType
  sequence: number
  staffId: number | null
  staffName: string | null
  note: string | null
  items: PartnerVisitItem[]
  createdAt?: string
  updatedAt?: string
}

export interface VisitPayload {
  businessDate?: string
  visitAt?: string
  visitType: VisitType
  staffName?: string | null
  note?: string | null
  items: Array<{
    productId: number
    productSlug: string
    productName?: string
    unitPrice?: number
    countedQty: number | null
    deliveredQty: number
  }>
}

/** Ein Produkt, wie es die Erfassungsmaske braucht - aus `hq/products/*.md`. */
export interface CatalogueProduct {
  /** Numerische HQ-ID (`numeric_id`). */
  productId: number
  /** HQ-`id`, stabil gegen Umnummerierung. */
  productSlug: string
  productName: string
  unitPrice: number
  category: string
  categoryLabel: string
  available: boolean
}

export interface ProductStat {
  productId: number
  productSlug: string
  productName: string
  /** Jüngster Preis-Snapshot im Zeitraum. */
  unitPrice: number
  /** Kleinster/größter Preis im Zeitraum - ungleich: Preis hat sich geändert. */
  unitPriceMin?: number
  unitPriceMax?: number
  deliveredQty: number
  soldQty: number
  returnedQty: number
  /** Mehr gezählt, als im Schrank sein konnte - weder Verkauf noch Retoure. */
  discrepancyQty: number
  /** Bei der Abholung nicht gezählt - weder verkauft noch Retoure. */
  uncountedQty?: number
  /** An Tagen ohne Abholung noch im Schrank (W4-verify r5). */
  openQty?: number
  revenue: number
  returnValue: number
  /** Nur über Tage mit Abholung; ältere Server rechneten alle Tage. */
  sellThroughRate: number | null
}

export interface DayStat {
  businessDate: string
  weekday: number | null
  /** Kein `pickup`-Besuch erfasst - Verkauf und Umsatz sind vorläufig. */
  isOpen: boolean
  /** `false`: die Abholung hat nicht jedes Produkt mit Bestand gezählt. */
  isComplete?: boolean
  visitCount: number
  refillCount: number
  deliveredQty: number
  soldQty: number
  returnedQty: number
  discrepancyQty: number
  uncountedQty?: number
  /** Offener Tag: was noch im Schrank liegt; die Quote ist dann `null`. */
  openQty?: number
  revenue: number
  returnValue: number
  sellThroughRate: number | null
}

export interface WeekdayStat {
  weekday: number
  weekdayLabel: string
  dayCount: number
  openDayCount: number
  /** `null`, wenn alle Tage dieses Wochentags noch offen sind. */
  avgDeliveredQty: number | null
  avgSoldQty: number | null
  avgReturnedQty: number | null
  avgRevenue: number | null
  sellThroughRate: number | null
}

export interface PartnerStats {
  range: { from: string | null; to: string | null }
  totals: {
    dayCount: number
    openDayCount: number
    incompleteDayCount?: number
    visitCount: number
    refillCount: number
    deliveredQty: number
    soldQty: number
    returnedQty: number
    discrepancyQty: number
    uncountedQty?: number
    /** Lieferungen offener Tage, die noch im Schrank liegen. */
    openQty?: number
    revenue: number
    returnValue: number
    /** Quoten nur über Tage mit Abholung (W4-verify r5). */
    sellThroughRate: number | null
    returnRate: number | null
  }
  /** Ein Tag ohne Abholung oder mit unvollständiger Abholung - Zahlen sind vorläufig. */
  isProvisional: boolean
  openDates: string[]
  /** Abgeschlossene Tage, deren Abholung nicht jedes Produkt mit Bestand gezählt hat. */
  incompleteDates?: string[]
  byProduct: ProductStat[]
  byDay: DayStat[]
  byWeekday: WeekdayStat[]
}

export interface TimelineItem {
  productId: number
  productSlug: string
  productName: string
  unitPrice: number
  countedQty: number | null
  deliveredQty: number
  soldSinceLastQty: number
  stockAfterQty: number
}

export interface TimelineEntry {
  visitId: number
  visitType: VisitType
  visitAt: string
  sequence: number
  staffName: string | null
  note: string | null
  countedQty: number
  deliveredQty: number
  soldSinceLastQty: number
  soldSinceLastRevenue: number
  stockAfterQty: number
  items: TimelineItem[]
}

export interface UncountedProduct {
  productId: number
  productSlug: string
  productName: string
  /** Erwarteter Bestand, der bei der Abholung nicht gezählt wurde. */
  stockQty: number
}

export interface DayDetail {
  businessDate: string | null
  isOpen: boolean
  /** `false`: die Abholung hat nicht jedes Produkt mit Bestand gezählt. */
  isComplete?: boolean
  uncountedQty?: number
  uncountedProducts?: UncountedProduct[]
  timeline: TimelineEntry[]
  totals: PartnerStats['totals']
  byProduct: ProductStat[]
}

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  initial: 'Erstbestückung',
  refill: 'Nachlieferung',
  pickup: 'Abholung',
}

export const VISIT_TYPE_DESCRIPTIONS: Record<VisitType, string> = {
  initial: 'Erste Bestückung des Backschranks am Morgen',
  refill: 'Nachfüllen im Tagesverlauf',
  pickup: 'Abholung der Reste - schließt den Geschäftstag ab',
}

export const VISIT_TYPE_COLORS: Record<
  VisitType,
  'primary' | 'info' | 'success'
> = {
  initial: 'primary',
  refill: 'info',
  pickup: 'success',
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
}

export const WEEKDAY_SHORT: Record<number, string> = {
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
  7: 'So',
}

/**
 * Reihenfolge der Kategorien in der Erfassungsmaske - wie die Ware im
 * Backschrank steht: erst Brot, dann Brötchen, dann Süßes.
 */
export const CATEGORY_ORDER = [
  'brot',
  'broetchen',
  'baguette',
  'teilchen',
  'snacks',
  'kuchen',
  'torten',
]

export function categoryRank(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category)
  return index === -1 ? CATEGORY_ORDER.length : index
}

/** Geschäftstag (`YYYY-MM-DD`) eines Zeitpunkts, in lokaler Zeit. */
export function toBusinessDate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Ist `value` ein echter Geschäftstag (`YYYY-MM-DD`, existierender Kalendertag)?
 *
 * Nur das Muster zu prüfen reicht nicht: `2026-13-45` sieht wie ein Datum aus,
 * `new Date()` würde es aber stillschweigend auf den 14.02.2027 umrechnen und
 * die Seite einen Tag anzeigen, der nie angefragt wurde.
 */
export function isBusinessDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [y, m, d] = value.split('-').map(Number)
  return toBusinessDate(new Date(y, m - 1, d)) === value
}

/** ISO-Wochentag (1 = Mo … 7 = So) eines `YYYY-MM-DD`-Strings. */
export function weekdayOf(businessDate: string): number | null {
  const parts = businessDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  if (Number.isNaN(d.getTime())) return null
  const js = d.getDay()
  return js === 0 ? 7 : js
}

/** `1 Besuch`, `2 Besuche` - Zahl im deutschen Format. */
export function plural(
  count: number | null | undefined,
  one: string,
  many: string
): string {
  const n = count == null || !Number.isFinite(count) ? 0 : count
  return `${n.toLocaleString('de-DE')} ${n === 1 ? one : many}`
}

/**
 * Einzelpreis einer Report-Zeile; hat sich der Preis im Zeitraum geändert,
 * die Spanne (`1,60–1,80 €`), damit Einzelpreis × Verkauft nicht scheinbar
 * vom Umsatz abweicht.
 */
export function formatUnitPrice(p: {
  unitPrice: number
  unitPriceMin?: number
  unitPriceMax?: number
}): string {
  const min = p.unitPriceMin ?? p.unitPrice
  const max = p.unitPriceMax ?? p.unitPrice
  if (min === max) return formatCurrency(p.unitPrice)
  return `${formatCurrency(min).replace(/\s*€$/, '')}–${formatCurrency(max)}`
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '–'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export function formatPercent(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return '–'
  return `${new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 1,
  }).format(rate * 100)} %`
}

export function formatDate(businessDate: string): string {
  const parts = businessDate.split('-').map(Number)
  if (parts.length !== 3) return businessDate
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  if (Number.isNaN(d.getTime())) return businessDate
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

/** `YYYY-MM-DDTHH:mm` für `<input type="datetime-local">`, in lokaler Zeit. */
export function toDateTimeLocal(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${toBusinessDate(date)}T${h}:${min}`
}

/** Verschiebt ein `YYYY-MM-DD` um `days` Tage. */
export function shiftDate(businessDate: string, days: number): string {
  const parts = businessDate.split('-').map(Number)
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  d.setDate(d.getDate() + days)
  return toBusinessDate(d)
}
