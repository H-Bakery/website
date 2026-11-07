// Was am Tag einer Tour geht - rein, ohne React, getestet in tour-day.spec.ts.

/** Tage zwischen zwei JJJJ-MM-TT (b − a), kalendarisch, ohne Uhrzeit. */
function dayDiff(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`)
  const tb = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0
  return Math.round((tb - ta) / 86_400_000)
}

/**
 * Darf an diesem Tag abgehakt werden? Die API nimmt ein „Geliefert“ /
 * „Nicht angetroffen“ nur vom Vortag bis zwei Tage nach dem Tourtag an
 * (`COMPLETED_AT_DAYS_*` in `delivery-tours.service.ts`, 400 „Der Zeitpunkt
 * muss zum Tourtag passen.“). Davor und danach zeigt die App die Knöpfe
 * nicht - sonst stand ein Stopp grün da, den der Server nie gespeichert hat.
 */
export function markWindow(
  tourDate: string,
  today: string
): 'early' | 'open' | 'late' {
  const diff = dayDiff(tourDate, today)
  if (diff < -1) return 'early'
  if (diff > 2) return 'late'
  return 'open'
}

const WEEKDAY_TOUR = [
  'Sonntagstour',
  'Montagstour',
  'Dienstagstour',
  'Mittwochstour',
  'Donnerstagstour',
  'Freitagstour',
  'Samstagstour',
]

/**
 * Name einer neuen Tour: nach dem Wochentag („Freitagstour“), die zweite am
 * selben Tag mit Nummer („Samstagstour 2“). Früher hieß jede Tour
 * „Samstagstour“ - auch freitags und auch zwei am selben Tag.
 */
export function defaultTourName(date: string, existing: string[]): string {
  const day = new Date(`${date}T12:00:00`)
  const base = Number.isNaN(day.getTime()) ? 'Tour' : WEEKDAY_TOUR[day.getDay()]
  const taken = new Set(existing.map((name) => name.trim()))
  if (!taken.has(base)) return base
  for (let n = 2; ; n += 1) {
    if (!taken.has(`${base} ${n}`)) return `${base} ${n}`
  }
}

/** „HH:MM“ von 00:00 bis 23:59 - wie `isClockTime()` im Server-Core. */
export function isClockTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}
