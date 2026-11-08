// Die Öffnungszeiten stehen genau einmal in der API:
// `apps/bakery-api/src/services/opening-hours.core.js` (der Dienstplan rechnet
// damit die Besetzung des Verkaufs). Die Landing-Page ist ein statischer
// Export und kann die CommonJS-Datei der API nicht importieren - also prüft
// dieser Test, dass `OPENING_HOURS` hier dieselben Zeiten hat. Fällt er, hat
// jemand nur eine Seite geändert.

import * as path from 'path'
import { OPENING_HOURS, type OpeningHoursWeek } from './openingHours'

// Pfad zur Laufzeit gebaut, damit die Modulgrenzen-Regel von Nx den
// Querverweis nicht als Abhängigkeit zwischen Projekten liest (wie
// `libs/bakery-delivery-routing/src/lib/core-consistency.spec.ts`).
const CORE_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'bakery-api',
  'src',
  'services',
  'opening-hours.core.js'
)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require(CORE_PATH) as {
  openingHoursForWeekday: (
    weekday: number
  ) => { opens: string; closes: string } | null
}
// Ruhetag der API, wenn die Finanz-Config keinen nennt (Montag).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vacation = require(path.join(
  path.dirname(CORE_PATH),
  'vacation.core.js'
)) as { DEFAULT_CLOSED_WEEKDAYS: number[] }

/** ISO-Wochentag (1 = Montag) je Schlüssel der Landing-Tabelle. */
const ISO_WEEKDAY: Record<keyof OpeningHoursWeek, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
}

describe('Öffnungszeiten: Landing-Page und API', () => {
  it.each(Object.entries(ISO_WEEKDAY))(
    '%s hat dieselben Zeiten wie opening-hours.core.js',
    (day, weekday) => {
      const landing = OPENING_HOURS[day as keyof OpeningHoursWeek]
      const api = core.openingHoursForWeekday(weekday)
      expect(
        landing.isOpen ? { opens: landing.opens, closes: landing.closes } : null
      ).toEqual(api)
    }
  )

  it('die geschlossenen Tage der Landing-Page sind der Ruhetag der API', () => {
    const closed = Object.entries(ISO_WEEKDAY)
      .filter(([day]) => !OPENING_HOURS[day as keyof OpeningHoursWeek].isOpen)
      .map(([, weekday]) => weekday)
    expect(closed).toEqual(vacation.DEFAULT_CLOSED_WEEKDAYS)
  })
})
