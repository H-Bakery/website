import React from 'react'
import { screen, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import {
  CellBar,
  cssString,
  pageFooterCss,
  PrintBars,
  PrintCategoryRows,
  PrintDocument,
  PrintKpis,
  PrintNotes,
  printDate,
  subLabel,
} from './FinancePrint'
import { expenseBars } from '../../lib/financeCharts'
import { completeMonthFixture } from '../../lib/financeReportFixtures'
import type { FinanceReportRow } from '../../lib/financeTypes'

const row = (overrides: Partial<FinanceReportRow> = {}): FinanceReportRow => ({
  category: 'personal',
  label: 'Personal',
  kind: 'ausgabe',
  amount: -1200,
  count: 3,
  income: 0,
  expense: -1200,
  share: 0.4,
  subcategories: [
    { key: 'lohn', label: 'Löhne', amount: -1000 },
    { key: 'sv', label: 'Sozialversicherung', amount: -200 },
  ],
  ...overrides,
})

describe('Druckfassung - Rahmen', () => {
  it('Fußzeile mit Seitenzahl über @page, Text sicher als CSS-String', () => {
    expect(cssString('Bäckerei "Heusser" \\ 2026')).toBe(
      '"Bäckerei \\"Heusser\\" \\\\ 2026"'
    )
    const css = pageFooterCss('Bäckerei Heusser · Jahresabschluss 2026')
    expect(css).toContain('size: A4')
    expect(css).toContain(
      '@bottom-left { content: "Bäckerei Heusser · Jahresabschluss 2026"'
    )
    expect(css).toContain('counter(page) " von " counter(pages)')
  })

  it('Datum des Ausdrucks deutsch', () => {
    expect(printDate(new Date(2026, 10, 8))).toBe('08.11.2026')
  })

  it('das Dokument trägt die Fußzeile und ist als Druckfassung erkennbar', () => {
    const { container } = renderWithTheme(
      <PrintDocument footer="Bäckerei Heusser · Test" data-testid="doc">
        <PrintKpis
          items={[{ label: 'Einnahmen', value: '1,00 €', hint: 'x' }]}
        />
      </PrintDocument>
    )
    const doc = screen.getByTestId('doc')
    expect(doc).toHaveClass('fin-print-doc')
    expect(container.querySelector('style')?.textContent).toContain(
      'Bäckerei Heusser · Test'
    )
    expect(within(doc).getByText('Einnahmen')).toBeInTheDocument()
  })
})

describe('Druckfassung - Zeilen', () => {
  it('Kategorie fett, Unterkategorien eingerückt darunter', () => {
    renderWithTheme(
      <table>
        <tbody>
          <PrintCategoryRows row={row()} extra={<td>40 %</td>} extraCount={1} />
        </tbody>
      </table>
    )
    expect(screen.getByTestId('print-row-personal')).toHaveClass('fp-cat')
    const sub = screen.getByTestId('print-sub-personal-lohn')
    expect(sub).toHaveClass('fp-sub')
    // Unterzeile: leere Zellen hinter dem Betrag
    expect(sub.querySelectorAll('td')).toHaveLength(3)
  })

  it('eine einzige Unterkategorie ohne Namen fällt weg, sonst heißt sie „ohne Angabe“', () => {
    expect(subLabel('-')).toBe('ohne Angabe')
    expect(subLabel(' ')).toBe('ohne Angabe')
    expect(subLabel('Lohn')).toBe('Lohn')
    renderWithTheme(
      <table>
        <tbody>
          <PrintCategoryRows
            row={row({
              category: 'offen',
              subcategories: [{ key: 'x', label: '-', amount: -1200 }],
            })}
            extra={null}
            extraCount={0}
          />
        </tbody>
      </table>
    )
    expect(screen.queryByTestId('print-sub-offen-x')).toBeNull()
  })

  it('Mini-Balken in Pixeln - MUI läse 1 als 100 %', () => {
    const { container } = renderWithTheme(
      <>
        <CellBar value={0.004} max={1} color="#000" />
        <CellBar value={-50} max={100} color="#000" width={40} diverging />
      </>
    )
    const spans = Array.from(container.querySelectorAll('span span'))
    const widths = spans.map((s) => getComputedStyle(s).width)
    expect(widths).not.toContain('100%')
    // Verlust: Balken links der Nulllinie (Mitte 20 px), halbe Länge = 10 px
    const negative = spans[spans.length - 1]
    expect(getComputedStyle(negative).left).toBe('10px')
    expect(getComputedStyle(negative).width).toBe('9px')
  })

  it('Rangbalken mit Ø-Strich, ohne Ø mit Anteil', () => {
    const bars = expenseBars(completeMonthFixture().statement)
    const { rerender } = renderWithTheme(
      <PrintBars bars={bars} label="Ausgaben" showAverage averageLabel="Ø 12" />
    )
    const repair = document.querySelector('[data-bar="reparatur"]')
    expect(repair?.querySelector('[data-average="50"]')).not.toBeNull()
    expect(repair?.getAttribute('title')).toMatch(/Ø 12 50,00\s€$/)
    rerender(<PrintBars bars={bars} label="Ausgaben" />)
    expect(document.querySelectorAll('[data-average]')).toHaveLength(0)
  })

  it('Anmerkungen nummeriert, Warnungen mit „Bitte beachten“', () => {
    renderWithTheme(
      <PrintNotes
        notes={[
          { key: 'a', severity: 'info', text: 'Erster Hinweis.' },
          { key: 'b', severity: 'warning', text: 'Zweiter Hinweis.' },
        ]}
      />
    )
    const items = within(screen.getByTestId('print-notes')).getAllByRole(
      'listitem'
    )
    expect(items).toHaveLength(2)
    expect(items[1]).toHaveTextContent('Bitte beachten: Zweiter Hinweis.')
  })
})
