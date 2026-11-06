/**
 * Client für „Rest am Abend“ (roadmap §6 M4) - `/api/rest` der echten API.
 *
 *   GET /api/rest?date=              Zählliste des Tages (Verkauf, Backstube)
 *   PUT /api/rest/:date              Zählung speichern, alles oder nichts (Verkauf)
 *   GET /api/rest/summary?from=&to=  Auswertung (nur Inhaber)
 *   GET /api/rest/summary.csv        dieselbe Auswertung als CSV (nur Inhaber)
 *   GET /api/rest/averages?weeks=    Rest Ø je Wochentag (Grundmengen, Backstube)
 *
 * Gerechnet wird hier nichts - Rest, Quote, „gebacken“ kommen aus
 * `apps/bakery-api/src/services/rest-am-abend.core.js`. Die Helfer unten
 * verwalten nur die Eingaben auf dem Tablet (Entwurf, Schritte, Format).
 */

import { apiClient } from '@bakery/shared/data-access'
import { saveBlob } from './partnerApi'

const BASE = '/api/rest'

export interface RestUserRef {
  id: number
  displayName: string
}

/** Eine Zählzeile: ein hq-Produkt (oder der Posten selbst, `productId` ''). */
export interface RestCountRow {
  productId: string
  label: string
  /** Einheit, in der gezählt wird (meist „Stück“). */
  unit: string
  /** Umrechnung in die Einheit des Postens (½ Laib = 0,5 l, 1 Stück Kuchen = ¼ Blech). */
  factor: number
  /** Nur ganze Zahlen (Stück, Blech). */
  integer: boolean
  /** Schritt der +/−-Knöpfe (1 oder 0,5). */
  step: number
  qty: number | null
  countedAt: string | null
  countedBy: RestUserRef | null
  revision: number
  /** Produkt steht nicht mehr am Posten (alte Zählung). */
  stale: boolean
}

export interface RestLine {
  key: string
  itemId: string
  variant: string | null
  variantLabel: string | null
  name: string
  section: string | null
  sectionLabel: string | null
  /** Einheit des Postens (Stück, Liter, Blech, kg). */
  unit: string
  /** Laut Entwurf geplant (nur ohne Freigabe aussagekräftig). */
  planned: number | null
  /** Freigegebener Backzettel inkl. quittierter Nachträge; `null` ohne Freigabe. */
  baked: number | null
  cap: number
  onBackzettel: boolean
  rows: RestCountRow[]
  /** Jede Zählzeile hat einen Wert. */
  counted: boolean
  /** Rest in der Einheit des Postens; `null`, solange nicht alles gezählt ist. */
  rest: number | null
  restSoFar: number | null
  /** Mehr übrig als für den Laden gebacken (Gebacken − CAP): fast immer verzählt. */
  restExceedsShop?: boolean
}

export interface RestDay {
  date: string
  weekday: number
  weekdayName: string | null
  today: string
  status: 'ok' | 'no-config' | 'ruhetag'
  reasons?: { path?: string; message: string }[]
  backzettelStatus: 'confirmed' | 'draft' | null
  window: { from: string; to: string }
  editable: boolean
  editIssue: string | null
  lines: RestLine[]
  summary: {
    lines: number
    countedLines: number
    rows: number
    countedRows: number
    lastCountedAt: string | null
    lastCountedBy: RestUserRef | null
  }
  /** Nur in der Antwort auf ein Speichern: wie viele Zeilen sich geändert haben. */
  changed?: number
}

export interface RestSaveEntry {
  itemId: string
  variant?: string
  productId?: string
  qty: number | null
  /** Was der Bildschirm zuletzt vom Server kannte (sonst 409 `rest_changed`). */
  expected: number | null
}

/** Ein Eintrag in `current` der 409 `rest_changed`. */
export interface RestConflict {
  itemId: string
  variant: string | null
  productId: string
  name?: string
  qty: number | null
  countedBy?: RestUserRef | null
  countedAt?: string | null
}

export type RestDayStatus =
  | 'counted'
  | 'partial'
  | 'not_counted'
  | 'no_backzettel'
  | 'counted_without_backzettel'
  | 'nothing_baked'
  | 'ruhetag'
  | 'future'

