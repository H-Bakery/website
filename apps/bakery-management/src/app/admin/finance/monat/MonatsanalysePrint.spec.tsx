import React from 'react'
import { screen, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import { MonatsanalysePrint } from './MonatsanalysePrint'
import { comparisonRows } from './MonatsanalyseClient'
import {
  completeMonthFixture,
  partialMonthFixture,
} from '../../../../lib/financeReportFixtures'
import type { FinanceMonthReport } from '../../../../lib/financeTypes'

function renderPrint(report: FinanceMonthReport) {
  return renderWithTheme(
    <MonatsanalysePrint
      report={report}
      kpis={[{ label: 'Einnahmen', value: '1 €' }]}
      trendCaption="Verlauf in einem Satz."
      highlightsEmptyText="Noch nichts zu sagen."
      comparisonRows={comparisonRows(report)}
      notes={report.notes.filter((note) => note.key !== 'partial')}
    />
  )
}

describe('MonatsanalysePrint', () => {
  it('vollständiger Monat: Verlauf, Auffälligkeiten, Ø-Spalten und Vergleich', () => {
    const report = completeMonthFixture()
    const { container } = renderPrint(report)
    const doc = screen.getByTestId('month-print')
    expect(within(doc).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Monatsanalyse September 2026'
    )
    expect(container.querySelector('svg.recharts-surface')).not.toBeNull()
    expect(screen.getByText('Verlauf in einem Satz.')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('print-highlights')).getAllByRole('listitem')
    ).toHaveLength(report.highlights.length)
    const expense = screen.getByTestId('print-expense')
    expect(expense).toHaveTextContent('Ø 12 Monate')
    expect(expense).toHaveTextContent('Abweichung')
    expect(screen.getByTestId('print-comparison')).toHaveTextContent(
      'Vormonat (August 2026)'
    )
    expect(document.querySelectorAll('[data-average]').length).toBeGreaterThan(
      0
    )
  })

  it('angebrochener Monat: Stempel, kein Ø, Hinweis statt Auffälligkeiten', () => {
    const report = partialMonthFixture()
    renderPrint(report)
    const doc = screen.getByTestId('month-print')
    expect(within(doc).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Monatsanalyse Oktober 2026Unvollständig'
    )
    expect(screen.getByText('Noch nichts zu sagen.')).toBeInTheDocument()
    expect(screen.getByTestId('print-expense')).not.toHaveTextContent(
      'Abweichung'
    )
    expect(screen.queryByTestId('print-comparison')).toBeNull()
    expect(document.querySelectorAll('[data-average]')).toHaveLength(0)
  })
})
