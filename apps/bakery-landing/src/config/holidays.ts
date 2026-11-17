/**
 * Gesetzliche Feiertage im Saarland, für den Öffnungsstatus der Startseite
 * (`utils/openingHours.ts` `getOpenStatus`).
 *
 * Die Formel steht genau einmal in der API: `apps/bakery-api/src/services/
 * kalender.core.js` (`holidaysSaarland`, `easterSunday`, `holidayName`). Die
 * Landing-Page ist ein statischer Export und kann die CommonJS-Datei der API
 * nicht importieren - also spiegelt diese Datei sie, und `holidays.spec.ts`
 * prüft für 2024 bis 2040, dass beide dieselben Tage mit denselben Namen
 * liefern. Wer hier etwas ändert, ändert es dort mit.
 *
 * Nur die Tage - Öffnungszeiten an Feiertagen kennt die Landing-Page nicht
 * (Frage an den Inhaber); der Status sagt dann neutral „Feiertag“.
 */

export interface Holiday {
  /** `YYYY-MM-DD` */
  date: string
  name: string
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
}

/** `YYYY-MM-DD` plus `days` Kalendertage (ohne Zeitzone). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return isoDate(y, m, d + days)
}

/** Ostersonntag (gregorianisch, Anonymer Algorithmus nach Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return isoDate(year, month, day)
}

/**
 * Gesetzliche Feiertage im Saarland: bundesweite plus Fronleichnam, Mariä
 * Himmelfahrt und Allerheiligen. Ostersonntag und Pfingstsonntag sind im
 * Saarland keine gesetzlichen Feiertage. Nach Datum sortiert.
 */
export function holidaysSaarland(year: number): Holiday[] {
  if (!Number.isInteger(year) || year < 1900 || year > 2999) return []
  const easter = easterSunday(year)
  const fixed = (md: string, name: string) => ({ date: `${year}-${md}`, name })
  const moving = (offset: number, name: string) => ({
    date: addDays(easter, offset),
    name,
  })
  return [
    fixed('01-01', 'Neujahr'),
    moving(-2, 'Karfreitag'),
    moving(1, 'Ostermontag'),
    fixed('05-01', 'Tag der Arbeit'),
    moving(39, 'Christi Himmelfahrt'),
    moving(50, 'Pfingstmontag'),
    moving(60, 'Fronleichnam'),
    fixed('08-15', 'Mariä Himmelfahrt'),
    fixed('10-03', 'Tag der Deutschen Einheit'),
    fixed('11-01', 'Allerheiligen'),
    fixed('12-25', '1. Weihnachtstag'),
    fixed('12-26', '2. Weihnachtstag'),
  ].sort((x, y) => (x.date < y.date ? -1 : 1))
}

/** Name des gesetzlichen Feiertags (Saarland) an `date` (`YYYY-MM-DD`) oder `null`. */
export function holidayName(date: string): string | null {
  const hit = holidaysSaarland(Number(date.slice(0, 4))).find(
    (h) => h.date === date
  )
  return hit ? hit.name : null
}
