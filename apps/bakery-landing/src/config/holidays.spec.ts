// Die Feiertagsformel steht genau einmal in der API:
// `apps/bakery-api/src/services/kalender.core.js` (`holidaysSaarland`). Die
// Landing-Page ist ein statischer Export und kann die CommonJS-Datei der API
// nicht importieren - also prüft dieser Test, dass `holidays.ts` dieselben
// Tage mit denselben Namen liefert. Fällt er, hat jemand nur eine Seite
// geändert.

import * as path from 'path'
import {
  easterSunday,
  holidayName,
  holidaysSaarland,
  type Holiday,
} from './holidays'

// Pfad zur Laufzeit gebaut, damit die Modulgrenzen-Regel von Nx den
// Querverweis nicht als Abhängigkeit zwischen Projekten liest (wie
// `openingHours.spec.ts`).
const CORE_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'bakery-api',
  'src',
  'services',
  'kalender.core.js'
)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require(CORE_PATH) as {
  easterSunday: (year: number) => string
  holidaysSaarland: (year: number) => ReadonlyArray<Readonly<Holiday>>
  holidayName: (date: string) => string | null
}

const YEARS = Array.from({ length: 2040 - 2024 + 1 }, (_, i) => 2024 + i)

describe('Feiertage: Landing-Page und API', () => {
  it.each(YEARS)('%i hat dieselben Feiertage wie kalender.core.js', (year) => {
    const api = core.holidaysSaarland(year).map((h) => ({ ...h }))
    expect(holidaysSaarland(year)).toEqual(api)
    expect(api).toHaveLength(12)
  })

  it.each(YEARS)('%i hat denselben Ostersonntag', (year) => {
    expect(easterSunday(year)).toBe(core.easterSunday(year))
  })

  it('findet jeden Feiertag beim Namen wie die API', () => {
    for (const year of YEARS) {
      for (const { date } of core.holidaysSaarland(year)) {
        expect(holidayName(date)).toBe(core.holidayName(date))
      }
    }
  })

  it('kennt nur gesetzliche Feiertage, keine normalen Tage', () => {
    expect(holidayName('2026-12-24')).toBeNull() // Heiligabend
    expect(holidayName('2026-12-31')).toBeNull() // Silvester
    expect(holidayName('2027-03-28')).toBeNull() // Ostersonntag
    expect(holidayName('2026-12-25')).toBe('1. Weihnachtstag')
    expect(holidayName('2027-03-29')).toBe('Ostermontag')
  })
})