export interface RestTotal {
  unit: string
  items: number
  baked: number
  cap: number
  shopBaked: number
  rest: number
  rate: number | null
}

export interface RestSummaryItem {
  itemId: string
  name: string
  section: string | null
  sectionLabel: string | null
  unit: string
  days: number
  baked: number
  cap: number
  shopBaked: number
  rest: number
  rate: number | null
  sold: number | null
  soldDays: number
  soldConverted: boolean
  soldStatus: 'ok' | 'partial' | 'no_plu' | 'no_report' | 'no_config'
  uncountedDays: number
  uncountedDates: string[]
  /** Tage, an denen mehr übrig war als für den Laden gebacken. */
  restExceedsDates?: string[]
  variants: {
    variant: string
    label: string
    baked: number
    cap: number
    rest: number
    rate: number | null
  }[]
  weeks: {
    week: string
    days: number
    shopBaked: number
    rest: number
    rate: number | null
  }[]
}

export interface RestSummaryDay {
  date: string
  weekday: number
  weekdayName: string | null
  status: RestDayStatus
  byUnit: Record<
    string,
    { shopBaked: number; rest: number; rate: number | null }
  >
}

export interface RestSummary {
  from: string
  to: string
  today: string
  configStatus: 'ok' | 'no-config'
  reportsAvailable: boolean
  rateBasis: string
  counts: {
    days: number
    counted: number
    partial: number
    notCounted: number
    noBackzettel: number
    ruhetag: number
    future: number
  }
  totals: RestTotal[]
  items: RestSummaryItem[]
  days: RestSummaryDay[]
}

export interface RestAveragesItem {
  itemId: string
  mean: number
  samples: number[]
  dates: string[]
}

export interface RestAverages {
  status: 'ok' | 'no-config'
  today?: string
  weeks?: number
  basis?: string
  weekdays: {
    weekday: number
    weekdayName: string | null
    items: RestAveragesItem[]
  }[]
}

function unwrap<T>(res: { data?: T } | undefined): T {
  if (!res || res.data === undefined) {
    throw new Error('Leere Antwort vom Server.')
  }
  return res.data
}

export async function fetchRestDay(date?: string): Promise<RestDay> {
  return unwrap(await apiClient.get<RestDay>(BASE, date ? { date } : undefined))
}

export async function saveRestDay(
  date: string,
  items: RestSaveEntry[]
): Promise<RestDay> {
  return unwrap(
    await apiClient.put<RestDay>(`${BASE}/${encodeURIComponent(date)}`, {
      items,
    })
  )
}

export async function fetchRestSummary(range: {
  from?: string
  to?: string
}): Promise<RestSummary> {
  const params: Record<string, string> = {}
  if (range.from) params.from = range.from
  if (range.to) params.to = range.to
  return unwrap(await apiClient.get<RestSummary>(`${BASE}/summary`, params))
}

export function restCsvFileName(range: { from: string; to: string }): string {
  return `rest-am-abend-${range.from}-bis-${range.to}.csv`
}

/** CSV mit Token laden (ein schlichter Link wäre gegen die echte API 401). */
export async function downloadRestCsv(
  range: { from: string; to: string },
  save: (blob: Blob, fileName: string) => void = saveBlob
): Promise<void> {
  const params = new URLSearchParams({ from: range.from, to: range.to })
  const { blob, filename } = await apiClient.getBlob(
    `${BASE}/summary.csv?${params.toString()}`
  )
  save(blob, filename || restCsvFileName(range))
}

export async function fetchRestAverages(weeks = 6): Promise<RestAverages> {
  return unwrap(
    await apiClient.get<RestAverages>(`${BASE}/averages`, { weeks })
  )
}

// ---------------------------------------------------------------- Helfer

/** Schlüssel einer Zählzeile im Entwurf: Posten | Sorte | Produkt. */
export function rowKey(
  line: Pick<RestLine, 'itemId' | 'variant'>,
  row: Pick<RestCountRow, 'productId'>
): string {
  return `${line.itemId}|${line.variant || ''}|${row.productId}`
}

