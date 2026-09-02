import {
  ALL_PICKUP_SLOTS,
  OPENING_HOURS_ROWS,
  openingHoursSentence,
  pickupStatusAt,
  formatGermanDate,
  formatOpeningWindow,
  minutesToTime,
  openingWindowFor,
  parseIsoDate,
  pickupTimeSlots,
  timeToMinutes,
  toIsoDate,
  weekdayNameFor,
} from './pickup'

// 2026-08-31 is a Monday, so the week below covers every weekday exactly once.
const MONDAY = '2026-08-31'
const TUESDAY = '2026-09-01'
const SATURDAY = '2026-09-05'
const SUNDAY = '2026-09-06'

describe('time helpers', () => {
  it('converts between minutes and HH:mm', () => {
    expect(minutesToTime(330)).toBe('05:30')
    expect(minutesToTime(0)).toBe('00:00')
    expect(timeToMinutes('05:30')).toBe(330)
    expect(timeToMinutes('13:00')).toBe(780)
  })

  it('rejects malformed times', () => {
    expect(timeToMinutes('5:30')).toBeNull()
    expect(timeToMinutes('25:00')).toBeNull()
    expect(timeToMinutes('halb sechs')).toBeNull()
  })
})

describe('parseIsoDate', () => {
  it('parses a valid date in local time', () => {
    const date = parseIsoDate(TUESDAY)
    expect(date).not.toBeNull()
    // Local, not UTC — otherwise the day shifts west of Greenwich.
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(8)
    expect(date?.getDate()).toBe(1)
  })

  it('round-trips through toIsoDate', () => {
    expect(toIsoDate(parseIsoDate(SATURDAY) as Date)).toBe(SATURDAY)
  })

  it('rejects malformed and non-existent dates', () => {
    expect(parseIsoDate('')).toBeNull()
    expect(parseIsoDate('01.09.2026')).toBeNull()
    expect(parseIsoDate('2026-02-31')).toBeNull()
    expect(parseIsoDate('2026-13-01')).toBeNull()
  })
})

describe('openingWindowFor', () => {
  it('knows Monday is Ruhetag', () => {
    expect(openingWindowFor(MONDAY)).toBeNull()
    expect(weekdayNameFor(MONDAY)).toBe('Montag')
  })

  it('opens at 05:30 from Tuesday to Saturday', () => {
    expect(openingWindowFor(TUESDAY)).toEqual({
      opens: '05:30',
      closes: '13:30',
    })
    expect(openingWindowFor(SATURDAY)).toEqual({
      opens: '05:30',
      closes: '12:30',
    })
  })

  it('has shorter Sunday hours', () => {
    expect(openingWindowFor(SUNDAY)).toEqual({
      opens: '08:00',
      closes: '11:00',
    })
  })

  it('returns null for an invalid date', () => {
    expect(openingWindowFor('nope')).toBeNull()
  })
})

describe('pickupTimeSlots', () => {
  it('offers half-hour slots that stop one step before closing', () => {
    const slots = pickupTimeSlots(TUESDAY)
    expect(slots[0]).toBe('05:30')
    expect(slots[slots.length - 1]).toBe('13:00')
    expect(slots).toContain('09:00')
    expect(slots).not.toContain('13:30')
  })

  it('has no slots on a Ruhetag', () => {
    expect(pickupTimeSlots(MONDAY)).toEqual([])
  })

  it('covers the short Sunday window', () => {
    expect(pickupTimeSlots(SUNDAY)).toEqual([
      '08:00',
      '08:30',
      '09:00',
      '09:30',
      '10:00',
      '10:30',
    ])
  })

  it('drops slots before the same-day lead time and snaps onto the raster', () => {
    // 08:10 + lead -> the first offered slot is 08:30, never 08:10.
    const slots = pickupTimeSlots(TUESDAY, 8 * 60 + 10)
    expect(slots[0]).toBe('08:30')
    expect(slots).not.toContain('08:00')
  })

  it('returns nothing once the day is over', () => {
    expect(pickupTimeSlots(SATURDAY, 23 * 60)).toEqual([])
  })
})

describe('ALL_PICKUP_SLOTS', () => {
  it('is the sorted union across every open day', () => {
    expect(ALL_PICKUP_SLOTS[0]).toBe('05:30')
    expect(ALL_PICKUP_SLOTS[ALL_PICKUP_SLOTS.length - 1]).toBe('13:00')
    expect(new Set(ALL_PICKUP_SLOTS).size).toBe(ALL_PICKUP_SLOTS.length)
    expect([...ALL_PICKUP_SLOTS].sort()).toEqual([...ALL_PICKUP_SLOTS])
  })
})

describe('formatting', () => {
  it('writes a German long date', () => {
    expect(formatGermanDate(TUESDAY)).toBe('Dienstag, 01.09.2026')
    expect(formatGermanDate('bad')).toBe('')
  })

  it('writes an opening window', () => {
    expect(formatOpeningWindow({ opens: '05:30', closes: '13:30' })).toBe(
      '05:30 – 13:30 Uhr'
    )
  })
})

