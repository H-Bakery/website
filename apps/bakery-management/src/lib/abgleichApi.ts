/**
 * Abgleich Produktion ↔ Kasse (nur Inhaber): `GET /api/abgleich` und das
 * CSV. Die Rechnung steht einmal in der API (`abgleich.core.js`); hier nur
 * Laden, Typen und Beschriftungen.
 */
import { apiClient } from '@bakery/shared/data-access'
import { saveBlob } from './partnerApi'
import type { RestDayKind } from './restApi'

const BASE = '/api/abgleich'

export type AbgleichAmpel = 'ok' | 'auffaellig' | 'pruefen'
export type AbgleichAmpelBasis = 'mit_rest' | 'ohne_rest'
export type AbgleichBasis = 'freigegeben' | 'geplant' | 'gemischt'
export type AbgleichRowStatus =
  | 'ok'
  | 'ohne_rest'
  | 'grundmenge_offen'
  | 'kein_bericht'
  | 'einheit'
  | 'keine_plu'
export type AbgleichRestStatus =
  | 'counted'
  | 'partial'
  | 'not_counted'
  | 'not_on_backzettel'

export interface AbgleichDayRow {
  date: string
  weekdayName: string | null
  basis: 'freigegeben' | 'geplant'
  baked: number
  /** Grundmenge offen: `baked` ist nur ein Mindestwert („≥ n“). */
  bakedIsMinimum: boolean
  cap: number
  shopBaked: number
  /** Gab es an dem Tag einen Kassenbericht? */
  report: boolean
  sold: number | null
  soldPieces: number | null
  open: number | null
  rest: number | null
  restStatus: AbgleichRestStatus
  unexplained: number | null
  ampel: AbgleichAmpel | null
  ampelBasis: AbgleichAmpelBasis | null
  status: AbgleichRowStatus
  rate: number | null
  overproduction: boolean
  restExceedsShop: boolean
  lines: {
    variant: string | null
    label: string | null
    baked: number
    cap: number
    rest: number | null
  }[]
}

export interface AbgleichItem {
  key: string
  itemId: string
  sizeId: string | null
  name: string
  sizeLabel: string | null
  section: string | null
  sectionLabel: string | null
  unit: string
  plu: number[]
  converted: boolean
  /** `umgerechnet` (Produktfaktor) oder `stueck` (Stück gegen Stück, vorläufig). */
  soldBasis: 'umgerechnet' | 'stueck' | null
  tolerance: number
  status: 'vergleichbar' | 'einheit' | 'keine_plu'
  basis: AbgleichBasis | null
  days: number
  plannedDays: number
  comparableDays: number
  restDays: number
  baked: number
  /** Kein vergleichbarer Tag, aber Grundmenge offen: nur „≥ n“. */
  bakedIsMinimum: boolean
  cap: number
  shopBaked: number
  sold: number | null
  open: number | null
  /** gebacken − CAP über die Tage mit Rest (Grundlage von Ungeklärt). */
  restShopBaked: number
  /** verkauft über die Tage mit Rest. */
  restSold: number | null
  rest: number | null
  unexplained: number | null
  ampel: AbgleichAmpel | null
  ampelBasis: AbgleichAmpelBasis | null
  /** Der Unterschied hinter der Ampel (Ungeklärt bzw. „mehr verkauft“). */
  signal: number | null
  /**
   * Mehr verkauft als gebacken an Tagen ohne gezählten Rest (Summe der
   * negativen Werte), `null` ohne solchen Tag.
   */
  shortWithoutRest: number | null
  shortDays: number
  /** Tage mit eigener Ampel „prüfen“ / „auffällig“. */
  signalDays: { pruefen: number; auffaellig: number }
  direction: 'fehlt' | 'mehr_verkauft' | null
  rate: number | null
  overproduction: boolean
  restExceedsDates: string[]
  gaps: {
    noReport: string[]
    restMissing: string[]
    restPartial: string[]
    /** Tage mit offener Grundmenge (kein Plan, kein Vergleich). */
    baseOpen: string[]
    /** verkauft, aber an dem Tag nicht auf dem Backzettel */
    notOnBackzettel: string[]
  }
  allBaked: number
  allBakedIsMinimum: boolean
  allCap: number
  /** nur über die Tage mit Kassenbericht */
  soldPieces: number | null
  /** Kassennummern, die zu einem anderen Posten gehören. */
  foreignPlu: number[]
  variants: {
    variant: string
    label: string | null
    baked: number
    cap: number
  }[]
  dayRows: AbgleichDayRow[]
}

export interface AbgleichDay {
  date: string
  weekday: number
  weekdayName: string | null
  status: 'ok' | 'no_backzettel' | 'ruhetag' | 'geschlossen' | 'future'
  dayKind?: RestDayKind
  basis: 'freigegeben' | 'geplant' | null
  report: boolean
  restStatus: 'counted' | 'partial' | 'not_counted' | null
  signals: { pruefen: number; auffaellig: number }
  /** Posten mit offener Grundmenge an diesem Tag. */
  baseOpen: number
}

