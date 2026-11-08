'use client'
import React from 'react'
import type {
  FinanceReportRow,
  FinanceYearReport,
} from '../../../../lib/financeTypes'
import {
  formatEuro,
  formatMonth,
  formatReportDate,
} from '../../../../lib/reportFormat'
import {
  cumulativePoints,
  expenseBars,
  hasEstimates,
  incomeParts,
  yearFlowPoints,
} from '../../../../lib/financeCharts'
import {
  ChartLegend,
  CumulativeResultChart,
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

/** Monatsname ohne Jahr: `2026-03` → `März` */
function monthName(month: string): string {
  return formatMonth(month).split(' ')[0]
}

const SOURCE_LABEL: Record<string, string> = {
  actual: 'Ist',
  previous_year: 'Vorjahresmonat',
  average: 'Durchschnitt',
  partial_previous_year: 'Ist + Vorjahresmonat',
  partial_average: 'Ist + Durchschnitt',
}

export function statusStamp(report: FinanceYearReport): string | undefined {
  if (report.status === 'provisional') return 'Vorläufig'
  if (report.status === 'incomplete') return 'Unvollständig'
  return undefined
}

/** Bankdaten dieses Jahres, z. B. `01.01.2026 – 06.11.2026`. */
export function yearDataRange(report: FinanceYearReport): string | null {
  const { data_from: from, data_to: to } = report.coverage
  if (!from || !to) return null
  // `coverage.from/to` sind Monate (`2026-01`, `2026-12`).
  const yearStart = `${report.year}-01-01`
  const yearEnd = `${report.year}-12-31`
  const start = from > yearStart ? from : yearStart
  const end = report.as_of ?? (to < yearEnd ? to : yearEnd)
  return `${formatReportDate(start)} – ${formatReportDate(end)}`
}

function ShareCell({
  row,
  max,
  color,
}: {
  row: FinanceReportRow
  max: number
  color: string
}) {
  if (row.share === undefined || row.share === null) return <td />
  return (
    <td>
      <span className="fp-cellbar">
        <CellBar value={row.share} max={max} color={color} />
        <span style={{ minWidth: 38, display: 'inline-block' }}>
          {formatShare(row.share)}
        </span>
      </span>
    </td>
  )
}

function StatementTable({ report }: { report: FinanceYearReport }) {
  const c = useFinanceChartColors()
  const { statement } = report
  const maxShare = (rows: FinanceReportRow[]) =>
    Math.max(0.0001, ...rows.map((row) => row.share ?? 0))
  const section = (
    rows: FinanceReportRow[],
    color: string | null,
    max: number
  ) =>
    rows.map((row) => (
      <PrintCategoryRows
        key={row.category}
        row={row}
        extraCount={2}
        extra={
          <>
            {color ? <ShareCell row={row} max={max} color={color} /> : <td />}
            <td>{row.count}</td>
          </>
        }
      />
    ))
  return (
    <table className="fp-table" data-testid="print-statement">
      <thead>
        <tr>
          <th className="fp-label">Posten</th>
          <th>Betrag</th>
          <th>Anteil</th>
          <th>Buchungen</th>
        </tr>
      </thead>
      <tbody>
        <tr className="fp-group">
          <td colSpan={4}>Einnahmen</td>
        </tr>
        {section(
          statement.income.rows,
          c.income,
          maxShare(statement.income.rows)
        )}
        <tr className="fp-sum">
          <td className="fp-label">Summe Einnahmen</td>
          <td>{formatEuro(statement.income.total)}</td>
          <td />
          <td />
        </tr>
        <tr className="fp-group">
          <td colSpan={4}>Ausgaben</td>
        </tr>
        {section(
          statement.expense.rows,
          c.expense,
          maxShare(statement.expense.rows)
        )}
        <tr className="fp-sum">
          <td className="fp-label">Summe Ausgaben</td>
          <td>{formatEuro(statement.expense.total)}</td>
          <td />
          <td />
        </tr>
        <tr className="fp-total" data-testid="print-result">
          <td className="fp-label">Ergebnis</td>
          <td>{formatEuro(statement.result)}</td>
          <td />
          <td />
        </tr>
        {statement.neutral.rows.length > 0 && (
          <tr className="fp-group">
            <td colSpan={4}>Unter dem Strich (neutral)</td>
          </tr>
        )}
        {section(statement.neutral.rows, null, 1)}
        <tr className="fp-sum">
          <td className="fp-label">Kontoveränderung</td>
          <td>{formatEuro(statement.net_change)}</td>
          <td />
          <td />
        </tr>
      </tbody>
    </table>
  )
}

function MonthsTable({ report }: { report: FinanceYearReport }) {
  const c = useFinanceChartColors()
  const max = Math.max(
    1,
    ...report.months
      .filter((row) => row.coverage !== 'missing')
      .map((row) => Math.abs(row.result))
  )
  return (
    <table className="fp-table" data-testid="print-months">
      <thead>
        <tr>
          <th className="fp-label">Monat</th>
          <th>Einnahmen</th>
          <th>Ausgaben</th>
          <th>Ergebnis</th>
          <th>Seit Jahresbeginn</th>
          <th>Kasse-Umsatz</th>
        </tr>
      </thead>
      <tbody>
        {report.months.map((row) => (
          <tr key={row.month} data-testid={`print-month-${row.month}`}>
            <td className="fp-label">
              {row.label}
              {row.coverage === 'partial' && row.covered_to && (
                <span className="fp-note">
                  bis {formatDayMonth(row.covered_to)}
                </span>
              )}
            </td>
            {row.coverage === 'missing' ? (
              <td colSpan={4} className="fp-muted">
                keine Bankdaten
              </td>
            ) : (
              <>
                <td>{formatEuro(row.income)}</td>
                <td>{formatEuro(row.expense)}</td>
                <td>
                  <span className="fp-cellbar">
                    <CellBar
                      value={row.result}
                      max={max}
                      color={c.ink}
                      width={40}
                      diverging
                    />
                    {formatEuro(row.result)}
                  </span>
                </td>
                <td>
                  {row.cumulative_result === null
                    ? '–'
                    : formatEuro(row.cumulative_result)}
                </td>
              </>
            )}
            <td>{row.kasse ? formatEuro(row.kasse.revenue) : '–'}</td>
          </tr>
        ))}
        <tr className="fp-total">
          <td className="fp-label">{report.year}</td>
          <td>{formatEuro(report.statement.income.total)}</td>
          <td>{formatEuro(report.statement.expense.total)}</td>
          <td>{formatEuro(report.statement.result)}</td>
          <td />
          <td>{report.kasse ? formatEuro(report.kasse.revenue) : '–'}</td>
        </tr>
      </tbody>
    </table>
  )
}

function ProjectionTable({ report }: { report: FinanceYearReport }) {
  const projection = report.projection
  if (!projection) return null
  return (
    <table className="fp-table" data-testid="print-projection">
      <thead>
        <tr>
          <th className="fp-label">Monat</th>
          <th style={{ textAlign: 'left' }}>Grundlage</th>
          <th>Einnahmen</th>
          <th>Ausgaben</th>
          <th>Ergebnis</th>
          <th>Seit Jahresbeginn</th>
        </tr>
      </thead>
      <tbody>
        {projection.basis.map((entry) => {
          const estimated = entry.source !== 'actual'
          const style = estimated ? { fontStyle: 'italic' as const } : undefined
          return (
            <tr key={entry.month} data-source={entry.source}>
              <td className="fp-label">{monthName(entry.month)}</td>
              <td style={{ textAlign: 'left' }}>
                {SOURCE_LABEL[entry.source] ?? entry.source}
              </td>
              <td style={style}>{formatEuro(entry.income)}</td>
              <td style={style}>{formatEuro(entry.expense)}</td>
              <td style={style}>{formatEuro(entry.result)}</td>
              <td style={style}>{formatEuro(entry.cumulative_result)}</td>
            </tr>
          )
        })}
        <tr className="fp-total">
          <td className="fp-label">Hochrechnung {report.year}</td>
          <td />
          <td>{formatEuro(projection.income)}</td>
          <td>{formatEuro(projection.expense)}</td>
          <td>{formatEuro(projection.result)}</td>
          <td />
        </tr>
      </tbody>
    </table>
  )
}

function ReconciliationTable({ report }: { report: FinanceYearReport }) {
  const rec = report.reconciliation
  if (!rec) return null
  return (
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
          <td>{formatEuro(rec.kasse_cash)}</td>
          <td>{formatEuro(rec.bank_cash)}</td>
          <td>{formatSignedEuro(rec.diff_cash)}</td>
        </tr>
        <tr>
          <td className="fp-label">Karte</td>
          <td>{formatEuro(rec.kasse_card)}</td>
          <td>{formatEuro(rec.bank_card)}</td>
          <td>{formatSignedEuro(rec.diff_card)}</td>
        </tr>
        <tr className="fp-sum">
          <td className="fp-label">Zusammen</td>
          <td>{formatEuro(rec.kasse_total)}</td>
          <td>{formatEuro(rec.bank_total)}</td>
          <td>{formatSignedEuro(rec.diff_total)}</td>
        </tr>
      </tbody>
    </table>
  )
}

/**
 * Druckfassung des Jahresabschlusses: Seite 1 Übersicht mit Kennzahlen und
 * Diagrammen, danach die Tabellen und die Anmerkungen.
 */
export function JahresabschlussPrint({
  report,
  kpis,
  flowCaption,
}: {
  report: FinanceYearReport
  kpis: PrintKpi[]
  flowCaption: string
}) {
  const flow = yearFlowPoints(report)
  const legend: LegendKey[] = ['income', 'expense', 'result']
  if (flow.some((p) => p.open)) legend.push('open')
  if (hasEstimates(flow)) legend.push('estimate')
  const cumulative = cumulativePoints(report)
  const showCumulative =
    report.status !== 'incomplete' && cumulative.some((p) => p.actual !== null)
  const parts = incomeParts(report.statement)
  const bars = expenseBars(report.statement)
  const stamp = statusStamp(report)
  const range = yearDataRange(report)
  const created = printDate()

  const meta: [string, string][] = [['Zeitraum', `Jan – Dez ${report.year}`]]
  if (range) meta.push(['Bankdaten', range])
  meta.push(['Erstellt', created])

  let number = 0
  const next = () => ++number

  const footer = `Bäckerei Heusser · Jahresabschluss ${report.year}${
    stamp ? ` (${stamp.toLowerCase()})` : ''
  } · erstellt ${created}`

  return (
    <PrintDocument footer={footer} data-testid="year-print">
      <PrintHeader
        title={`Jahresabschluss ${report.year}`}
        stamp={stamp}
        subtitle="Einnahmen und Ausgaben über das Geschäftskonto – kein steuerlicher Abschluss"
        meta={meta}
      />
      <PrintKpis items={kpis} />

      <PrintSection title="Einnahmen, Ausgaben und Ergebnis je Monat" keep>
        <PrintChart
          label={`Einnahmen, Ausgaben und Ergebnis je Monat ${report.year}`}
          legend={<ChartLegend items={legend} />}
          caption={flowCaption}
        >
          <MonthlyFlowChart points={flow} printHeight={225} fixed />
        </PrintChart>
      </PrintSection>

      {showCumulative && (
        <PrintSection
          title="Ergebnis seit Jahresbeginn"
          intro={
            report.projection
              ? 'Aufgelaufen bis Monatsende, gestrichelt die Hochrechnung bis Dezember.'
              : 'Aufgelaufen bis Monatsende.'
          }
          keep
        >
          <PrintChart label={`Ergebnis aufgelaufen ${report.year}`}>
            <CumulativeResultChart
              points={cumulative}
              printHeight={150}
              fixed
            />
          </PrintChart>
        </PrintSection>
      )}

      {(parts.length > 0 || bars.length > 0) && (
        <div className="fp-columns fp-section">
          <PrintSection
            title="Woher das Geld kam"
            intro={`Einnahmen ${formatEuro(
              report.statement.income.total
            )} nach Herkunft`}
          >
            <PrintSplit
              parts={parts}
              label={`Einnahmen ${report.year} nach Herkunft`}
            />
          </PrintSection>
          <PrintSection
            title="Wohin das Geld ging"
            intro={`Ausgaben ${formatEuro(
              report.statement.expense.total
            )}, die größten Posten`}
          >
            <PrintBars
              bars={bars}
              label={`Ausgaben ${report.year} nach Posten`}
            />
          </PrintSection>
        </div>
      )}

      <PrintSection
        number={next()}
        title="Einnahmen und Ausgaben"
        intro="Alles, was über das Geschäftskonto ging, nach Buchungsdatum. Eingerückt: die Unterkategorien."
        pageBreak
        data-testid="print-section-statement"
      >
        <StatementTable report={report} />
      </PrintSection>

      <PrintSection
        number={next()}
        title="Monat für Monat"
        intro="Ergebnis mit Balken (links Verlust, rechts Gewinn); „Seit Jahresbeginn“ ist das aufgelaufene Ergebnis."
        keep
      >
        <MonthsTable report={report} />
      </PrintSection>

      {report.status === 'provisional' && report.projection && (
        <PrintSection
          number={next()}
          title="Hochrechnung"
          intro={report.projection.method}
          keep
        >
          <ProjectionTable report={report} />
        </PrintSection>
      )}

      <PrintSection
        number={next()}
        title="Kasse und Konto"
        intro={
          report.reconciliation?.from && report.reconciliation.to
            ? `Was die Kasse eingenommen hat und was davon aufs Konto kam – ${monthName(
                report.reconciliation.from
              )} bis ${formatMonth(
                report.reconciliation.to
              )}. Kassenumsatz ${formatEuro(
                report.reconciliation.kasse_revenue
              )} an ${report.reconciliation.kasse_days} Öffnungstagen.`
            : 'Was die Kasse eingenommen hat und was davon aufs Konto kam.'
        }
        keep
      >
        {report.reconciliation ? (
          <ReconciliationTable report={report} />
        ) : (
          <p className="fp-intro">
            Für dieses Jahr gibt es noch keinen vollen Monat mit Bankdaten und
            Kassenberichten.
          </p>
        )}
      </PrintSection>

      {report.notes.length > 0 && (
        <PrintSection number={next()} title="Anmerkungen" keep>
          <PrintNotes notes={report.notes} />
        </PrintSection>
      )}
    </PrintDocument>
  )
}
