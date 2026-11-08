'use client'
import React from 'react'
import type {
  FinanceMonthReport,
  FinanceReportNote,
  FinanceReportRow,
} from '../../../../lib/financeTypes'
import {
  formatEuro,
  formatMonth,
  formatReportDate,
} from '../../../../lib/reportFormat'
import {
  expenseBars,
  incomeParts,
  trendFlowPoints,
} from '../../../../lib/financeCharts'
import {
  ChartLegend,
  MonthlyFlowChart,
  useFinanceChartColors,
  type LegendKey,
} from '../../../../components/finance/FinanceCharts'
import {
  formatDayMonth,
  formatShare,
  formatSignedEuro,
} from '../../../../components/finance/FinanceReportParts'
import {
  CellBar,
  ComparisonCells,
  PrintBars,
  PrintCategoryRows,
  PrintChart,
  PrintDocument,
  PrintHeader,
  PrintKpis,
  PrintNotes,
  PrintSection,
  PrintSplit,
  printDate,
  type PrintKpi,
} from '../../../../components/finance/FinancePrint'
import type { ComparisonRow } from './MonatsanalyseClient'

/** Pfeil vor einer Auffälligkeit - Text trägt die Aussage, das Zeichen hilft beim Überfliegen. */
const HIGHLIGHT_MARK: Record<string, string> = {
  expense_high: '▲',
  expense_new: '●',
  expense_missing: '○',
  income_high: '▲',
  income_low: '▼',
}

function RowsTable({
  rows,
  total,
  totalLabel,
  section,
  comparison,
  averageLabel,
  testId,
}: {
  rows: FinanceReportRow[]
  total: number
  totalLabel: string
  section: 'income' | 'expense'
  comparison: boolean
  averageLabel: string
  testId: string
}) {
  const c = useFinanceChartColors()
  if (rows.length === 0) {
    return <p className="fp-intro">Keine Buchungen.</p>
  }
  const color = section === 'income' ? c.income : c.expense
  const max = Math.max(0.0001, ...rows.map((row) => row.share ?? 0))
  const extraCount = 1 + (comparison ? 2 : 0)
  return (
    <table className="fp-table" data-testid={testId}>
      <thead>
        <tr>
          <th className="fp-label">Posten</th>
          <th>Betrag</th>
          <th>Anteil</th>
          {comparison && (
            <>
              <th>{averageLabel}</th>
              <th>Abweichung</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <PrintCategoryRows
            key={row.category}
            row={row}
            extraCount={extraCount}
            extra={
              <>
                <td>
                  {row.share === undefined || row.share === null ? (
                    ''
                  ) : (
                    <span className="fp-cellbar">
                      <CellBar value={row.share} max={max} color={color} />
                      <span style={{ minWidth: 38, display: 'inline-block' }}>
                        {formatShare(row.share)}
                      </span>
                    </span>
                  )}
                </td>
                {comparison && <ComparisonCells row={row} section={section} />}
              </>
            }
          />
        ))}
        <tr className="fp-sum">
          <td className="fp-label">{totalLabel}</td>
          <td>{formatEuro(total)}</td>
          {Array.from({ length: extraCount }, (_, i) => (
            <td key={i} />
          ))}
        </tr>
      </tbody>
    </table>
  )
}

/**
 * Druckfassung der Monatsanalyse: Seite 1 Kennzahlen, Verlauf,
 * Auffälligkeiten und Herkunft/Verwendung; danach die Tabellen.
 */
