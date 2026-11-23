import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Der Node-Build lädt mit demselben Parser wie die API.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { loadPickupCalendar } = require('../../../tools/landing/pickup-calendar')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  holidaysSaarland,
} = require('../../bakery-api/src/services/kalender.core')

it('exportiert nur die Abweichungen und respektiert spätere Kalendereinträge', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pickup-calendar-'))
  try {
    const file = path.join(dir, 'kalender.yaml')
    expect(loadPickupCalendar(file)).toBeNull()

    writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        bundesland: 'saarland',
        feiertage: {
          2026: holidaysSaarland(2026).map(
            ({ date, name }: { date: string; name: string }) => ({
              datum: date,
              name,
            })
          ),
        },
        tage: [
          {
            von: '2026-11-24',
            bis: '2026-11-27',
            wochentage: [2, 3, 4],
            typ: 'geschlossen',
            notiz: 'Test der Betriebsferien',
          },
          {
            datum: '2026-11-26',
            typ: 'wie-sonntag',
            notiz: 'Test der Sonderzeiten',
          },
        ],
      })
    )

    expect(loadPickupCalendar(file)).toEqual({
      '2026-11-24': 'geschlossen',
      '2026-11-25': 'geschlossen',
      '2026-11-26': 'sonderzeiten',
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
