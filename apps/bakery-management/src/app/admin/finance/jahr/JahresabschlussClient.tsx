'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Print as PrintIcon,
} from '@mui/icons-material'
import { useSession } from '../../../../lib/session'
import {
  classifyFinanceError,
  fetchYearReport,
  type FinanceAccessProblem,
} from '../../../../lib/financeApi'
import type {
  FinanceYearMonthRow,
  FinanceYearReport,
} from '../../../../lib/financeTypes'
import {
  formatEuro,
  formatMonth,
  formatReportDate,
} from '../../../../lib/reportFormat'
import {
  EmptyState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
  type KeyFigure,
} from '../../../../components/layout'
import {
  CategoryBars,
  ChartFigure,
  ChartLegend,
  CumulativeResultChart,
  IncomeSplitBar,
  MonthlyFlowChart,
  type LegendKey,
} from '../../../../components/finance/FinanceCharts'
import {
  cumulativePoints,
  expenseBars,
  flowExtremes,
  hasEstimates,
  incomeParts,
  yearFlowPoints,
} from '../../../../lib/financeCharts'
import {
  FinanceAccessNotice,
  FinanceReportPrintStyles,
  formatDayMonth,
  PrintOnlyLine,
  ReconciliationTable,
  ReportNotes,
  SM_UP_CELL,
  StatementRow,
  StatementSumRow,
  type StatementRowOptions,
} from '../../../../components/finance/FinanceReportParts'
import { JahresabschlussPrint } from './JahresabschlussPrint'

const TITLE = 'Jahresabschluss'
const SUBTITLE =
  'Einnahmen und Ausgaben über das Geschäftskonto – kein steuerlicher Abschluss'

type PageState =
  | { phase: 'loading' }
  | { phase: 'access'; kind: FinanceAccessProblem; message: string }
  | { phase: 'no-data'; reason: string }
  | { phase: 'ok'; report: FinanceYearReport }

export function yearHref(year: string): string {
  return `/admin/finance/jahr?jahr=${encodeURIComponent(year)}`
}

export function monthHref(month: string): string {
  return `/admin/finance/monat/${month}`
}

