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
  cap: number
  shopBaked: number
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
  cap: number
  shopBaked: number
  sold: number | null
  open: number | null
  restShopBaked: number
  rest: number | null
  unexplained: number | null
  ampel: AbgleichAmpel | null
  ampelBasis: AbgleichAmpelBasis | null
  direction: 'fehlt' | 'mehr_verkauft' | null
  rate: number | null
  overproduction: boolean
  restExceedsDates: string[]
  gaps: { noReport: string[]; restMissing: string[]; restPartial: string[] }
  allBaked: number
  allCap: number
  soldPieces: number | null
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

export async function fetchAbgleich(range: {
  from?: string
  to?: string
}): Promise<Abgleich> {
  const params: Record<string, string> = {}
  if (range.from) params.from = range.from
  if (range.to) params.to = range.to
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
