/**
 * Kalender-Helfer für die Zahlen-Seiten (Kassenberichte, Analysen,
 * Rest-Auswertung, Tagesziel) - alles als `YYYY-MM-DD`-Zeichenkette.
 *
 * Ortszeit statt `toISOString()`: das rechnet in UTC, und zwischen
 * Mitternacht und 1 bzw. 2 Uhr (Berlin) war „heute“ dann noch gestern - die
 * Analysen zeigten nach Mitternacht den Zeitraum bis zum Vortag.
 */

/** Längster Zeitraum, den die Analyse-API annimmt (`MAX_RANGE_DAYS` im Core). */
export const ANALYTICS_MAX_DAYS = 400

/** Ortsdatum eines `Date` als `YYYY-MM-DD`. */
export function localIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** `YYYY-MM-DD` + n Tage (Kalendertage, zeitzonenfest). */
export function addDaysIso(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Erster Tag des Monats von `date`. */
export function monthStartIso(date: string): string {
  return `${date.slice(0, 7)}-01`
}

/** Letzter Tag des Monats von `date`. */
export function monthEndIso(date: string): string {
  const [y, m] = date.slice(0, 7).split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${date.slice(0, 7)}-${String(last).padStart(2, '0')}`
}

/** Erster Tag des Vormonats von `date`. */
export function previousMonthStartIso(date: string): string {
  const [y, m] = date.slice(0, 7).split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return d.toISOString().slice(0, 10)
}

/** ISO-Kalenderwoche (1-53) eines `YYYY-MM-DD`. */
export function isoWeek(date: string): number {
  const d = new Date(`${date}T12:00:00Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7)
}

export interface RangePreset {
  label: string
  from: string
  to: string
}

/**
 * Die üblichen Zeiträume bis `anchor` (jüngster Tag mit Daten oder heute):
 * 7 Tage, 30 Tage, dieser Monat (bis `anchor`), Vormonat. Beide Grenzen
 * zählen mit - „7 Tage“ sind sieben Kalendertage.
 */
export function standardPresets(anchor: string): RangePreset[] {
  const prevStart = previousMonthStartIso(anchor)
  return [
    { label: '7 Tage', from: addDaysIso(anchor, -6), to: anchor },
    { label: '30 Tage', from: addDaysIso(anchor, -29), to: anchor },
    { label: 'Dieser Monat', from: monthStartIso(anchor), to: anchor },
    { label: 'Letzter Monat', from: prevStart, to: monthEndIso(prevStart) },
  ]
}

/** `2026-11-06` → `06.11.2026` */
export function formatIsoDate(date: string): string {
  const [y, m, d] = date.split('-')
  if (!y || !m || !d) return date
  return `${d}.${m}.${y}`
}

/** Zeitraum kurz: `08.10. – 06.11.2026` (gleiches Jahr) */
export function formatIsoRange(from: string, to: string): string {
  if (from === to) return formatIsoDate(to)
  if (from.slice(0, 4) === to.slice(0, 4)) {
    return `${from.slice(8, 10)}.${from.slice(5, 7)}. – ${formatIsoDate(to)}`
  }
  return `${formatIsoDate(from)} – ${formatIsoDate(to)}`
}