describe('OPENING_HOURS_ROWS', () => {
  it('fasst gleiche Tage zu einer Zeile zusammen und nennt den Ruhetag', () => {
    expect(OPENING_HOURS_ROWS).toEqual([
      { days: 'Di – Fr', time: '05:30 – 13:30 Uhr' },
      { days: 'Samstag', time: '05:30 – 12:30 Uhr' },
      { days: 'Sonntag', time: '08:00 – 11:00 Uhr' },
      { days: 'Montag', time: 'Ruhetag' },
    ])
  })

  it('zeigt nur Zeiten, die es im Wochenraster wirklich gibt', () => {
    // Sonst verspricht die Startseite eine Zeit, die die Kasse nicht anbietet.
    for (const row of OPENING_HOURS_ROWS) {
      if (row.time === 'Ruhetag') continue
      const [opens] = row.time.split(' – ')
      expect(ALL_PICKUP_SLOTS).toContain(opens)
    }
  })
})

describe('openingHoursSentence', () => {
  it('baut den Fließtext-Satz aus den Tabellenzeilen', () => {
    // Der Satz in der Kasse ist abgeleitet, nicht abgeschrieben: ändert sich
    // WEEKDAY_HOURS, ändert sich hier automatisch der Erwartungswert mit.
    expect(openingHoursSentence()).toBe(
      'Di – Fr 05:30 – 13:30 Uhr · Samstag 05:30 – 12:30 Uhr · ' +
        'Sonntag 08:00 – 11:00 Uhr · Montag ist Ruhetag.'
    )
  })

  it('nennt jede Zeile der Tabelle genau einmal', () => {
    const sentence = openingHoursSentence()
    for (const row of OPENING_HOURS_ROWS) {
      expect(sentence.split(row.days).length - 1).toBe(1)
      if (row.time !== 'Ruhetag') expect(sentence).toContain(row.time)
    }
  })
})

describe('pickupStatusAt', () => {
  /** Dienstag, 1. September 2026 – ein regulärer Öffnungstag (05:30–13:30). */
  const tuesdayAt = (hours: number, minutes = 0) =>
    new Date(2026, 8, 1, hours, minutes)

  it('erkennt geöffnet und nennt die Schließzeit', () => {
    const status = pickupStatusAt(tuesdayAt(9, 0))

    expect(status.isOpenNow).toBe(true)
    expect(status.closesAt).toBe('13:30')
  })

  it('ist vor der Öffnung geschlossen, aber der Tag bleibt buchbar', () => {
    const status = pickupStatusAt(tuesdayAt(4, 0))

    expect(status.isOpenNow).toBe(false)
    expect(status.closesAt).toBeNull()
    expect(status.next).toEqual({
      isoDate: '2026-09-01',
      time: '05:30',
      weekday: 'Dienstag',
      isToday: true,
    })
  })

  it('hält die Vorlaufzeit ein und rastet auf die halbe Stunde', () => {
    // 09:05 + 60 min Vorlauf = 10:05 -> der nächste Slot ist 10:30.
    const status = pickupStatusAt(tuesdayAt(9, 5))

    expect(status.next?.isToday).toBe(true)
    expect(status.next?.time).toBe('10:30')
  })

  it('springt auf den nächsten Tag, wenn heute kein Slot mehr passt', () => {
    // 13:00 + 60 min liegt hinter dem letzten Slot des Dienstags.
    const status = pickupStatusAt(tuesdayAt(13, 0))

    expect(status.isOpenNow).toBe(true)
    expect(status.next).toEqual({
      isoDate: '2026-09-02',
      time: '05:30',
      weekday: 'Mittwoch',
      isToday: false,
    })
  })

  it('überspringt den Ruhetag: sonntags nach Ladenschluss folgt Dienstag', () => {
    // Sonntag, 6. September 2026, 12:00 – Montag ist Ruhetag.
    const status = pickupStatusAt(new Date(2026, 8, 6, 12, 0))

    expect(status.isOpenNow).toBe(false)
    expect(status.next?.weekday).toBe('Dienstag')
    expect(status.next?.isoDate).toBe('2026-09-08')
  })

  it('trägt einen Monatswechsel mit', () => {
    // Montag, 31. August 2026 ist Ruhetag -> weiter in den September.
    const status = pickupStatusAt(new Date(2026, 7, 31, 10, 0))

    expect(status.next?.isoDate).toBe('2026-09-01')
  })

  it('verspricht nie einen Termin, den pickupTimeSlots ablehnt', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const status = pickupStatusAt(tuesdayAt(hour, 0))
      if (!status.next) continue
      expect(pickupTimeSlots(status.next.isoDate)).toContain(status.next.time)
    }
  })
})
