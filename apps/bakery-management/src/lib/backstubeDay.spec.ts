import {
  BACKSTUBE_SWITCH_HOUR,
  backstubeDates,
  dateForChoice,
  isProductionDay,
  nextLabel,
} from './backstubeDay'

/** Ortszeit des Geräts (wie im Laden), nicht UTC. */
function at(date: string, hour: number, minute = 0): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, hour, minute)
}

describe('Backstube: welcher Tag steht auf dem Tablet', () => {
  it('schaltet um 12 Uhr vom laufenden auf den nächsten Backtag', () => {
    expect(BACKSTUBE_SWITCH_HOUR).toBe(12)
    // Freitag 27.11.2026
    expect(backstubeDates(at('2026-11-27', 1, 30))).toMatchObject({
      today: '2026-11-27',
      next: '2026-11-28',
      auto: 'heute',
    })
    expect(backstubeDates(at('2026-11-27', 11, 59)).auto).toBe('heute')
    expect(backstubeDates(at('2026-11-27', 12, 0)).auto).toBe('morgen')
    expect(backstubeDates(at('2026-11-27', 23, 30)).auto).toBe('morgen')
  })

  it('zeigt am Ruhetag immer den nächsten Backtag', () => {
    // Montag 30.11.2026
    const monday = backstubeDates(at('2026-11-30', 8))
    expect(monday.todayIsProductionDay).toBe(false)
    expect(monday.auto).toBe('morgen')
    expect(dateForChoice(monday, 'morgen')).toBe('2026-12-01')
    expect(dateForChoice(monday, 'heute')).toBe('2026-11-30')
  })

  it('Sonntag nachmittags: der nächste Backtag ist Dienstag', () => {
    const sunday = backstubeDates(at('2026-11-29', 15))
    expect(sunday.next).toBe('2026-12-01')
    expect(sunday.auto).toBe('morgen')
    expect(nextLabel(sunday)).toBe('Di 01.12.')
  })

  it('heißt „Morgen", wenn der nächste Backtag morgen ist', () => {
    expect(nextLabel(backstubeDates(at('2026-11-27', 15)))).toBe('Morgen')
  })

  it('folgt den Produktionstagen aus den Stammdaten', () => {
    const days = [2, 4, 6]
    expect(isProductionDay('2026-11-25', days)).toBe(false)
    const wednesday = backstubeDates(at('2026-11-25', 9), days)
    expect(wednesday.auto).toBe('morgen')
    expect(wednesday.next).toBe('2026-11-26')
    // ohne Stammdaten Di–So
    expect(isProductionDay('2026-11-25', null)).toBe(true)
    expect(isProductionDay('2026-11-30', [])).toBe(false)
  })
})
