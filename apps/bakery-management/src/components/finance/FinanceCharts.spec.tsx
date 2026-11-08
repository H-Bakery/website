import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import {
  CategoryBars,
  ChartLegend,
  CumulativeResultChart,
  formatAxisEuro,
  IncomeSplitBar,
  inkOn,
  MonthlyFlowChart,
  PRINT_CHART_WIDTH,
} from './FinanceCharts'
import {
  cumulativePoints,
  expenseBars,
  incomeParts,
  trendFlowPoints,
  yearFlowPoints,
} from '../../lib/financeCharts'
import {
  completeMonthFixture,
  provisionalYearFixture,
} from '../../lib/financeReportFixtures'

// jsdom misst nichts - ResponsiveContainer gäbe 0 × 0 und zeichnete nichts.
jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts')
  const ReactLib = jest.requireActual('react')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      ReactLib.cloneElement(children, { width: 800, height: 300 }),
  }
})

describe('MonthlyFlowChart', () => {
  it('zeichnet Ist voll, Geschätztes schraffiert und offene Monate gestrichelt', () => {
    const { container } = renderWithTheme(
      <MonthlyFlowChart points={yearFlowPoints(provisionalYearFixture())} />
    )
    const svg = container.querySelector('svg.recharts-surface')
    expect(svg).not.toBeNull()
    const paths = Array.from(container.querySelectorAll('path[fill]'))
    const hatched = paths.filter((p) =>
      p.getAttribute('fill')?.startsWith('url(#fin-hatch-')
    )
    // Oktober bis Dezember, je Einnahmen und Ausgaben.
    expect(hatched).toHaveLength(6)
    expect(container.querySelectorAll('pattern')).toHaveLength(2)
    expect(
      container.querySelector('path.recharts-curve[stroke-dasharray="5 4"]')
    ).not.toBeNull()
    // Achse mit Monatskürzel, offener Monat mit Sternchen, Jahr darunter.
    expect(screen.getByText('Okt*')).toBeInTheDocument()
    // November und Dezember sind nur geschätzt, nicht angebrochen.
    expect(screen.getByText('Dez')).toBeInTheDocument()
    expect(screen.getByText('2026')).toBeInTheDocument()
  })

  it('hebt in der Monatsanalyse den Monat hervor und dimmt die anderen', () => {
    const report = completeMonthFixture()
    const { container } = renderWithTheme(
      <MonthlyFlowChart
        points={trendFlowPoints(report)}
        highlight={report.month}
      />
    )
    expect(container.querySelector('.recharts-reference-area')).not.toBeNull()
    const bars = Array.from(
      container.querySelectorAll(
        'path[fill-opacity]:not(.recharts-reference-area-rect)'
      )
    )
    expect(
      bars.filter((p) => p.getAttribute('fill-opacity') === '1')
    ).toHaveLength(2)
    expect(
      bars.filter((p) => p.getAttribute('fill-opacity') === '0.45').length
    ).toBeGreaterThan(20)
  })

  it('druckt mit fester Breite statt der Bildschirmbreite', () => {
    const { container } = renderWithTheme(
      <MonthlyFlowChart points={yearFlowPoints(provisionalYearFixture())} />
    )
    expect(
      container.querySelector('svg.recharts-surface')?.getAttribute('width')
    ).toBe('800')
    act(() => {
      window.dispatchEvent(new Event('beforeprint'))
    })
    expect(container.querySelector('.fin-chart-print')).not.toBeNull()
    const svg = container.querySelector('svg.recharts-surface')
    expect(svg?.getAttribute('width')).toBe(String(PRINT_CHART_WIDTH))
    expect(svg?.getAttribute('viewBox')).toBe(`0 0 ${PRINT_CHART_WIDTH} 250`)
    act(() => {
      window.dispatchEvent(new Event('afterprint'))
    })
    expect(container.querySelector('.fin-chart-print')).toBeNull()
  })
})

describe('CumulativeResultChart', () => {
  it('beschriftet nur das Ende der Hochrechnung', () => {
    renderWithTheme(
      <CumulativeResultChart
        points={cumulativePoints(provisionalYearFixture())}
      />
    )
    expect(
      screen.getByText(/^Hochrechnung\s20\.000,00\s€$/)
    ).toBeInTheDocument()
    expect(screen.queryByText(/^16\.000,00\s€$/)).toBeNull()
  })
})

describe('IncomeSplitBar', () => {
  it('Anteile im Teil ab 12 %, Legende mit Namen und Betrag, Schrift nach Kontrast', () => {
    const parts = incomeParts(provisionalYearFixture().statement)
    renderWithTheme(<IncomeSplitBar parts={parts} label="Einnahmen 2026" />)
    const bar = screen.getByRole('img', {
      name: /^Einnahmen 2026: Bareinzahlungen/,
    })
    const blocks = bar.querySelectorAll('[data-part]')
    expect(blocks).toHaveLength(4)
    expect(blocks[0]).toHaveTextContent('52,1 %')
    expect(blocks[1]).toHaveTextContent('39,6 %')
    // 6,3 % und 2,1 % sind zu schmal für eine Zahl.
    expect(blocks[2]).toHaveTextContent('')
    expect(blocks[0].getAttribute('data-ink')).toBe('light')
    expect(blocks[3].getAttribute('data-ink')).toBe('dark')
    expect(screen.getByText('Verkaufspartner')).toBeInTheDocument()
  })
})

describe('CategoryBars', () => {
  it('Ränge mit Betrag und Anteil', () => {
    renderWithTheme(
      <CategoryBars
        bars={expenseBars(provisionalYearFixture().statement)}
        label="Ausgaben 2026"
      />
    )
    const list = screen.getByRole('list', { name: 'Ausgaben 2026' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items[0]).toHaveTextContent(/Wareneinkauf40\.000,00\s€50 %/)
    expect(list.querySelectorAll('[data-average]')).toHaveLength(0)
  })

  it('mit Ø: ein Strich je Posten, der Balken skaliert auf den größten Wert', () => {
    renderWithTheme(
      <CategoryBars
        bars={expenseBars(completeMonthFixture().statement)}
        label="Ausgaben September"
        showAverage
        averageLabel="Ø 12 Monate"
      />
    )
    const repair = document.querySelector(
      '[data-bar="reparatur"]'
    ) as HTMLElement
    expect(repair.getAttribute('title')).toMatch(
      /^Reparaturen: 1\.000,00\s€ · Ø 12 Monate 50,00\s€$/
    )
    expect(repair.querySelector('[data-average="50"]')).not.toBeNull()
  })
})

describe('Hilfen', () => {
  it('Legende mit eigener Beschriftung', () => {
    render(
      <ChartLegend
        items={['expense', 'average']}
        labels={{ average: 'Ø 12 Monate' }}
      />
    )
    expect(screen.getByText('Ausgaben')).toBeInTheDocument()
    expect(screen.getByText('Ø 12 Monate')).toBeInTheDocument()
  })

  it('Achse und Schriftfarbe', () => {
    expect(formatAxisEuro(12000)).toMatch(/^12\.000\s€$/)
    expect(formatAxisEuro(-180000)).toBe('-180 T€')
    expect(inkOn('#1c5cab')).toBe('#ffffff')
    expect(inkOn('#86b6ef')).toBe('#0b0b0b')
  })
})
