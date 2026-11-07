import { defaultTourName, isClockTime, markWindow } from './tour-day'
import { followingSaturdayIso, nextSaturdayIso } from './format'

describe('markWindow (wie COMPLETED_AT_DAYS_* der API)', () => {
  it('erlaubt Abhaken vom Vortag bis zwei Tage nach dem Tourtag', () => {
    expect(markWindow('2026-11-07', '2026-11-05')).toBe('early')
    expect(markWindow('2026-11-07', '2026-11-06')).toBe('open')
    expect(markWindow('2026-11-07', '2026-11-07')).toBe('open')
    expect(markWindow('2026-11-07', '2026-11-09')).toBe('open')
    expect(markWindow('2026-11-07', '2026-11-10')).toBe('late')
    // Regression UI-Runde 2: Tour der nächsten Woche.
    expect(markWindow('2026-11-14', '2026-11-07')).toBe('early')
  })

  it('rechnet über den Monatswechsel und die Zeitumstellung', () => {
    expect(markWindow('2026-11-01', '2026-10-31')).toBe('open')
    expect(markWindow('2026-03-29', '2026-03-31')).toBe('open')
  })
})

describe('defaultTourName', () => {
  it('benennt nach dem Wochentag statt immer „Samstagstour“', () => {
    expect(defaultTourName('2026-11-07', [])).toBe('Samstagstour')
    expect(defaultTourName('2026-11-13', [])).toBe('Freitagstour')
    expect(defaultTourName('2026-11-08', [])).toBe('Sonntagstour')
  })

  it('nummeriert eine weitere Tour am selben Tag', () => {
    expect(defaultTourName('2026-11-07', ['Samstagstour'])).toBe(
      'Samstagstour 2'
    )
    expect(
      defaultTourName('2026-11-07', ['Samstagstour', 'Samstagstour 2'])
    ).toBe('Samstagstour 3')
  })
})

describe('isClockTime', () => {
  it('nimmt HH:MM von 00:00 bis 23:59', () => {
    expect(isClockTime('06:30')).toBe(true)
    expect(isClockTime('23:59')).toBe(true)
    expect(isClockTime('24:00')).toBe(false)
    expect(isClockTime('6:30')).toBe(false)
    expect(isClockTime('')).toBe(false)
  })
})

describe('Samstags-Knöpfe', () => {
  afterEach(() => jest.useRealTimers())

  it('„Nächster Samstag“ führt am Samstag eine Woche weiter (nicht auf heute)', () => {
    // Regression UI-Runde 2: am Samstag taten „Heute“ und „Nächster Samstag“
    // dasselbe.
    jest.useFakeTimers().setSystemTime(new Date('2026-11-07T09:00:00'))
    expect(nextSaturdayIso()).toBe('2026-11-07')
    expect(followingSaturdayIso()).toBe('2026-11-14')
  })

  it('unter der Woche ist es der kommende Samstag', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-04T09:00:00'))
    expect(followingSaturdayIso()).toBe('2026-11-07')
    expect(nextSaturdayIso()).toBe('2026-11-07')
  })
})
