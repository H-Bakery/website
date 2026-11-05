/**
 * Anzeige-Helfer des Backzettels (Z5/Z6/Z7): Kalendertage, Zahlen, Einheiten,
 * Beschriftungen. Reine Funktionen ohne API - die Mengen selbst rechnet nur
 * der Server (`backzettel.core.js`); hier wird nichts gerechnet, was auf dem
 * Zettel steht.
 */

import type {
  BackzettelConfigData,
  BackzettelDay,
  BackzettelDeltaEntry,
  BackzettelLine,
  BackzettelUnit,
} from './backzettelApi'

/** ISO-Wochentage, an denen gebacken wird, solange keine Stammdaten da sind (Di–So). */
export const DEFAULT_PRODUCTION_DAYS: readonly number[] = [2, 3, 4, 5, 6, 7]

export const WEEKDAY_NAMES: Record<number, string> = {
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

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Kalendarisch gültiges `JJJJ-MM-TT` (kein 30. Februar). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const m = ISO_DATE.exec(value)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return (
    d.getUTCFullYear() === +m[1] &&
    d.getUTCMonth() === +m[2] - 1 &&
    d.getUTCDate() === +m[3]
  )
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Heute in Ortszeit des Geräts als `JJJJ-MM-TT`. */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function toUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date)
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate()
  )}`
}

/** ISO-Wochentag, 1 = Montag … 7 = Sonntag. */
export function isoWeekday(date: string): number {
  const day = toUtc(date).getUTCDay()
  return day === 0 ? 7 : day
}

function productionDays(days?: readonly number[] | null): readonly number[] {
  return days && days.length > 0 ? days : DEFAULT_PRODUCTION_DAYS
}

/**
 * Produktionstage von heute an über `horizon` Kalendertage (heute
 * eingeschlossen) - die Übersicht zeigt die kommende Woche.
 */
export function upcomingProductionDays(
  today: string,
  days?: readonly number[] | null,
  horizon = 7
): string[] {
  const allowed = productionDays(days)
  const out: string[] = []
  for (let i = 0; i < horizon; i += 1) {
    const date = addDays(today, i)
    if (allowed.includes(isoWeekday(date))) out.push(date)
  }
  return out
}

/**
 * Der nächste Tag, den man planen und freigeben will: der erste
 * Produktionstag **nach** heute. Heute wird schon gebacken (ab 2 Uhr).
 */
export function nextProductionDay(
  today: string,
  days?: readonly number[] | null
): string {
  const allowed = productionDays(days)
  for (let i = 1; i <= 14; i += 1) {
    const date = addDays(today, i)
    if (allowed.includes(isoWeekday(date))) return date
  }
  return addDays(today, 1)
}

/** Nächster/voriger Produktionstag neben `date` (für Vor/Zurück). */
export function neighbourProductionDay(
  date: string,
  direction: 1 | -1,
  days?: readonly number[] | null
): string {
  const allowed = productionDays(days)
  for (let i = 1; i <= 14; i += 1) {
    const candidate = addDays(date, i * direction)
    if (allowed.includes(isoWeekday(candidate))) return candidate
  }
  return addDays(date, direction)
}

/** „28.11.2026" */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}.${m}.${y}`
}

/** „Samstag, 28.11.2026" */
export function formatDateLong(date: string): string {
  return `${WEEKDAY_NAMES[isoWeekday(date)]}, ${formatDate(date)}`
}

/** „Sa 28.11." */
export function formatDateShort(date: string): string {
  const [, m, d] = date.split('-')
  return `${WEEKDAY_SHORT[isoWeekday(date)]} ${d}.${m}.`
}

/** Uhrzeit + Datum eines Zeitstempels in Ortszeit, „27.11. 14:05". */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

const NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

/** Zahl deutsch, höchstens zwei Nachkommastellen („1,24"). */
export function formatNumber(n: number): string {
  return NUMBER.format(n)
}

const UNIT_SUFFIX: Record<string, string> = {
  Liter: 'l',
  kg: 'kg',
  Blech: 'Bl.',
}

/** Menge mit Einheit; Stück ohne Zusatz („40", „4,5 l", „3 Bl."). */
export function formatQty(n: number, unit: BackzettelUnit | null): string {
  const suffix = unit ? UNIT_SUFFIX[unit] : undefined
  return suffix ? `${formatNumber(n)} ${suffix}` : formatNumber(n)
}

