/**
 * Verkaufspartner-Kennzahlen - typisierte Fassade über `partner-stats.core.js`.
 *
 * Hier steht bewusst **keine** Formel. Die einzige Implementierung liegt in
 * `partner-stats.core.js` (dependency-freies CommonJS) und wird von dieser
 * Datei, vom Mock-Server (`simple-server.js`) und von den Tests gemeinsam
 * benutzt - so kann keine Kopie auseinanderlaufen.
 *
 * Aufgabe dieser Datei:
 *  1. TypeScript-Typen für Ein- und Ausgabe (Spiegel von
 *     `apps/bakery-management/src/lib/partnerTypes.ts`),
 *  2. Übersetzung der Sequelize-Zeilen (`PartnerVisit` samt `items`-Include)
 *     in die schlichten Objekte, die der Core erwartet.
 */

// Der Core ist absichtlich CommonJS ohne Typen - deshalb per require geladen.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require('./partner-stats.core')

// ============================================================================
// TYPEN
// ============================================================================

export type VisitType = 'initial' | 'refill' | 'pickup'
export type SettlementModel = 'commission' | 'firm_sale'

/** Inklusive Grenzen im Format `YYYY-MM-DD`; `null`/fehlend = unbegrenzt. */
export interface StatsRange {
  from?: string | null
  to?: string | null
}

export interface PlainVisitItem {
  id?: number
  productId: number
  productSlug: string
  /** Snapshot des Produktnamens zum Zeitpunkt des Besuchs. */
  productName: string
  /** Snapshot des HQ-Preises - hält Altberichte korrekt. */
  unitPrice: number
  /** Vorgefundener Restbestand. `null` = nicht gezählt. */
  countedQty: number | null
  deliveredQty: number
}

export interface PlainVisit {
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
  items: PlainVisitItem[]
  createdAt?: string
  updatedAt?: string
}

export interface ProductStat {
  productId: number
  productSlug: string
  productName: string
  unitPrice: number
  deliveredQty: number
  soldQty: number
  returnedQty: number
  discrepancyQty: number
  /** Bei der Abholung nicht gezählt - weder verkauft noch Retoure. */
  uncountedQty: number
  revenue: number
  returnValue: number
  sellThroughRate: number | null
}

export interface DayStat {
  businessDate: string
  weekday: number | null
  /** Kein `pickup`-Besuch erfasst - Verkauf und Umsatz sind vorläufig. */
  isOpen: boolean
  /** Die Abholung hat jedes Produkt mit Bestand gezählt. */
  isComplete: boolean
  visitCount: number
  refillCount: number
  deliveredQty: number
  soldQty: number
  returnedQty: number
  discrepancyQty: number
  uncountedQty: number
  revenue: number
  returnValue: number
  sellThroughRate: number | null
}

export interface WeekdayStat {
  weekday: number
  weekdayLabel: string
  dayCount: number
  openDayCount: number
  avgDeliveredQty: number
  avgSoldQty: number
  avgReturnedQty: number
  avgRevenue: number
  sellThroughRate: number | null
}

export interface StatsTotals {
  dayCount: number
  openDayCount: number
  /** Abgeschlossene Tage, deren Abholung nicht jedes Produkt gezählt hat. */
  incompleteDayCount: number
  visitCount: number
  refillCount: number
  deliveredQty: number
  soldQty: number
  returnedQty: number
  discrepancyQty: number
  uncountedQty: number
  revenue: number
  returnValue: number
  sellThroughRate: number | null
  returnRate: number | null
}

export interface PartnerStats {
  range: { from: string | null; to: string | null }
  totals: StatsTotals
  /** Mindestens ein Tag ohne Abholung oder mit unvollständiger Abholung - Zahlen sind vorläufig. */
  isProvisional: boolean
  openDates: string[]
  incompleteDates: string[]
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
  isComplete: boolean
  uncountedQty: number
  uncountedProducts: UncountedProduct[]
  timeline: TimelineEntry[]
  totals: StatsTotals
  byProduct: ProductStat[]
}

/** Kopfdaten für den CSV-Export. */
export interface CsvPartner {
  name?: string
  settlementModel?: SettlementModel
}

// ============================================================================
// KONSTANTEN AUS DEM CORE
// ============================================================================

export const VISIT_TYPES: VisitType[] = core.VISIT_TYPES
export const VISIT_TYPE_LABELS: Record<VisitType, string> =
  core.VISIT_TYPE_LABELS