/**
 * Ein Entwurfs-Eintrag: die eingegebene Menge (`null` = Zählung löschen) und
 * der Server-Wert, auf dem die Eingabe beruht (`base`). `base` wird beim
 * Speichern als `expected` geschickt - nicht der Wert, den der Server nach
 * einem Neuladen gerade liefert. Sonst überschriebe ein im Browser
 * aufgehobener Entwurf nach Neuladen oder Tageswechsel still die Zählung
 * eines anderen Tablets (kein 409).
 */
export interface RestDraftEntry {
  qty: number | null
  base: number | null
}

/** Entwurf: Zählzeile (`rowKey`) → Eingabe samt Grundlage. */
export type RestDraft = Record<string, RestDraftEntry>

/** Wert, den eine Zählzeile gerade zeigt: Entwurf vor Server. */
export function shownQty(
  draft: RestDraft,
  line: Pick<RestLine, 'itemId' | 'variant'>,
  row: Pick<RestCountRow, 'productId' | 'qty'>
): number | null {
  const key = rowKey(line, row)
  return key in draft ? draft[key].qty : row.qty
}

/**
 * Eine Eingabe in den Entwurf übernehmen. Die Grundlage bleibt die des
 * ersten Tipps auf diese Zeile; entspricht die Eingabe dem Server, fällt der
 * Eintrag weg.
 */
export function setDraftEntry(
  draft: RestDraft,
  key: string,
  serverQty: number | null,
  qty: number | null
): RestDraft {
  const next = { ...draft }
  if (qty === serverQty) {
    delete next[key]
  } else {
    next[key] = { qty, base: key in draft ? draft[key].base : serverQty }
  }
  return next
}

/** Entwurfs-Einträge, die sich wirklich vom Server unterscheiden. */
export function draftChanges(
  day: Pick<RestDay, 'lines'>,
  draft: RestDraft
): RestSaveEntry[] {
  const out: RestSaveEntry[] = []
  for (const line of day.lines) {
    for (const row of line.rows) {
      const key = rowKey(line, row)
      if (!(key in draft)) continue
      const { qty, base } = draft[key]
      if (qty === row.qty) continue
      out.push({
        itemId: line.itemId,
        ...(line.variant ? { variant: line.variant } : {}),
        ...(row.productId ? { productId: row.productId } : {}),
        qty,
        expected: base,
      })
    }
  }
  return out
}

/** Entwurf ohne Einträge, die inzwischen dem Server entsprechen. */
export function pruneDraft(
  day: Pick<RestDay, 'lines'>,
  draft: RestDraft
): RestDraft {
  const known = new Map<string, number | null>()
  for (const line of day.lines) {
    for (const row of line.rows) known.set(rowKey(line, row), row.qty)
  }
  const out: RestDraft = {}
  for (const [key, entry] of Object.entries(draft)) {
    if (known.has(key) && known.get(key) !== entry.qty) out[key] = entry
  }
  return out
}

/**
 * Zeilen, deren Server-Wert sich seit der Eingabe geändert hat (anderes
 * Tablet) - in der Form der 409 `rest_changed`, damit der Bildschirm sie
 * genauso zeigt.
 */
export function draftConflicts(
  day: Pick<RestDay, 'lines'>,
  draft: RestDraft
): RestConflict[] {
  const out: RestConflict[] = []
  for (const line of day.lines) {
    for (const row of line.rows) {
      const entry = draft[rowKey(line, row)]
      if (!entry || entry.base === row.qty || entry.qty === row.qty) continue
      out.push({
        itemId: line.itemId,
        variant: line.variant,
        productId: row.productId,
        name: rowConflictName(line, row),
        qty: row.qty,
        countedBy: row.countedBy,
        countedAt: row.countedAt,
      })
    }
  }
  return out
}

function rowConflictName(
  line: Pick<RestLine, 'name' | 'variantLabel' | 'rows'>,
  row: Pick<RestCountRow, 'label'>
): string {
  const base = line.variantLabel
    ? `${line.name} ${line.variantLabel}`
    : line.name
  return line.rows.length > 1 && row.label && row.label !== line.name
    ? `${base} (${row.label})`
    : base
}