/** Status-Chip: Text trägt die Aussage, keine Signalfarbe. */
export function yearStatusLabel(report: FinanceYearReport): string {
  if (report.status === 'final') return 'Abgeschlossen'
  if (report.status === 'incomplete') return 'Unvollständig'
  return report.as_of
    ? `Vorläufig · Stand ${formatReportDate(report.as_of)}`
    : 'Vorläufig'
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

const STATEMENT_OPTIONS: StatementRowOptions = {
  showShare: true,
  showCount: true,
}

function SectionHeadRow({ label }: { label: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={4}
        sx={{
          pt: 2.5,
          fontWeight: 600,
          color: 'text.secondary',
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </TableCell>
    </TableRow>
  )
}

function StatementTable({ report }: { report: FinanceYearReport }) {
  const { statement } = report
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table
        size="small"
        aria-label={`Einnahmen und Ausgaben ${report.year}`}
        data-testid="statement"
        sx={{ minWidth: 300 }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Posten</TableCell>
            <TableCell align="right">Betrag</TableCell>
            <TableCell align="right">Anteil</TableCell>
            <TableCell align="right" sx={SM_UP_CELL}>
              Buchungen
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <SectionHeadRow label="Einnahmen" />
          {statement.income.rows.map((row) => (
            <StatementRow
              key={row.category}
              row={row}
              options={STATEMENT_OPTIONS}
            />
          ))}
          <StatementSumRow
            label="Summe Einnahmen"
            amount={statement.income.total}
            options={STATEMENT_OPTIONS}
            strong={false}
            testId="sum-income"
          />
          <SectionHeadRow label="Ausgaben" />
          {statement.expense.rows.map((row) => (
            <StatementRow
              key={row.category}
              row={row}
              options={STATEMENT_OPTIONS}
            />
          ))}
          <StatementSumRow
            label="Summe Ausgaben"
            amount={statement.expense.total}
            options={STATEMENT_OPTIONS}
            strong={false}
            testId="sum-expense"
          />
          <StatementSumRow
            label="Ergebnis"
            amount={statement.result}
            options={STATEMENT_OPTIONS}
            testId="sum-result"
          />
          {statement.neutral.rows.length > 0 && (
            <SectionHeadRow label="Unter dem Strich (neutral)" />
          )}
          {statement.neutral.rows.map((row) => (
            <StatementRow
              key={row.category}
              row={row}
              options={STATEMENT_OPTIONS}
            />
          ))}
          <StatementSumRow
            label="Kontoveränderung"
            amount={statement.net_change}
            options={STATEMENT_OPTIONS}
            testId="sum-net-change"
          />
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function MonthLabel({ row }: { row: FinanceYearMonthRow }) {
  const label = row.has_data ? (
    <MuiLink
      component={NextLink}
      href={monthHref(row.month)}
      aria-label={`Monatsanalyse ${formatMonth(row.month)}`}
    >
      {row.label}
    </MuiLink>
  ) : (
    <span>{row.label}</span>
  )
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1 }}>
      {label}
      {row.coverage === 'partial' && row.covered_to && (
        <Typography
          component="span"
          variant="body2"
          color="text.secondary"
          data-testid={`partial-${row.month}`}
        >
          bis {formatDayMonth(row.covered_to)}
        </Typography>
      )}
    </Box>
  )
}

function MonthsTable({ report }: { report: FinanceYearReport }) {
  const cell = {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  } as const
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table
        size="small"
        aria-label={`Monate ${report.year}`}
        data-testid="months-table"
        sx={{ minWidth: 520 }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Monat</TableCell>
            <TableCell align="right">Einnahmen</TableCell>
            <TableCell align="right">Ausgaben</TableCell>
            <TableCell align="right">Ergebnis</TableCell>
            <TableCell align="right">Kasse-Umsatz</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {report.months.map((row) => {
            const missing = row.coverage === 'missing'
            return (
              <TableRow
                key={row.month}
                data-testid={`month-${row.month}`}
                data-coverage={row.coverage}
              >
                <TableCell
                  sx={missing ? { color: 'text.secondary' } : undefined}
                >
                  <MonthLabel row={row} />
                </TableCell>
                {missing ? (
                  <TableCell
                    colSpan={3}
                    align="right"
                    sx={{ color: 'text.secondary', fontStyle: 'italic' }}
                  >
                    keine Bankdaten
                  </TableCell>
                ) : (
                  <>
                    <TableCell align="right" sx={cell}>
                      {formatEuro(row.income)}
                    </TableCell>
                    <TableCell align="right" sx={cell}>
                      {formatEuro(row.expense)}
                    </TableCell>
                    <TableCell align="right" sx={cell}>
                      {formatEuro(row.result)}
                    </TableCell>
                  </>
                )}
                <TableCell
                  align="right"
                  sx={{
                    ...cell,
                    color: row.kasse ? undefined : 'text.secondary',
                  }}
                >
                  {row.kasse ? formatEuro(row.kasse.revenue) : '–'}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>
              {report.year}
            </TableCell>
            {[
              report.statement.income.total,
              report.statement.expense.total,
              report.statement.result,
            ].map((value, index) => (
              <TableCell
                key={index}
                align="right"
                sx={{ ...cell, fontWeight: 700, color: 'text.primary' }}
              >
                {formatEuro(value)}
              </TableCell>
            ))}
            <TableCell
              align="right"
              sx={{ ...cell, fontWeight: 700, color: 'text.primary' }}
            >
              {report.kasse ? formatEuro(report.kasse.revenue) : '–'}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </TableContainer>
  )
}

function YearSwitcher({
  report,
  onChange,
}: {
  report: FinanceYearReport
  onChange: (year: string) => void
}) {
  const years = report.years.includes(report.year)
    ? report.years
    : [report.year, ...report.years]
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <IconButton
        aria-label="Vorjahr"
        disabled={!report.previous_year}
        onClick={() => report.previous_year && onChange(report.previous_year)}
      >
        <PrevIcon />
      </IconButton>
      <FormControl size="small" sx={{ minWidth: 104 }}>
        <InputLabel id="jahresabschluss-jahr-label">Jahr</InputLabel>
        <Select
          labelId="jahresabschluss-jahr-label"
          label="Jahr"
          value={report.year}
          onChange={(event) => onChange(String(event.target.value))}
        >
          {years.map((year) => (
            <MenuItem key={year} value={year}>
              {year}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <IconButton
        aria-label="Folgejahr"
        disabled={!report.next_year}
        onClick={() => report.next_year && onChange(report.next_year)}
      >
        <NextIcon />
      </IconButton>
    </Box>
  )
}

/** Ein Satz unter dem Säulendiagramm: was man ablesen soll. */
export function yearFlowCaption(report: FinanceYearReport): string {
  const points = yearFlowPoints(report)
  const parts: string[] = []
  const missing = report.coverage.missing_before
  if (missing.length > 0) {
    const first = formatMonth(missing[0]).split(' ')[0]
    const last = formatMonth(missing[missing.length - 1]).split(' ')[0]
    parts.push(
      missing.length === 1
        ? `Für ${first} gibt es noch keine Bankdaten.`
        : `Für ${first} bis ${last} gibt es noch keine Bankdaten.`
    )
  }
  const extremes = flowExtremes(points)
  if (extremes) {
    parts.push(
      `Bestes Monatsergebnis: ${extremes.best.title} (${formatEuro(
        extremes.best.result ?? 0
      )}), schwächstes: ${extremes.worst.title} (${formatEuro(
        extremes.worst.result ?? 0
      )}).`
    )
  }
  const partial = report.months.find((row) => row.coverage === 'partial')
  if (partial?.covered_to) {
    parts.push(
      `* ${partial.label} läuft noch (Bankdaten bis ${formatDayMonth(
        partial.covered_to
      )}).`
    )
  }
  if (hasEstimates(points)) {
    parts.push(
      'Schraffiert: geschätzt aus dem Vorjahresmonat bzw. dem Durchschnitt – siehe Hochrechnung.'
    )
  }
  return parts.join(' ')
}

function YearCharts({ report }: { report: FinanceYearReport }) {
  const router = useRouter()
  const flow = yearFlowPoints(report)
  const estimates = hasEstimates(flow)
  const open = flow.some((p) => p.open)
  const legend: LegendKey[] = ['income', 'expense', 'result']
  if (open) legend.push('open')
  if (estimates) legend.push('estimate')
  const cumulative = cumulativePoints(report)
  const showCumulative =
    report.status !== 'incomplete' &&
    cumulative.filter((p) => p.actual !== null).length > 0
  const parts = incomeParts(report.statement)
  const bars = expenseBars(report.statement)
  return (
    <>
      <Box className="fin-keep">
        <PageSection
          title="Das Jahr im Verlauf"
          description="Einnahmen nach oben, Ausgaben nach unten, die Linie ist das Ergebnis des Monats. Tipp auf einen Monat zeigt die Zahlen; am Computer öffnet ein Klick die Monatsanalyse."
          data-testid="year-flow-section"
        >
          <ChartFigure
            label={`Einnahmen, Ausgaben und Ergebnis je Monat ${report.year}`}
            legend={<ChartLegend items={legend} />}
            caption={yearFlowCaption(report)}
            data-testid="year-flow-chart"
          >
            <MonthlyFlowChart
              points={flow}
              onSelect={(month) => router.push(monthHref(month))}
            />
          </ChartFigure>
        </PageSection>
      </Box>

      {showCumulative && (
        <Box className="fin-keep">
          <PageSection
            title="Ergebnis seit Jahresbeginn"
            description={
              report.projection
                ? 'Was bis Monatsende aufgelaufen ist – gestrichelt die Hochrechnung bis Dezember.'
                : 'Was bis Monatsende aufgelaufen ist.'
            }
            data-testid="year-cumulative-section"
          >
            <ChartFigure
              label={`Ergebnis aufgelaufen ${report.year}`}
              legend={
                <ChartLegend
                  items={
                    report.projection
                      ? ['cumulative', 'projection']
                      : ['cumulative']
                  }
                />
              }
              data-testid="year-cumulative-chart"
            >
              <CumulativeResultChart points={cumulative} />
            </ChartFigure>
          </PageSection>
        </Box>
      )}

      <PageSection
        title="Woher das Geld kam – wohin es ging"
        description="Einnahmen nach Herkunft, Ausgaben nach Posten mit ihrem Anteil an allen Ausgaben."
        data-testid="year-split-section"
      >
        <Box sx={{ display: 'grid', gap: 3 }}>
          {parts.length > 0 && (
            <Box>
              <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
                Einnahmen {formatEuro(report.statement.income.total)}
              </Typography>
              <IncomeSplitBar
                parts={parts}
                label={`Einnahmen ${report.year} nach Herkunft`}
              />
            </Box>
          )}
          {bars.length > 0 && (
            <Box>
              <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
                Ausgaben {formatEuro(report.statement.expense.total)}
              </Typography>
              <CategoryBars
                bars={bars}
                label={`Ausgaben ${report.year} nach Posten`}
              />
            </Box>
          )}
        </Box>
      </PageSection>
    </>
  )
}

function keyFigures(report: FinanceYearReport): KeyFigure[] {
  const { statement } = report
  const items: KeyFigure[] = [
    {
      label: 'Einnahmen',
      value: formatEuro(statement.income.total),
      hint: `${report.coverage.complete_months} volle Monat${
        report.coverage.complete_months === 1 ? '' : 'e'
      }`,
    },
    { label: 'Ausgaben', value: formatEuro(statement.expense.total) },
    {
      label: 'Ergebnis',
      value: formatEuro(statement.result),
      hint: 'Einnahmen minus Ausgaben',
    },
  ]
  if (report.status === 'provisional') {
    items.push({
      label: 'Hochrechnung Jahresergebnis',
      value: report.projection ? formatEuro(report.projection.result) : '–',
      hint: report.projection ? 'geschätzt, siehe unten' : 'nicht möglich',
      'data-testid': 'projection-tile',
    })
  } else {
    items.push({
      label: 'Kontoveränderung',
      value: formatEuro(statement.net_change),
      hint: 'mit Privat und Umbuchungen',
    })
  }
  return items
}

// ---------------------------------------------------------------------------
// Seite
// ---------------------------------------------------------------------------

export default function JahresabschlussClient({
  initialYear,
}: {
  /** `?jahr=` aus der URL (geprüft), sonst das jüngste Jahr der API. */
  initialYear?: string
}) {
  const { isAuthenticated, isLoading: authLoading } = useSession()
  const router = useRouter()
  const [year, setYear] = useState<string | undefined>(initialYear)
  const [state, setState] = useState<PageState>({ phase: 'loading' })
  const requestRef = useRef(0)

  // Zurück/Vor im Browser ändert `?jahr=` - die Seite folgt der URL.
  useEffect(() => {
    setYear(initialYear)
  }, [initialYear])

  const load = useCallback(async (wanted?: string) => {
    const request = ++requestRef.current
    setState({ phase: 'loading' })
    try {
      const result = await fetchYearReport(wanted)
      if (request !== requestRef.current) return
      if (result.status === 'no-data') {
        setState({ phase: 'no-data', reason: result.reason })
        return
      }
      setState({ phase: 'ok', report: result.data })
    } catch (err) {
      if (request !== requestRef.current) return
      const { kind, message } = classifyFinanceError(
        err,
        'Der Jahresabschluss konnte nicht geladen werden.'
      )
      setState({ phase: 'access', kind, message })
    }
  }, [])

  // Wie /admin/finance: erst laden, wenn die Sitzung geprüft ist.
  useEffect(() => {
    if (authLoading) return
    void load(year)
  }, [authLoading, isAuthenticated, year, load])

  const changeYear = (next: string) => {
    if (state.phase === 'ok' && next === state.report.year) return
    setYear(next)
    router.replace(yearHref(next), { scroll: false })
  }

  if (state.phase === 'loading') {
    return (
      <PageLayout title={TITLE} subtitle={SUBTITLE}>
        <LoadingState label="Jahresabschluss wird geladen" />
      </PageLayout>
    )
  }

  if (state.phase === 'access') {
    return (
      <PageLayout title={TITLE} subtitle={SUBTITLE}>
        <FinanceAccessNotice
          kind={state.kind}
          message={state.message}
          onRetry={() => void load(year)}
          subject="Der Jahresabschluss"
          nextPath={year ? yearHref(year) : '/admin/finance/jahr'}
        />
      </PageLayout>
    )
  }

  if (state.phase === 'no-data') {
    return (
      <PageLayout
        title={TITLE}
        subtitle={SUBTITLE}
        back={{ href: '/admin/finance', label: 'Finanzen' }}
      >
        <EmptyState
          title="Kein Jahresabschluss möglich"
          description={`${state.reason} Die Bankdaten kommen aus dem Import der Kontoauszüge; Beispielwerte gibt es bewusst nicht.`}
          action={
            year ? (
              <Button
                onClick={() => {
                  setYear(undefined)
                  router.replace('/admin/finance/jahr', { scroll: false })
                }}
              >
                Zum jüngsten Jahr
              </Button>
            ) : undefined
          }
        />
      </PageLayout>
    )
  }

  const { report } = state
  return (
    <Box className="fin-report" data-testid="jahresabschluss">
      <FinanceReportPrintStyles />
      {/* Druckfassung: am Bildschirm ausgeblendet (FinanceReportPrintStyles) */}
      <JahresabschlussPrint
        report={report}
        kpis={keyFigures(report).map(({ label, value, hint }) => ({
          label,
          value,
          hint,
        }))}
        flowCaption={yearFlowCaption(report)}
      />
      <Box className="fin-screen">
        <PageLayout
          title={`${TITLE} ${report.year}`}
          subtitle={SUBTITLE}
          back={{ href: '/admin/finance', label: 'Finanzen' }}
          status={
            <Chip
              label={yearStatusLabel(report)}
              variant="outlined"
              size="small"
              data-testid="year-status"
              data-status={report.status}
            />
          }
          actions={
            <>
              <YearSwitcher report={report} onChange={changeYear} />
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={() => window.print()}
              >
                Drucken
              </Button>
            </>
          }
        >
          <PrintOnlyLine data-testid="print-head">
            Bäckerei Heusser · {yearStatusLabel(report)}
            {report.coverage.data_from && report.coverage.data_to
              ? ` · Bankdaten ${formatReportDate(
                  report.coverage.data_from
                )} – ${formatReportDate(report.coverage.data_to)}`
              : ''}
          </PrintOnlyLine>

          <Box>
            <KeyFigures
              aria-label={`Kennzahlen ${report.year}`}
              items={keyFigures(report)}
            />
            {report.status === 'provisional' && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1.5 }}
                data-testid="projection-method"
              >
                {report.projection ? (
                  <>
                    <strong>Hochrechnung:</strong> Einnahmen{' '}
                    {formatEuro(report.projection.income)}, Ausgaben{' '}
                    {formatEuro(report.projection.expense)}.{' '}
                    {report.projection.method}
                  </>
                ) : (
                  <>
                    <strong>Keine Hochrechnung:</strong>{' '}
                    {report.projection_reason ?? 'Zu wenige Daten.'}
                  </>
                )}
              </Typography>
            )}
          </Box>

          <YearCharts report={report} />

          <PageSection
            title="Einnahmen und Ausgaben"
            description="Was über das Geschäftskonto ging, nach Buchungsdatum. Pfeil neben einem Posten: aufschlüsseln."
            disablePadding
          >
            <StatementTable report={report} />
          </PageSection>

          <PageSection
            title="Monat für Monat"
            description="Ein Tipp auf den Monat öffnet die Monatsanalyse."
            disablePadding
          >
            <MonthsTable report={report} />
          </PageSection>

          <PageSection
            title="Kasse und Konto"
            description={
              report.reconciliation?.from && report.reconciliation.to
                ? `Was die Kasse eingenommen hat und was davon aufs Konto kam – ${
                    report.reconciliation.months
                  } volle Monat${
                    report.reconciliation.months === 1 ? '' : 'e'
                  } (${formatMonth(
                    report.reconciliation.from
                  )} bis ${formatMonth(report.reconciliation.to)}).`
                : 'Was die Kasse eingenommen hat und was davon aufs Konto kam.'
            }
          >
            {report.reconciliation ? (
              <>
                <ReconciliationTable rec={report.reconciliation} />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1.5 }}
                >
                  Kassenumsatz in diesen Monaten{' '}
                  {formatEuro(report.reconciliation.kasse_revenue)} an{' '}
                  {report.reconciliation.kasse_days} Öffnungstagen.
                </Typography>
              </>
            ) : (
              <Typography color="text.secondary">
                Für dieses Jahr gibt es noch keinen vollen Monat mit Bankdaten
                und Kassenberichten – der Vergleich folgt, sobald einer
                abgeschlossen ist.
              </Typography>
            )}
          </PageSection>

          <PageSection
            title="Was dieser Abschluss nicht enthält"
            data-testid="year-notes"
          >
            {report.notes.length > 0 ? (
              <ReportNotes notes={report.notes} />
            ) : (
              <Typography color="text.secondary">Keine Hinweise.</Typography>
            )}
          </PageSection>
        </PageLayout>
      </Box>
    </Box>
  )
}