export const WEEKDAY_LABELS: Record<number, string> = core.WEEKDAY_LABELS
export const WEEKDAY_SHORT: Record<number, string> = core.WEEKDAY_SHORT

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/** Geschäftstag (`YYYY-MM-DD`) eines Zeitpunkts, in lokaler Zeit. */
export function businessDateOf(
  dateLike: Date | string | number
): string | null {
  return core.businessDateOf(dateLike)
}

/** ISO-Wochentag (1 = Montag … 7 = Sonntag) eines `YYYY-MM-DD`-Strings. */
export function weekdayOf(businessDate: string): number | null {
  return core.weekdayOf(businessDate)
}

export function isVisitType(value: unknown): value is VisitType {
  return VISIT_TYPES.indexOf(value as VisitType) !== -1
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function plainRow(row: any): any {
  if (row && typeof row.toJSON === 'function') return row.toJSON()
  if (row && typeof row.get === 'function') return row.get({ plain: true })
  return row || {}
}

/** DATEONLY kommt je nach Dialekt als `Date` oder als `YYYY-MM-DD`-String. */
function toDateOnlyString(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return core.businessDateOf(value as Date)
}

function toIsoString(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  const d = value instanceof Date ? value : new Date(value as string)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Eine `PartnerVisitItem`-Zeile in ein schlichtes Objekt.
 * `unitPrice` liegt als DECIMAL(10,2) in der Datenbank und kommt als *String*
 * zurück - ohne `Number()` würde der Core Strings multiplizieren.
 */
export function toPlainVisitItem(row: any): PlainVisitItem {
  const item = plainRow(row)
  const counted = item.countedQty
  return {
    id: item.id,
    productId: toInt(item.productId, 0),
    productSlug: String(item.productSlug || ''),
    productName: String(item.productName || item.productSlug || 'Unbekannt'),
    unitPrice: toNumber(item.unitPrice, 0),
    countedQty:
      counted === null || counted === undefined ? null : toInt(counted, 0),
    deliveredQty: Math.max(0, toInt(item.deliveredQty, 0)),
  }
}

/** Eine `PartnerVisit`-Zeile (mit `items`-Include) in ein schlichtes Objekt. */
export function toPlainVisit(row: any): PlainVisit {
  const visit = plainRow(row)
  const items: any[] = Array.isArray(visit.items) ? visit.items : []
  return {
    id: toInt(visit.id, 0),
    partnerId: toInt(visit.partnerId, 0),
    businessDate: toDateOnlyString(visit.businessDate) || '',
    visitAt: toIsoString(visit.visitAt) || '',
    visitType: isVisitType(visit.visitType) ? visit.visitType : 'refill',
    sequence: toInt(visit.sequence, 0),
    staffId: visit.staffId == null ? null : toInt(visit.staffId, 0),
    staffName: visit.staffName == null ? null : String(visit.staffName),
    note: visit.note == null ? null : String(visit.note),
    items: items.map(toPlainVisitItem),
    createdAt: toIsoString(visit.createdAt) || undefined,
    updatedAt: toIsoString(visit.updatedAt) || undefined,
  }
}

export function toPlainVisits(rows: any[]): PlainVisit[] {
  return (rows || []).map(toPlainVisit)
}

// ============================================================================
// KENNZAHLEN - alles delegiert an den Core
// ============================================================================

/** Kennzahlen über einen Zeitraum. */
export function getStats(
  visits: PlainVisit[],
  range: StatsRange = {}
): PartnerStats {
  return core.computeStats(visits, {
    from: range.from || null,
    to: range.to || null,
  })
}

/** Tagesansicht mit Besuchs-Timeline - Eingabe sind Besuche *eines* Tages. */
export function getDayDetail(dayVisits: PlainVisit[]): DayDetail {
  return core.computeDayDetail(dayVisits)
}

/** Partner-Report als CSV (Semikolon, Dezimalkomma - Excel DE). */
export function toCsv(stats: PartnerStats, partner: CsvPartner = {}): string {
  return core.statsToCsv(stats, partner)
}

export default {
  VISIT_TYPES,
  VISIT_TYPE_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  businessDateOf,
  weekdayOf,
  isVisitType,
  toPlainVisitItem,
  toPlainVisit,
  toPlainVisits,
  getStats,
  getDayDetail,
  toCsv,
}