export function MonatsanalysePrint({
  report,
  kpis,
  trendCaption,
  highlightsEmptyText,
  comparisonRows,
  notes,
}: {
  report: FinanceMonthReport
  kpis: PrintKpi[]
  trendCaption: string
  highlightsEmptyText: string
  comparisonRows: ComparisonRow[]
  notes: FinanceReportNote[]
}) {
  const complete = report.coverage.status === 'complete'
  const avg = report.comparison.average
  const comparison = avg !== null
  const averageLabel = avg ? `Ø ${avg.months} Monate` : 'Ø'
  const { statement } = report
  const points = trendFlowPoints(report)
  const legend: LegendKey[] = ['income', 'expense', 'result']
  if (points.some((p) => p.open)) legend.push('open')
  const parts = incomeParts(statement)
  const bars = expenseBars(statement)
  const created = printDate()

  const meta: [string, string][] = []
  if (report.coverage.from && report.coverage.to) {
    meta.push([
      'Bankdaten',
      `${formatReportDate(report.coverage.from)} – ${formatReportDate(
        report.coverage.to
      )}`,
    ])
  }
  if (avg) {
    meta.push([
      'Vergleich',
      `Ø ${formatMonth(avg.from)} – ${formatMonth(avg.to)}`,
    ])
  }
  meta.push(['Erstellt', created])

  let number = 0
  const next = () => ++number

  const footer = `Bäckerei Heusser · Monatsanalyse ${report.label}${
    complete ? '' : ` (bis ${formatDayMonth(report.coverage.to)})`
  } · erstellt ${created}`

  return (
    <PrintDocument footer={footer} data-testid="month-print">
      <PrintHeader
        title={`Monatsanalyse ${report.label}`}
        stamp={complete ? undefined : 'Unvollständig'}
        subtitle="Woher das Geld kam und wohin es ging – über das Geschäftskonto"
        meta={meta}
      />
      <PrintKpis items={kpis} />

      {points.length > 0 && (
        <PrintSection
          title={`Die letzten ${points.length} Monate`}
          intro="Einnahmen nach oben, Ausgaben nach unten, die Linie ist das Ergebnis; hinterlegt der Monat dieser Analyse."
          keep
        >
          <PrintChart
            label={`Einnahmen, Ausgaben und Ergebnis der letzten ${points.length} Monate bis ${report.label}`}
            legend={<ChartLegend items={legend} />}
            caption={trendCaption}
          >
            <MonthlyFlowChart
              points={points}
              highlight={report.month}
              printHeight={210}
              fixed
            />
          </PrintChart>
        </PrintSection>
      )}

      <PrintSection
        title="Auffälligkeiten"
        intro={
          avg && report.highlights_reason === null
            ? `Gegenüber dem Durchschnitt von ${formatMonth(
                avg.from
              )} bis ${formatMonth(avg.to)}.`
            : undefined
        }
        keep
        data-testid="print-highlights"
      >
        {report.highlights.length > 0 ? (
          <ul
            style={{
              margin: 0,
              paddingLeft: 0,
              listStyle: 'none',
              display: 'grid',
              rowGap: 3,
              fontSize: '9pt',
            }}
          >
            {report.highlights.map((item, index) => (
              <li
                key={`${item.kind}-${item.category ?? index}`}
                data-kind={item.kind}
                style={{ display: 'flex', gap: 8, breakInside: 'avoid' }}
              >
                <span aria-hidden style={{ width: 10, flex: '0 0 auto' }}>
                  {HIGHLIGHT_MARK[item.kind] ?? '•'}
                </span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fp-intro">{highlightsEmptyText}</p>
        )}
      </PrintSection>

      {(parts.length > 0 || bars.length > 0) && (
        <div className="fp-columns fp-section">
          <PrintSection
            title="Woher das Geld kam"
            intro={`Einnahmen ${formatEuro(
              statement.income.total
            )} nach Herkunft`}
          >
            <PrintSplit
              parts={parts}
              label={`Einnahmen ${report.label} nach Herkunft`}
            />
          </PrintSection>
          <PrintSection
            title="Wohin das Geld ging"
            intro={
              comparison
                ? `Ausgaben ${formatEuro(
                    statement.expense.total
                  )}; der Strich ist der ${averageLabel}`
                : `Ausgaben ${formatEuro(
                    statement.expense.total
                  )}, die größten Posten`
            }
          >
            <PrintBars
              bars={bars}
              showAverage={comparison}
              averageLabel={averageLabel}
              label={`Ausgaben ${report.label} nach Posten`}
            />
          </PrintSection>
        </div>
      )}

      <PrintSection
        number={next()}
        title="Einnahmen nach Art"
        intro={
          comparison
            ? `Mit dem Durchschnitt der ${avg?.months} vollen Monate davor.`
            : 'Ein Vergleich mit dem Durchschnitt folgt, wenn der Monat vollständig ist.'
        }
        pageBreak
        keep
      >
        <RowsTable
          rows={statement.income.rows}
          total={statement.income.total}
          totalLabel="Summe Einnahmen"
          section="income"
          comparison={comparison}
          averageLabel={averageLabel}
          testId="print-income"
        />
      </PrintSection>

      <PrintSection
        number={next()}
        title="Ausgaben nach Art"
        intro="Die größten zuerst, eingerückt die Unterkategorien."
      >
        <RowsTable
          rows={statement.expense.rows}
          total={statement.expense.total}
          totalLabel="Summe Ausgaben"
          section="expense"
          comparison={comparison}
          averageLabel={averageLabel}
          testId="print-expense"
        />
      </PrintSection>

      <PrintSection
        number={next()}
        title="Ergebnis und Kontoveränderung"
        intro="Privat, Darlehen und Umbuchungen ändern den Kontostand, nicht das Ergebnis."
        keep
      >
        <table className="fp-table" data-testid="print-neutral">
          <tbody>
            <tr className="fp-cat">
              <td className="fp-label">Einnahmen</td>
              <td>{formatEuro(statement.income.total)}</td>
            </tr>
            <tr className="fp-cat">
              <td className="fp-label">Ausgaben</td>
              <td>{formatEuro(statement.expense.total)}</td>
            </tr>
            <tr className="fp-total">
              <td className="fp-label">Ergebnis</td>
              <td>{formatEuro(statement.result)}</td>
            </tr>
            {statement.neutral.rows.map((row) => (
              <PrintCategoryRows
                key={row.category}
                row={row}
                extra={null}
                extraCount={0}
              />
            ))}
            <tr className="fp-sum">
              <td className="fp-label">Kontoveränderung</td>
              <td>{formatEuro(statement.net_change)}</td>
            </tr>
          </tbody>
        </table>
      </PrintSection>

      <PrintSection
        number={next()}
        title="Im Vergleich"
        intro="Einnahmen, Ausgaben und Ergebnis anderer Monate."
        keep
      >
        {comparisonRows.length > 0 ? (
          <table className="fp-table" data-testid="print-comparison">
            <thead>
              <tr>
                <th className="fp-label">Vergleich mit</th>
                <th>Einnahmen</th>
                <th>Ausgaben</th>
                <th>Ergebnis</th>
                <th>{report.label} dagegen</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.key}>
                  <td className="fp-label">{row.label}</td>
                  <td>{formatEuro(row.data.income)}</td>
                  <td>{formatEuro(row.data.expense)}</td>
                  <td>{formatEuro(row.data.result)}</td>
                  <td>
                    {row.diff === null ? '–' : formatSignedEuro(row.diff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="fp-intro">
            {complete
              ? 'Noch keine Vergleichsmonate.'
              : 'Der Vergleich folgt, wenn der Monat vollständig ist.'}
          </p>
        )}
      </PrintSection>

      <PrintSection
        number={next()}
        title="Kasse und Konto"
        intro={
          report.kasse
            ? `Was die Kasse eingenommen hat und was davon aufs Konto kam. Kassenumsatz ${formatEuro(
                report.kasse.revenue
              )} an ${report.kasse.days} Öffnungstagen.`
            : 'Was die Kasse eingenommen hat und was davon aufs Konto kam.'
        }
        keep
      >
        {report.reconciliation ? (
          <table className="fp-table" data-testid="print-reconciliation">
            <thead>
              <tr>
                <th className="fp-label">Zahlart</th>
                <th>Kasse</th>
                <th>aufs Konto</th>
                <th>Differenz</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="fp-label">Bar</td>
                <td>{formatEuro(report.reconciliation.kasse_cash)}</td>
                <td>{formatEuro(report.reconciliation.bank_cash)}</td>
                <td>{formatSignedEuro(report.reconciliation.diff_cash)}</td>
              </tr>
              <tr>
                <td className="fp-label">Karte</td>
                <td>{formatEuro(report.reconciliation.kasse_card)}</td>
                <td>{formatEuro(report.reconciliation.bank_card)}</td>
                <td>{formatSignedEuro(report.reconciliation.diff_card)}</td>
              </tr>
              <tr className="fp-sum">
                <td className="fp-label">Zusammen</td>
                <td>{formatEuro(report.reconciliation.kasse_total)}</td>
                <td>{formatEuro(report.reconciliation.bank_total)}</td>
                <td>{formatSignedEuro(report.reconciliation.diff_total)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="fp-intro">
            {complete
              ? 'Für diesen Monat gibt es keine Kassenberichte.'
              : 'Der Abgleich folgt, wenn der Monat vollständig ist.'}
          </p>
        )}
        {report.kasse_previous_year && (
          <p className="fp-intro" style={{ marginTop: 4 }}>
            Kasse im Vorjahresmonat:{' '}
            {formatEuro(report.kasse_previous_year.revenue)} an{' '}
            {report.kasse_previous_year.days} Öffnungstagen (Ø{' '}
            {formatEuro(report.kasse_previous_year.avg_day)} je Tag).
          </p>
        )}
      </PrintSection>

      {notes.length > 0 && (
        <PrintSection number={next()} title="Anmerkungen" keep>
          <PrintNotes notes={notes} />
        </PrintSection>
      )}
    </PrintDocument>
  )
}