export interface AbgleichEuroItem {
  key: string
  name: string
  sizeLabel: string | null
  section: string | null
  sollEur: number | null
  istEur: number | null
  preisOffen: boolean
}

export interface AbgleichEuroSection {
  section: string | null
  sectionLabel: string
  sollEur: number | null
  istEur: number | null
  differenzEur: number | null
  folgetagEur: number
  sammelEur: number | null
  handelswareEur: number | null
  preisOffen: string[]
  grundmengeOffen: boolean
  restCounted: boolean
}

export interface AbgleichEuro {
  abschnitte: { id: string; label: string; folgetag: boolean }[]
  sammelEur: number | null
  sammelAnteil: number | null
  days: {
    date: string
    basis: AbgleichDay['basis']
    report: boolean
    kasseEur: number | null
    sammelEur: number | null
    handelswareEur: number | null
    abschnitte: AbgleichEuroSection[]
    items: AbgleichEuroItem[]
    nichtZuordenbar: {
      plu: string | null
      name: string | null
      section: string | null
      sammel: boolean
      istEur: number | null
    }[]
  }[]
}

export interface Abgleich {
  from: string
  to: string
  today: string
  configStatus: 'ok' | 'no-config'
  reportsAvailable: boolean
  basis: AbgleichBasis | null
  explanation: string
  thresholds: {
    okShare: number
    noticeShare: number
    minTolerancePieces: number
    overproductionRate: number
  }
  counts: {
    days: number
    bakeDays: number
    confirmed: number
    planned: number
    noReport: number
    restCounted: number
    restPartial: number
    restNotCounted: number
    /** Backtage, an denen für mindestens einen Posten die Grundmenge offen ist. */
    baseOpen: number
    noBackzettel: number
    ruhetag: number
    geschlossen: number
    future: number
  }
  signals: {
    pruefen: number
    auffaellig: number
    ok: number
    ohneAmpel: number
  }
  items: AbgleichItem[]
  unmatched: AbgleichItem[]
  days: AbgleichDay[]
  euro?: AbgleichEuro
}

export interface AbgleichRange {
  from?: string
  to?: string
  folgetag?: string[]
}

/** Längster Zeitraum - wie `MAX_RANGE_DAYS` in `abgleich.core.js`. */
export const ABGLEICH_MAX_RANGE_DAYS = 62

export const AMPEL_LABELS: Record<AbgleichAmpel, string> = {
  ok: 'ok',
  auffaellig: 'auffällig',
  pruefen: 'prüfen',
}

export const BASIS_LABELS: Record<AbgleichBasis, string> = {
  freigegeben: 'freigegeben',
  geplant: 'geplant – nicht freigegeben',
  gemischt: 'teils geplant',
}

export const ROW_STATUS_LABELS: Record<AbgleichRowStatus, string> = {
  ok: 'vollständig',
  ohne_rest: 'Rest nicht gezählt',
  grundmenge_offen: 'Grundmenge offen – kein Plan',
  kein_bericht: 'kein Kassenbericht',
  einheit: 'nicht vergleichbar (Einheit)',
  keine_plu: 'keine Kassennummer',
}

export const REST_STATUS_LABELS: Record<AbgleichRestStatus, string> = {
  counted: 'gezählt',
  partial: 'teilweise gezählt',
  not_counted: 'nicht gezählt',
  not_on_backzettel: 'nicht auf dem Backzettel',
}

function unwrap<T>(res: { data?: T } | undefined): T {
  if (!res || res.data === undefined) {
    throw new Error('Leere Antwort vom Server.')
  }
  return res.data
}

export async function fetchAbgleich(range: AbgleichRange): Promise<Abgleich> {
  const params: Record<string, string> = {}
  if (range.from) params.from = range.from
  if (range.to) params.to = range.to
  if (range.folgetag) params.folgetag = range.folgetag.join(',')
  return unwrap(await apiClient.get<Abgleich>(BASE, params))
}

export function abgleichCsvFileName(range: { from: string; to: string }) {
  return `abgleich-produktion-kasse-${range.from}-bis-${range.to}.csv`
}

/** CSV mit Token laden (ein schlichter Link wäre gegen die echte API 401). */
export async function downloadAbgleichCsv(
  range: { from: string; to: string },
  save: (blob: Blob, fileName: string) => void = saveBlob
): Promise<void> {
  const params = new URLSearchParams({ from: range.from, to: range.to })
  const { blob, filename } = await apiClient.getBlob(
    `${BASE}/csv?${params.toString()}`
  )
  save(blob, filename || abgleichCsvFileName(range))
}

/** „Kranz gefüllt“ bzw. „Testkorn 500 g“. */
export function postenLabel(item: Pick<AbgleichItem, 'name' | 'sizeLabel'>) {
  return item.sizeLabel ? `${item.name} ${item.sizeLabel}` : item.name
}
