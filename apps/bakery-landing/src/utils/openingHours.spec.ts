import { DAY_NAMES, OPENING_HOURS } from '../config/openingHours'
import {
  getContactPageHours,
  getFooterHours,
  getMapDisplayHours,
  getNextOpening,
  getOpenStatus,
  getSeoOpeningHours,
  getTodayHours,
  getTodayOpeningTime,
  isCurrentlyOpen,
  opensLaterToday,
} from './openingHours'

// Alle Zeitpunkte als UTC-Instant: der Status rechnet in deutscher Zeit
// (Europe/Berlin), egal in welcher Zeitzone das Gerät (oder CI) läuft.
// Wochenplan: Di-Fr 05:30-13:30, Sa 05:30-12:30, So 08:00-11:00, Mo Ruhetag.
// Sommerzeit (CEST) = UTC+2, Winterzeit (CET) = UTC+1.
const at = (isoUtc: string) => {
  jest.useFakeTimers().setSystemTime(new Date(isoUtc))
}

describe('openingHours utils', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  describe('getNextOpening', () => {
    it('names the next open day after closing time, with a formatted time', () => {
      at('2026-09-02T12:00:00Z') // Mi 14:00
      expect(getNextOpening()).toEqual({ day: 'Donnerstag', time: '5:30' })
    })

    it('returns "Heute" before opening time', () => {
      at('2026-09-02T02:00:00Z') // Mi 04:00
      expect(getNextOpening()).toEqual({ day: 'Heute', time: '5:30' })
    })

    it('skips the Monday Ruhetag', () => {
      at('2026-09-06T10:00:00Z') // So 12:00
      expect(getNextOpening()).toEqual({ day: 'Dienstag', time: '5:30' })
    })

    it('formats Sunday hours the same way as the other labels', () => {
      at('2026-09-05T11:00:00Z') // Sa 13:00
      expect(getNextOpening()).toEqual({ day: 'Sonntag', time: '8:00' })
    })
  })

  describe('today state', () => {
    it('during opening hours: open, with today’s hours', () => {
      at('2026-11-17T08:00:00Z') // Di 09:00
      expect(getOpenStatus()).toEqual({
        kind: 'open',
        todayHours: '5:30 - 13:30 Uhr',
        opens: '5:30',
        next: { day: 'Mittwoch', time: '5:30' },
      })
      expect(isCurrentlyOpen()).toBe(true)
      expect(getTodayHours()).toBe('5:30 - 13:30 Uhr')
    })

    it('after closing time on an open day: closed, not a Ruhetag', () => {
      at('2026-09-02T12:00:00Z') // Mi 14:00
      expect(getOpenStatus().kind).toBe('closed-for-today')
      expect(isCurrentlyOpen()).toBe(false)
      expect(opensLaterToday()).toBe(false)
      expect(getTodayOpeningTime()).toBe('5:30')
    })

    it('on the Ruhetag there is no opening time at all', () => {
      at('2026-09-07T08:00:00Z') // Mo 10:00
      expect(getOpenStatus()).toEqual({
        kind: 'ruhetag',
        next: { day: 'Dienstag', time: '5:30' },
      })
      expect(isCurrentlyOpen()).toBe(false)
      expect(opensLaterToday()).toBe(false)
      expect(getTodayOpeningTime()).toBeNull()
      expect(getTodayHours()).toBe('Geschlossen')
    })

    it('takes the instant it is given instead of the clock', () => {
      at('2026-09-07T08:00:00Z') // Mo 10:00 - Ruhetag
      expect(getOpenStatus(new Date('2026-11-17T08:00:00Z')).kind).toBe('open')
    })
  })

  describe('Feiertage (Saarland)', () => {
    it('1. Weihnachtstag um 9 Uhr: Feiertag, nicht geöffnet', () => {
      at('2026-12-25T08:00:00Z') // Fr 09:00 - an einem Freitag sonst offen
      expect(getOpenStatus()).toEqual({
        kind: 'feiertag',
        name: '1. Weihnachtstag',
        next: { day: 'Sonntag', time: '8:00' },
      })
      expect(isCurrentlyOpen()).toBe(false)
      expect(opensLaterToday()).toBe(false)
      expect(getTodayOpeningTime()).toBeNull()
      expect(getTodayHours()).toBe('Feiertag (1. Weihnachtstag)')
    })

    it('vor der Öffnungszeit sagt ein Feiertag nicht „öffnet heute“', () => {
      at('2026-12-25T03:00:00Z') // Fr 04:00
      expect(getOpenStatus().kind).toBe('feiertag')
      expect(getNextOpening()).not.toEqual(
        expect.objectContaining({ day: 'Heute' })
      )
    })

    it('Neujahr', () => {
      at('2027-01-01T08:00:00Z') // Fr 09:00
      expect(getOpenStatus()).toMatchObject({
        kind: 'feiertag',
        name: 'Neujahr',
      })
    })

    it('Allerheiligen an einem Sonntag', () => {
      at('2026-11-01T08:30:00Z') // So 09:30 - sonntags sonst 8-11 offen
      expect(getOpenStatus()).toEqual({
        kind: 'feiertag',
        name: 'Allerheiligen',
        next: { day: 'Dienstag', time: '5:30' },
      })
    })

    it('Ostermontag geht dem Ruhetag vor', () => {
      at('2027-03-29T08:00:00Z') // Mo 10:00 (Sommerzeit)
      expect(getOpenStatus()).toMatchObject({
        kind: 'feiertag',
        name: 'Ostermontag',
      })
    })

    it('Heiligabend ist kein gesetzlicher Feiertag: normal geöffnet', () => {
      at('2026-12-24T08:00:00Z') // Do 09:00
      expect(getOpenStatus().kind).toBe('open')
      expect(isCurrentlyOpen()).toBe(true)
    })

    it('nach Ladenschluss an Heiligabend überspringt die nächste Öffnung beide Weihnachtstage', () => {
      at('2026-12-24T13:00:00Z') // Do 14:00
      expect(getOpenStatus().kind).toBe('closed-for-today')
      expect(getNextOpening()).toEqual({ day: 'Sonntag', time: '8:00' })
    })

    it('überspringt Feiertage und Ruhetag hintereinander', () => {
      // 2027: 25.12. Sa, 26.12. So (beide Feiertag), 27.12. Mo Ruhetag
      at('2027-12-24T13:00:00Z') // Fr 14:00
      expect(getNextOpening()).toEqual({ day: 'Dienstag', time: '5:30' })
    })

    it('überspringt Karfreitag', () => {
      at('2027-03-25T13:00:00Z') // Do 14:00 (Winterzeit)
      expect(getNextOpening()).toEqual({ day: 'Samstag', time: '5:30' })
    })
  })

  describe('deutsche Zeit statt Gerätezeit', () => {
    it('23:30 UTC am Dienstag ist in Berlin schon Mittwoch, 0:30', () => {
      at('2026-11-17T23:30:00Z')
      expect(getOpenStatus()).toEqual({
        kind: 'opens-later',
        todayHours: '5:30 - 13:30 Uhr',
        opens: '5:30',
        next: { day: 'Heute', time: '5:30' },
      })
    })

    it('22:30 UTC am Dienstag ist in Berlin noch Dienstag, 23:30', () => {
      at('2026-11-17T22:30:00Z')
      expect(getOpenStatus()).toMatchObject({
        kind: 'closed-for-today',
        next: { day: 'Mittwoch', time: '5:30' },
      })
    })

    it('Öffnung und Schluss folgen der Sommerzeit', () => {
      at('2026-09-02T03:29:00Z') // Mi 05:29 CEST
      expect(getOpenStatus().kind).toBe('opens-later')
      at('2026-09-02T03:30:00Z') // Mi 05:30 CEST
      expect(getOpenStatus().kind).toBe('open')
      at('2026-09-02T11:31:00Z') // Mi 13:31 CEST
      expect(getOpenStatus().kind).toBe('closed-for-today')
    })
  })

  it('nennt ab einer Woche Abstand das Datum zum Wochentag', () => {
    // Nur dienstags offen: von Dienstag nach Ladenschluss ist die nächste
    // Öffnung genau eine Woche später - „Dienstag“ allein wäre mehrdeutig.
    jest.isolateModules(() => {
      const closed = { isOpen: false }
      jest.doMock('../config/openingHours', () => ({
        DAY_NAMES,
        OPENING_HOURS: {
          ...Object.fromEntries(
            Object.keys(OPENING_HOURS).map((day) => [day, closed])
          ),
          tuesday: OPENING_HOURS.tuesday,
        },
      }))
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const isolated =
        require('./openingHours') as typeof import('./openingHours')
      at('2026-12-22T13:00:00Z') // Di 14:00
      expect(isolated.getNextOpening()).toEqual({
        day: 'Dienstag, 29.12.',
        time: '5:30',
      })
    })
    jest.dontMock('../config/openingHours')
  })
})