/**
 * Nachdem die Person die Abweichung gesehen hat: die Grundlage auf den
 * jetzigen Server-Stand setzen - ein erneutes Speichern gilt dann bewusst.
 */
export function rebaseDraft(
  day: Pick<RestDay, 'lines'>,
  draft: RestDraft
): RestDraft {
  const out: RestDraft = { ...draft }
  for (const line of day.lines) {
    for (const row of line.rows) {
      const key = rowKey(line, row)
      if (key in out) out[key] = { qty: out[key].qty, base: row.qty }
    }
  }
  return out
}

/** Ein Schritt nach oben oder unten; nie unter 0, höchstens 10000. */
export function stepQty(
  current: number | null,
  step: number,
  direction: 1 | -1
): number | null {
  if (current === null) return direction > 0 ? step : 0
  const next = Math.round((current + direction * step) * 100) / 100
  return Math.min(10000, Math.max(0, next))
}

/** Text des Ziffernblocks lesen; `NaN` = ungültig, `null` = leer. */
export function parsePadInput(text: string, integer: boolean): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  if (!(integer ? /^\d+$/ : /^\d+(\.\d{1,2})?$/).test(t)) return NaN
  const n = Number(t)
  return n > 10000 ? NaN : n
}

/** Zahl deutsch: 1,5 statt 1.5; ganze Zahlen ohne Nachkommastellen. */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–'
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return '–'
  return `${(rate * 100).toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`
}

export const UNIT_SHORT: Record<string, string> = {
  Stück: 'St.',
  Liter: 'l',
  Blech: 'Blech',
  kg: 'kg',
}

export function formatQtyUnit(
  value: number | null | undefined,
  unit: string
): string {
  if (value === null || value === undefined) return '–'
  return `${formatNumber(value)} ${UNIT_SHORT[unit] ?? unit}`
}

export const DAY_STATUS_LABELS: Record<RestDayStatus, string> = {
  counted: 'gezählt',
  partial: 'teilweise gezählt',
  not_counted: 'nicht gezählt',
  no_backzettel: 'kein freigegebener Backzettel',
  counted_without_backzettel: 'gezählt, Backzettel nicht freigegeben',
  nothing_baked: 'nichts gebacken',
  ruhetag: 'Ruhetag',
  future: 'noch nicht',
}

/** „Di, 01.12.“ */
export function formatDayShort(
  iso: string,
  weekdayName?: string | null
): string {
  const [, m, d] = iso.split('-')
  const wd = weekdayName ? `${weekdayName.slice(0, 2)}, ` : ''
  return `${wd}${d}.${m}.`
}

/** ISO-Datum ± Tage (UTC-Rechnung, nur Kalendertage). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const d = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

// ------------------------------------------------- Entwurf im Browser

const DRAFT_PREFIX = 'bakery-rest-draft:'

function draftStorageKey(userId: number | string, date: string): string {
  return `${DRAFT_PREFIX}${userId}:${date}`
}

function isQty(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && value >= 0)
}

/**
 * Ungespeicherte Eingaben je Benutzer und Tag im `localStorage` - ein
 * Neuladen oder ein leerer Akku am Tablet soll die halbe Zählung nicht
 * kosten. Je Benutzer, weil sich an der PIN-Station mehrere Personen ein
 * Gerät teilen: die nächste soll weder die Zahlen der vorigen sehen noch sie
 * unter eigenem Namen speichern. Jeder Zugriff in try/catch (privates
 * Fenster, gesperrter Speicher).
 */
export function loadDraft(userId: number | string, date: string): RestDraft {
  try {
    const raw = window.localStorage.getItem(draftStorageKey(userId, date))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {}
    const out: RestDraft = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue
      const { qty, base } = value as { qty?: unknown; base?: unknown }
      if (isQty(qty) && isQty(base)) out[key] = { qty, base }
    }
    return out
  } catch {
    return {}
  }
}

export function storeDraft(
  userId: number | string,
  date: string,
  draft: RestDraft
): void {
  try {
    const key = draftStorageKey(userId, date)
    if (Object.keys(draft).length === 0) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, JSON.stringify(draft))
    }
  } catch {
    // Speicher gesperrt - die Eingaben leben dann nur bis zum Neuladen.
  }
}