/** Zu- und Abschläge: „+2", „−1", „–" für 0. */
export function formatSigned(n: number): string {
  if (!n) return '–'
  return n > 0 ? `+${formatNumber(n)}` : `−${formatNumber(Math.abs(n))}`
}

/** Spaltenwert ohne Vorzeichen; 0 als „–", damit die Zahlen hervortreten. */
export function formatOrDash(n: number): string {
  return n ? formatNumber(n) : '–'
}

/** Gramm lesbar: unter 1 kg in g, sonst kg mit bis zu zwei Stellen. */
export function formatGrams(g: number): string {
  if (Math.abs(g) < 1000) return `${formatNumber(g)} g`
  return `${formatNumber(Math.round(g / 10) / 100)} kg`
}

/** Saisonfaktor als Text „1,2" (bzw. „1,0"). */
export function formatFactor(f: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(f)
}

/**
 * Zahl aus einer Eingabe: Komma oder Punkt, Leerzeichen egal. `NaN`, wenn es
 * keine Zahl ist - der Server prüft trotzdem selbst.
 */
export function parseDecimal(value: string): number {
  const cleaned = value.trim().replace(/\s+/g, '').replace(',', '.')
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) return Number.NaN
  return Number(cleaned)
}

/** Ganzzahlige Einheiten (Korrekturen dort nur ganze Zahlen). */
export function isIntegerUnit(unit: BackzettelUnit | null): boolean {
  return unit === 'Stück' || unit === 'Blech' || !unit
}

/**
 * Name einer Sorte: der Füllungsname aus den Stammdaten („Nussfüllung"),
 * sonst die ID mit großem Anfangsbuchstaben. `null` an einem Posten mit
 * Sorten heißt: Vorbestellung ohne Füllungsangabe.
 */
export function variantLabel(
  variant: string | null,
  config?: Pick<BackzettelConfigData, 'fillings'> | null
): string | null {
  if (!variant) return null
  const filling = config?.fillings?.find((f) => f.id === variant)
  if (filling?.name) return filling.name
  return variant.charAt(0).toUpperCase() + variant.slice(1)
}

/** Posten mit Sorten (aus den Stammdaten) - für „ohne Füllungsangabe". */
export function itemHasVariants(
  itemId: string,
  config?: Pick<BackzettelConfigData, 'items'> | null
): boolean {
  const item = config?.items?.find((i) => i.id === itemId)
  return !!item && Array.isArray(item.variants) && item.variants.length > 0
}

/** Zeilenname mit Sorte: „Zopf gefüllt – Nussfüllung". */
export function lineLabel(
  line: Pick<BackzettelLine, 'name' | 'variant' | 'itemId'>,
  config?: Pick<BackzettelConfigData, 'fillings' | 'items'> | null
): string {
  const v = variantLabel(line.variant, config)
  if (v) return `${line.name} – ${v}`
  if (itemHasVariants(line.itemId, config))
    return `${line.name} – ohne Füllungsangabe`
  return line.name
}

export const DELTA_KIND_LABELS: Record<string, string> = {
  added: 'neu',
  changed: 'geändert',
  cancelled: 'storniert',
}

/** Offene (nicht quittierte) Nachträge. */
export function openDeltas(
  day: Pick<BackzettelDay, 'deltas'> | null | undefined
): BackzettelDeltaEntry[] {
  return (day?.deltas ?? []).filter((d) => !d.acknowledgedAt)
}

/** Alle Zeilen eines Tages in Abschnittsreihenfolge. */
export function allLines(
  day: Pick<BackzettelDay, 'sections'>
): BackzettelLine[] {
  return day.sections.flatMap((s) => s.lines)
}

/** Vorbestellte Stück über alle Zeilen in Stück (für die Übersicht). */
export function preorderedPieces(day: Pick<BackzettelDay, 'sections'>): number {
  return allLines(day)
    .filter((l) => l.unit === 'Stück')
    .reduce((sum, l) => sum + (l.preorders || 0), 0)
}

/** Ob der Tag eine Hefeteig- oder Füllungsseite hat (Druckseite 2, Karte). */
export function hasHefeteig(
  day: Pick<BackzettelDay, 'hefeteig' | 'fillings'>
): boolean {
  return (
    (day.hefeteig?.doughs?.length ?? 0) > 0 || (day.fillings?.length ?? 0) > 0
  )
}