describe('getMapDisplayHours', () => {
  it('benennt den Sonntag nur mit "So" – ohne Feiertagsanspruch', () => {
    const sunday = getMapDisplayHours().find((row) =>
      row.label.split(', ').includes(DAY_NAMES.deAbbrev.sunday)
    )

    expect(sunday).toBeDefined()
    expect(sunday!.label).toBe('So')
    expect(sunday!.value).toBe('8:00 - 11:00 Uhr')
  })

  it('listet jeden Tag einer Gruppe einzeln auf', () => {
    const rows = getMapDisplayHours()

    expect(rows.map((row) => row.label)).toEqual([
      'Mo',
      'Di, Mi, Do, Fr',
      'Sa',
      'So',
    ])
    expect(rows[0].value).toBe('Geschlossen')
    expect(rows[1].value).toBe('5:30 - 13:30 Uhr')
  })

  it('zeigt dieselben Zeiten wie die Fußzeile', () => {
    // Karte und Fußzeile speisen sich aus derselben Konfiguration und dürfen
    // nicht auseinanderlaufen – nur das Label-Format unterscheidet sich.
    const map = getMapDisplayHours()
    const footer = getFooterHours()

    expect(map.map((row) => row.value)).toEqual(footer.map((row) => row.value))
  })
})

describe('Feiertage in den Wochenübersichten', () => {
  it('werden in keiner Darstellung der Öffnungszeiten behauptet', () => {
    // Die Konfiguration kennt keine Öffnungszeiten an Feiertagen. Der Hinweis
    // auf der Kontaktseite ("mögliche Änderungen an Feiertagen") ist die
    // einzige Aussage dazu; keine Ableitung aus OPENING_HOURS darf ihr
    // widersprechen. (Der Tagesstatus sagt an einem Feiertag nur neutral
    // „Feiertag“, siehe oben.)
    const labels = [
      ...getMapDisplayHours().map((row) => row.label),
      ...getFooterHours().map((row) => row.label),
      ...getContactPageHours().map((row) => row.day),
    ]

    expect(labels.filter((label) => /feiertag/i.test(label))).toEqual([])
    expect(JSON.stringify(getSeoOpeningHours())).not.toMatch(/holiday/i)
  })
})
