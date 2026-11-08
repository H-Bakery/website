import { displayOrder, stopPositions } from './stop-order'

/**
 * Eine Nummer je Stopp für Liste, „Nächster Stopp" und Karte - erledigte
 * zuerst (in Abhakreihenfolge), dann die offenen in Fahrtreihenfolge.
 */
const stop = (
  id: number,
  status: 'open' | 'done' | 'failed' = 'open',
  completedAt: string | null = null
) => ({ id, status, completedAt })

describe('displayOrder', () => {
  it('stellt erledigte vor die offenen, egal wo der Server sie lässt', () => {
    // So kam die Tour nach „Route berechnen" zurück (UI-Runde 1).
    const order = displayOrder([
      stop(7),
      stop(5),
      stop(3, 'done', '2026-11-07T07:10:00.000Z'),
      stop(4, 'failed', '2026-11-07T07:20:00.000Z'),
      stop(2),
      stop(1),
      stop(6),
    ]).map((s) => s.id)
    expect(order).toEqual([3, 4, 7, 5, 2, 1, 6])
  })

  it('sortiert erledigte nach der Abhakzeit, ohne Zeit dahinter', () => {
    const order = displayOrder([
      stop(1, 'done', '2026-11-07T08:00:00.000Z'),
      stop(2, 'done', null),
      stop(3, 'failed', '2026-11-07T07:00:00.000Z'),
    ]).map((s) => s.id)
    expect(order).toEqual([3, 1, 2])
  })
})

describe('stopPositions', () => {
  it('zählt Stopps ohne Koordinaten mit - die Karte nummeriert wie die Liste', () => {
    // Regression: die Karte zählte nur Stopps mit Koordinaten. Fehlte dem
    // ersten die Adresse, trug Stopp 2 auf der Karte die 1.
    const positions = stopPositions([stop(1), stop(2), stop(3)])
    expect(positions.get(2)).toBe(2)
    expect(positions.get(3)).toBe(3)
  })
})
