import { DAY_NAMES } from '../config/openingHours'
import {
  getContactPageHours,
  getFooterHours,
  getMapDisplayHours,
  getNextOpening,
  getSeoOpeningHours,
  getTodayOpeningTime,
  isCurrentlyOpen,
  opensLaterToday,
} from './openingHours'

// Local-time constructor, so the tests do not depend on the machine's TZ.
// 2026-09-02 is a Wednesday (Di-Fr 05:30-13:30, Sa 05:30-12:30, So 08:00-11:00,
// Mo geschlossen).
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute)

describe('openingHours utils', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  describe('getNextOpening', () => {
    it('names the next open day after closing time, with a formatted time', () => {
      jest.useFakeTimers().setSystemTime(at(2, 14)) // Wed 14:00
      expect(getNextOpening()).toEqual({ day: 'Donnerstag', time: '5:30' })
    })

    it('returns "Heute" before opening time', () => {
      jest.useFakeTimers().setSystemTime(at(2, 4)) // Wed 04:00
      expect(getNextOpening()).toEqual({ day: 'Heute', time: '5:30' })
    })

    it('skips the Monday Ruhetag', () => {
      jest.useFakeTimers().setSystemTime(at(6, 12)) // Sun 12:00
      expect(getNextOpening()).toEqual({ day: 'Dienstag', time: '5:30' })
    })

    it('formats Sunday hours the same way as the other labels', () => {
      jest.useFakeTimers().setSystemTime(at(5, 13)) // Sat 13:00
      expect(getNextOpening()).toEqual({ day: 'Sonntag', time: '8:00' })
    })
  })

  describe('today state', () => {
    it('after closing time on an open day: closed, not a Ruhetag', () => {
      jest.useFakeTimers().setSystemTime(at(2, 14)) // Wed 14:00
      expect(isCurrentlyOpen()).toBe(false)
      expect(opensLaterToday()).toBe(false)
      expect(getTodayOpeningTime()).toBe('5:30')
    })

    it('on the Ruhetag there is no opening time at all', () => {
      jest.useFakeTimers().setSystemTime(at(7, 10)) // Mon 10:00
      expect(isCurrentlyOpen()).toBe(false)
      expect(opensLaterToday()).toBe(false)
      expect(getTodayOpeningTime()).toBeNull()
    })
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

describe('Feiertage', () => {
  it('werden in keiner Darstellung der Öffnungszeiten behauptet', () => {
    // Die Konfiguration kennt keine Feiertage. Der Hinweis auf der
    // Kontaktseite ("mögliche Änderungen an Feiertagen") ist die einzige
    // Aussage dazu; keine Ableitung aus OPENING_HOURS darf ihr widersprechen.
    const labels = [
      ...getMapDisplayHours().map((row) => row.label),
      ...getFooterHours().map((row) => row.label),
      ...getContactPageHours().map((row) => row.day),
    ]

    expect(labels.filter((label) => /feiertag/i.test(label))).toEqual([])
    expect(JSON.stringify(getSeoOpeningHours())).not.toMatch(/holiday/i)
  })
})
