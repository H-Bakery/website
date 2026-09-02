import React from 'react'
import { render } from '@testing-library/react'
import { RevenueTrendChart } from './revenue-trend-chart'

// jsdom hat kein Layout: der ResponsiveContainer misst 0 × 0 und zeichnet
// nichts. Feste Maße durchreichen, damit Recharts Achsen und Ticks rendert.
jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts')
  const { cloneElement } = jest.requireActual('react')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: unknown }) =>
      cloneElement(children, { width: 800, height: 400 }),
  }
})

const data = [
  { date: '2026-08-01', revenue: 1500, transactionCount: 90 },
  { date: '2026-08-02', revenue: 2300, transactionCount: 110 },
  { date: '2026-08-03', revenue: 1900, transactionCount: 95 },
]

function revenueTickLabels(container: HTMLElement) {
  return (
    Array.from(
      container.querySelectorAll(
        '.recharts-yAxis .recharts-cartesian-axis-tick-value'
      )
    )
      // Intl setzt ein geschütztes Leerzeichen vor das €-Zeichen.
      .map((tick) => (tick.textContent ?? '').replace(/\u00a0/g, ' '))
      .filter((label) => label.endsWith('€'))
  )
}

describe('RevenueTrendChart', () => {
  it('beschriftet die Umsatzachse ohne Cent, damit die Beträge in die Achse passen', () => {
    const { container } = render(
      <RevenueTrendChart data={data} showTransactions />
    )

    const labels = revenueTickLabels(container)
    expect(labels.length).toBeGreaterThan(1)
    expect(labels).toContain('0 €')
    for (const label of labels) {
      expect(label).toMatch(/^\d{1,3}(\.\d{3})* €$/)
      expect(label).not.toMatch(/,00 €$/)
    }
  })

  it('reserviert 80 px für die Umsatzachse statt der 60 px Vorgabe', () => {
    const { container } = render(<RevenueTrendChart data={data} />)

    // Chart-Rand links ist 5 px; die Achsenlinie sitzt am rechten Rand der Achse.
    const axisLine = container.querySelector(
      '.recharts-yAxis .recharts-cartesian-axis-line'
    )
    expect(axisLine?.getAttribute('x1')).toBe('85')
  })
})
