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
 * Die eine Regel für alle Zahlen-Seiten, die aus den Kassenberichten
 * rechnen: Zeiträume enden am **jüngsten Tag mit Kassenbericht**, nicht an
 * „heute“. Heute hat fast nie einen Bericht (der Tagesabschluss kommt am
 * Nachmittag), und „30 Tage“ bis heute zählte dann nur 29 Tage mit - die
 * Kassenberichte und die Analysen zeigten für dieselbe Schnellwahl
 * verschiedene Umsätze. Ohne Bericht (leeres Archiv) gilt heute.
 */
export function reportAnchor(
  latestReportDate: string | null | undefined,
  today: string = localIsoDate()
): string {
  if (!latestReportDate) return today
  return latestReportDate < today ? latestReportDate : today
}

/** Was die Server-Hülle einer Analyse-Seite an den Client gibt. */
export interface AnalyticsRangeProps {
  /** Jüngster Tag mit Kassenbericht (`null`: keine Berichte). */
  latestReportDate?: string | null
  /** Ältester Tag mit Kassenbericht. */
  earliestReportDate?: string | null
}

/**
 * Standard-Zeitraum der Kassen-Seiten (Kassenberichte, Analysen): 30 Tage
 * bis `anchor`, beide Grenzen eingeschlossen - entspricht der Schnellwahl
 * „30 Tage“.
 */
export function defaultReportRange(anchor: string): {
  from: string
  to: string
} {
  return { from: addDaysIso(anchor, -29), to: anchor }
}

/**
 * Die üblichen Zeiträume bis `anchor` (jüngster Tag mit Bericht, siehe
 * `reportAnchor`): 7, 30 und 90 Tage, dieser Monat (bis `anchor`), Vormonat.
 * Beide Grenzen zählen mit - „7 Tage“ sind sieben Kalendertage. Dieselbe
 * Liste auf Kassenberichten und allen Analysen: gleiches Label, gleicher
 * Zeitraum, gleiche Summe.
 */
export function standardPresets(anchor: string): RangePreset[] {
  const prevStart = previousMonthStartIso(anchor)
  return [
    { label: '7 Tage', from: addDaysIso(anchor, -6), to: anchor },
    { label: '30 Tage', from: addDaysIso(anchor, -29), to: anchor },
    { label: '90 Tage', from: addDaysIso(anchor, -89), to: anchor },
    { label: 'Dieser Monat', from: monthStartIso(anchor), to: anchor },
    { label: 'Letzter Monat', from: prevStart, to: monthEndIso(prevStart) },
  ]
}

/**
 * Zeiträume der Seiten, die Wochentage vergleichen (Tagesziel,
 * Rest-Auswertung): ganze Wochen, damit jeder Wochentag gleich oft vorkommt.
 */
export function weekPresets(anchor: string): RangePreset[] {
  return [
    { label: '7 Tage', from: addDaysIso(anchor, -6), to: anchor },
    { label: '4 Wochen', from: addDaysIso(anchor, -27), to: anchor },
    { label: '12 Wochen', from: addDaysIso(anchor, -83), to: anchor },
  ]
}

/** Hinweis unter dem Zeitraum: welche Berichte es überhaupt gibt. */
export function reportArchiveNote(
  earliest: string | null | undefined,
  latest: string | null | undefined
): string | undefined {
  if (!earliest || !latest) return undefined
  return `Kassenberichte vorhanden vom ${formatIsoDate(
    earliest
  )} bis ${formatIsoDate(latest)}`
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
