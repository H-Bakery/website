import React from 'react'
import { screen, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import {
  JahresabschlussPrint,
  statusStamp,
  yearDataRange,
} from './JahresabschlussPrint'
import { PRINT_CHART_WIDTH } from '../../../../components/finance/FinanceCharts'
import {
  finalYearFixture,
  provisionalYearFixture,
} from '../../../../lib/financeReportFixtures'

const KPIS = [
  { label: 'Einnahmen', value: '1 €' },
  { label: 'Ausgaben', value: '2 €' },
]

function renderPrint(report = provisionalYearFixture()) {
  return renderWithTheme(
    <JahresabschlussPrint
      report={report}
      kpis={KPIS}
      flowCaption="Bestes Monatsergebnis: Testmonat."
    />
  )
}

describe('JahresabschlussPrint', () => {
  it('Kopf mit Stempel, Zeitraum, Bankdaten dieses Jahres und Fußzeile', () => {
    const { container } = renderPrint()
    const doc = screen.getByTestId('year-print')
    expect(within(doc).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Jahresabschluss 2026Vorläufig'
    )
    // data_from liegt im Vorjahr - gedruckt wird ab dem 1. Januar.
    expect(doc).toHaveTextContent('Bankdaten01.01.2026 – 15.10.2026')
    expect(container.querySelector('style')?.textContent).toContain(
      'Jahresabschluss 2026 (vorläufig)'
    )
    expect(screen.getByTestId('print-kpis')).toHaveTextContent('Einnahmen1 €')
  })

  it('Seite 1: Diagramme in fester Druckbreite, Herkunft und Posten', () => {
    const { container } = renderPrint()
    const svgs = container.querySelectorAll('svg.recharts-surface')
    // Monatsverlauf und aufgelaufenes Ergebnis - ohne `beforeprint`.
    expect(svgs).toHaveLength(2)
    svgs.forEach((svg) =>
      expect(svg.getAttribute('width')).toBe(String(PRINT_CHART_WIDTH))
    )
    expect(
      screen.getByText('Bestes Monatsergebnis: Testmonat.')
    ).toBeInTheDocument()
    expect(screen.getByTestId('print-split')).toBeInTheDocument()
    expect(screen.getByTestId('print-bars')).toBeInTheDocument()
  })

  it('Tabellen auf neuer Seite: Gliederung mit allen Unterkategorien', () => {
    renderPrint()
    const section = screen.getByTestId('print-section-statement')
    expect(section).toHaveClass('fp-page-break')
    expect(screen.getByTestId('print-sub-umsatz-bar')).toHaveTextContent(
      'Bareinzahlungen'
    )
    expect(
      screen.getByTestId('print-sub-wareneinkauf-mehl')
    ).toBeInTheDocument()
    expect(screen.getByTestId('print-result')).toHaveClass('fp-total')
  })

  it('Monate mit aufgelaufenem Ergebnis, Hochrechnung je Monat mit Grundlage', () => {
    renderPrint()
    const months = screen.getByTestId('print-months')
    expect(within(months).getAllByRole('row')).toHaveLength(14) // Kopf + 12 + Summe
    const projection = screen.getByTestId('print-projection')
    const sources = Array.from(projection.querySelectorAll('tr[data-source]'))
    expect(sources).toHaveLength(12)
    expect(sources[9]).toHaveTextContent('Ist + ')
    expect(projection).toHaveTextContent('Hochrechnung 2026')
  })

  it('Anmerkungen nummeriert', () => {
    renderPrint()
    expect(
      within(screen.getByTestId('print-notes')).getAllByRole('listitem')
    ).toHaveLength(3)
  })

  it('abgeschlossenes Jahr: kein Stempel, keine Hochrechnung', () => {
    const final = finalYearFixture()
    expect(statusStamp(final)).toBeUndefined()
    renderPrint(final)
    expect(screen.queryByTestId('print-projection')).toBeNull()
  })

  it('Bankdatenbereich: Jahresgrenzen, ohne Daten keiner', () => {
    const report = provisionalYearFixture()
    expect(yearDataRange(report)).toBe('01.01.2026 – 15.10.2026')
    expect(
      yearDataRange({
        ...report,
        coverage: { ...report.coverage, data_from: null, data_to: null },
      })
    ).toBeNull()
  })
})
