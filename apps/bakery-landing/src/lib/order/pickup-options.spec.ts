import { ORDER_CONFIG } from './order-config'
import { pickupDays } from './pickup-options'

it('zeigt 14 Tage ab dem Datum im Laden und schließt Montag sowie Feiertag', () => {
  const days = pickupDays(new Date('2026-12-23T23:30:00Z'), [], {})
  expect(days).toHaveLength(14)
  expect(days[0].date).toBe('2026-12-24')
  expect(days.find(({ date }) => date === '2026-12-25')).toMatchObject({
    reason: 'Feiertag: 1. Weihnachtstag',
    times: [],
  })
  expect(days.find(({ date }) => date === '2026-12-28')).toMatchObject({
    reason: 'Ruhetag',
    times: [],
  })
})

it('zeigt Schließtage und verweist bei Sonderzeiten ans Telefon', () => {
  const days = pickupDays(new Date('2026-11-24T07:00:00Z'), [], {
    '2026-11-25': 'geschlossen',
    '2026-11-26': 'sonderzeiten',
  })
  expect(days[1]).toMatchObject({ reason: 'Laden geschlossen', times: [] })
  expect(days[2]).toMatchObject({
    reason: expect.stringContaining('Sonderöffnungszeiten'),
    times: [],
  })
})

it('wendet den längsten Vorlauf auf den ganzen Korb an', () => {
  const days = pickupDays(
    new Date('2026-11-24T07:00:00Z'),
    [
      { id: 'beispielbrot', category: 'brot' },
      { id: 'beispieltorte', category: 'torten' },
    ],
    {}
  )
  expect(days[0]).toMatchObject({
    reason: expect.stringContaining('zwei Tage'),
    times: [],
  })
  expect(days[1]).toMatchObject({
    reason: expect.stringContaining('zwei Tage'),
    times: [],
  })
  expect(days[2].times[0]).toBe('05:30')
})

it('lässt kurz vor Ladenschluss weder vergangene noch zu knappe Uhrzeiten zu', () => {
  const days = pickupDays(new Date('2026-11-24T11:00:00Z'), [], {})
  expect(days[0].times).toEqual(['13:00'])
  const tooLate = pickupDays(new Date('2026-11-24T11:00:01Z'), [], {})
  expect(tooLate[0]).toMatchObject({
    reason:
      'Heute keine Abholzeit mehr verfügbar. Wir brauchen 60 Minuten Vorlauf.',
    times: [],
  })
})

it('beachtet einen konfigurierten Bestellschluss für den Folgetag', () => {
  const setting = jest.replaceProperty(ORDER_CONFIG, 'nextDayCutoff', '12:00')
  try {
    const before = pickupDays(new Date('2026-11-24T10:59:00Z'), [], {})
    const after = pickupDays(new Date('2026-11-24T11:00:00Z'), [], {})
    expect(before[1].times).not.toHaveLength(0)
    expect(after[1]).toMatchObject({
      reason: 'Bestellschluss für morgen war um 12:00 Uhr.',
      times: [],
    })
  } finally {
    setting.restore()
  }
})
