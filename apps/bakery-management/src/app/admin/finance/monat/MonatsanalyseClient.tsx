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
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  FiberNew as NewIcon,
  HelpOutline as MissingIcon,
  Print as PrintIcon,
  TrendingDown as DownIcon,
  TrendingUp as UpIcon,
} from '@mui/icons-material'
import { useSession } from '../../../../lib/session'
import {
  classifyFinanceError,
  fetchMonthReport,
  type FinanceAccessProblem,
} from '../../../../lib/financeApi'
import type {
  FinanceHighlight,
  FinanceMonthComparison,
  FinanceMonthReport,
  FinanceReportRow,
} from '../../../../lib/financeTypes'
import { formatEuro, formatMonth } from '../../../../lib/reportFormat'
import {
  EmptyState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
  type KeyFigure,
} from '../../../../components/layout'
import {
  FinanceAccessNotice,
  FinanceReportPrintStyles,
  formatDayMonth,
  formatSignedEuro,
  PrintOnlyLine,
  ReconciliationTable,
  ReportNotes,
  StatementRow,
  StatementSumRow,
  type StatementRowOptions,
} from '../../../../components/finance/FinanceReportParts'

const TITLE = 'Monatsanalyse'
const SUBTITLE =
  'Woher das Geld kam und wohin es ging – über das Geschäftskonto'
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

type PageState =
  | { phase: 'loading' }
  | { phase: 'invalid' }
  | { phase: 'access'; kind: FinanceAccessProblem; message: string }
  | { phase: 'no-data'; reason: string }
  | { phase: 'ok'; report: FinanceMonthReport }

export function monthHref(month: string): string {
  return `/admin/finance/monat/${month}`
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

function MonthSwitcher({ report }: { report: FinanceMonthReport }) {
  const router = useRouter()
  const months = report.months.includes(report.month)
    ? report.months
    : [report.month, ...report.months]
  const arrow = (target: string | null, label: string, icon: React.ReactNode) =>
    target ? (
      <IconButton
        component={NextLink}
        href={monthHref(target)}
        aria-label={`${label}: ${formatMonth(target)}`}
      >
        {icon}
      </IconButton>
    ) : (
      <IconButton aria-label={label} disabled>
        {icon}
      </IconButton>
    )
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {arrow(report.previous_month, 'Vormonat', <PrevIcon />)}
      <FormControl size="small" sx={{ minWidth: 168 }}>
        <InputLabel id="monatsanalyse-monat-label">Monat</InputLabel>
        <Select
          labelId="monatsanalyse-monat-label"
          label="Monat"
          value={report.month}
          onChange={(event) => {
            const next = String(event.target.value)
            if (next !== report.month) router.push(monthHref(next))
          }}
        >
          {months.map((month) => (
            <MenuItem key={month} value={month}>
              {formatMonth(month)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {arrow(report.next_month, 'Nächster Monat', <NextIcon />)}
    </Box>
  )
}

function keyFigures(report: FinanceMonthReport, complete: boolean) {
  // Für angebrochene Monate liefert der Server keinen Ø (`null`).
  const avg = report.comparison.average
  const avgHint = (value: number | undefined) =>
    avg && value !== undefined
      ? `Ø ${avg.months} Monate: ${formatEuro(value)}`
      : undefined
  const items: KeyFigure[] = [
    {
      label: 'Einnahmen',
      value: formatEuro(report.income),
      hint: complete
        ? avgHint(avg?.income)
        : `${report.coverage.days} von ${report.coverage.days_in_month} Tagen`,
    },
    {
      label: 'Ausgaben',
      value: formatEuro(report.expense),
      hint: avgHint(avg?.expense),
    },
    {
      label: 'Ergebnis',
      value: formatEuro(report.result),
      hint: avgHint(avg?.result) ?? 'Einnahmen minus Ausgaben',
    },
    {
      label: 'Kasse Ø je Öffnungstag',
      value: report.kasse ? formatEuro(report.kasse.avg_day) : '–',
      hint: report.kasse
        ? `${report.kasse.days} Öffnungstage · ${formatEuro(
            report.kasse.revenue
          )}`
        : 'kein Kassenbericht',
      'data-testid': 'kasse-tile',
    },
  ]
  return items
}

const HIGHLIGHT_ICON: Record<string, React.ReactNode> = {
  expense_high: <UpIcon fontSize="small" />,
  expense_new: <NewIcon fontSize="small" />,
  expense_missing: <MissingIcon fontSize="small" />,
  income_high: <UpIcon fontSize="small" />,
  income_low: <DownIcon fontSize="small" />,
}

/** Text, wenn `highlights` leer ist - der Grund kommt vom Server. */
export function emptyHighlightsText(report: FinanceMonthReport): string {
  if (report.highlights_reason === 'partial') {
    const partial = report.notes.find((note) => note.key === 'partial')
    return (
      partial?.text ??
      'Der Monat ist noch nicht vollständig. Vergleiche und Auffälligkeiten gibt es erst, wenn er abgeschlossen ist.'
    )
  }
  if (report.highlights_reason === 'too_few_months') {
    const n = report.comparison.average?.months ?? 0
    return `Für Auffälligkeiten braucht es mindestens ${report.highlights_min_months} abgeschlossene Vergleichsmonate (bisher ${n}).`
  }
  return 'Nichts Auffälliges in diesem Monat.'
}

function Highlights({ report }: { report: FinanceMonthReport }) {
  if (report.highlights.length === 0) {
    return (
      <Typography
        color="text.secondary"
        data-testid="highlights-empty"
        data-reason={report.highlights_reason ?? 'none'}
      >
        {emptyHighlightsText(report)}
      </Typography>
    )
  }
  return (
    <Box
      component="ul"
      data-testid="highlights"
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}
    >
      {report.highlights.map((item: FinanceHighlight, index) => (
        <Box
          component="li"
          key={`${item.kind}-${item.category ?? index}`}
          data-kind={item.kind}
          sx={{
            display: 'flex',
            gap: 1.5,
            alignItems: 'flex-start',
            p: 1.5,
            borderRadius: 1,
            bgcolor: 'action.hover',
            breakInside: 'avoid',
          }}
        >
          <Box sx={{ color: 'text.secondary', mt: 0.25, display: 'flex' }}>
            {HIGHLIGHT_ICON[item.kind] ?? <MissingIcon fontSize="small" />}
          </Box>
          <Typography variant="body2">{item.text}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function RowsTable({
  rows,
  total,
  totalLabel,
  options,
  averageLabel,
  ariaLabel,
  testId,
}: {
  rows: FinanceReportRow[]
  total: number
  totalLabel: string
  options: StatementRowOptions
  averageLabel: string
  ariaLabel: string
  testId: string
}) {
  if (rows.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
        Keine Buchungen.
      </Typography>
    )
  }
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table
        size="small"
        aria-label={ariaLabel}
        data-testid={testId}
        sx={{ minWidth: options.comparison ? 560 : 300 }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Posten</TableCell>
            <TableCell align="right">Betrag</TableCell>
            {options.showShare && <TableCell align="right">Anteil</TableCell>}
            {options.comparison && (
              <>
                <TableCell align="right">{averageLabel}</TableCell>
                <TableCell align="right">Abweichung</TableCell>
              </>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <StatementRow key={row.category} row={row} options={options} />
          ))}
          <StatementSumRow
            label={totalLabel}
            amount={total}
            options={options}
          />
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function ComparisonTable({
  report,
  emptyText,
}: {
  report: FinanceMonthReport
  emptyText: string
}) {
  const { previous_month, previous_year, average } = report.comparison
  const rows: {
    key: string
    label: string
    data: Pick<FinanceMonthComparison, 'income' | 'expense' | 'result'>
    diff: number | null
  }[] = []
  if (previous_month) {
    rows.push({
      key: 'previous_month',
      label: `Vormonat (${previous_month.label})`,
      data: previous_month,
      diff: previous_month.diff_result,
    })
  }
  if (previous_year) {
    rows.push({
      key: 'previous_year',
      label: `Vorjahresmonat (${previous_year.label})`,
      data: previous_year,
      diff: previous_year.diff_result,
    })
  }
  if (average) {
    rows.push({
      key: 'average',
      label: `Ø ${average.months} volle Monat${
        average.months === 1 ? '' : 'e'
      } davor`,
      data: average,
      diff: average.diff_result,
    })
  }
  if (rows.length === 0) {
    return (
      <Typography
        color="text.secondary"
        data-testid="comparison-empty"
        sx={{ px: { xs: 2, md: 3 }, pb: 2 }}
      >
        {emptyText}
      </Typography>
    )
  }
  const cell = {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  } as const
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table
        size="small"
        aria-label="Vergleich"
        data-testid="comparison"
        sx={{ minWidth: 560 }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Vergleich mit</TableCell>
            <TableCell align="right">Einnahmen</TableCell>
            <TableCell align="right">Ausgaben</TableCell>
            <TableCell align="right">Ergebnis</TableCell>
            <TableCell align="right">{report.label} dagegen</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} data-testid={`comparison-${row.key}`}>
              <TableCell>{row.label}</TableCell>
              <TableCell align="right" sx={cell}>
                {formatEuro(row.data.income)}
              </TableCell>
              <TableCell align="right" sx={cell}>
                {formatEuro(row.data.expense)}
              </TableCell>
              <TableCell align="right" sx={cell}>
                {formatEuro(row.data.result)}
              </TableCell>
              <TableCell align="right" sx={cell}>
                {row.diff === null ? '–' : `${formatSignedEuro(row.diff)}`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

// ---------------------------------------------------------------------------
// Seite
// ---------------------------------------------------------------------------

export default function MonatsanalyseClient({
  month,
}: {
  /** `JJJJ-MM` aus der URL; ohne Angabe der jüngste vollständige Monat. */
  month?: string
}) {
  const { isAuthenticated, isLoading: authLoading } = useSession()
  const [state, setState] = useState<PageState>({ phase: 'loading' })
  const requestRef = useRef(0)
  const valid = month === undefined || MONTH_RE.test(month)

  const load = useCallback(async () => {
    const request = ++requestRef.current
    if (!valid) {
      setState({ phase: 'invalid' })
      return
    }
    setState({ phase: 'loading' })
    try {
      const result = await fetchMonthReport(month)
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
        'Die Monatsanalyse konnte nicht geladen werden.'
      )
      setState({ phase: 'access', kind, message })
    }
  }, [month, valid])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, isAuthenticated, load])

  const back = { href: '/admin/finance', label: 'Finanzen' }

  if (state.phase === 'loading') {
    return (
      <PageLayout title={TITLE} subtitle={SUBTITLE} back={back}>
        <LoadingState label="Monatsanalyse wird geladen" />
      </PageLayout>
    )
  }

  if (state.phase === 'invalid' || state.phase === 'no-data') {
    return (
      <PageLayout title={TITLE} subtitle={SUBTITLE} back={back}>
        <EmptyState
          title={
            state.phase === 'invalid'
              ? 'Diesen Monat gibt es nicht'
              : 'Keine Monatsanalyse möglich'
          }
          description={
            state.phase === 'invalid'
              ? 'Der Monat in der Adresse ist ungültig (Format JJJJ-MM).'
              : `${state.reason} Die Bankdaten kommen aus dem Import der Kontoauszüge; Beispielwerte gibt es bewusst nicht.`
          }
          action={
            month ? (
              <Button component={NextLink} href="/admin/finance/monat">
                Zum jüngsten Monat
              </Button>
            ) : undefined
          }
        />
      </PageLayout>
    )
  }

  if (state.phase === 'access') {
    return (
      <PageLayout title={TITLE} subtitle={SUBTITLE} back={back}>
        <FinanceAccessNotice
          kind={state.kind}
          message={state.message}
          onRetry={() => void load()}
          subject="Die Monatsanalyse"
          nextPath={month ? monthHref(month) : '/admin/finance/monat'}
        />
      </PageLayout>
    )
  }

  const { report } = state
  const complete = report.coverage.status === 'complete'
  const year = report.month.slice(0, 4)
  const avg = report.comparison.average
  // Ø und Abweichung zeigt die Seite, wenn der Server einen Ø liefert - für
  // angebrochene Monate ist er `null` (halbe gegen ganze Monate ergäben nur
  // Scheinabweichungen). Einzelne Zeilen ohne Ø zeigen „–“.
  const comparison = avg !== null
  const averageLabel = avg ? `Ø ${avg.months} Monate` : 'Ø'
  const notes = report.notes.filter((note) => note.key !== 'partial')
  const { statement } = report

  return (
    <Box className="fin-report" data-testid="monatsanalyse">
      <FinanceReportPrintStyles />
      <PageLayout
        title={`${TITLE} – ${report.label}`}
        subtitle={SUBTITLE}
        back={{
          href: `/admin/finance/jahr?jahr=${year}`,
          label: `Jahresabschluss ${year}`,
        }}
        status={
          complete ? undefined : (
            <Chip
              label={`Unvollständig · bis ${formatDayMonth(
                report.coverage.to
              )}`}
              variant="outlined"
              size="small"
              data-testid="month-status"
            />
          )
        }
        actions={
          <>
            <MonthSwitcher report={report} />
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
        <PrintOnlyLine>
          Bäckerei Heusser · {report.label}
          {complete
            ? ''
            : ` · Bankdaten bis ${formatDayMonth(report.coverage.to)}`}
        </PrintOnlyLine>

        <KeyFigures
          aria-label={`Kennzahlen ${report.label}`}
          items={keyFigures(report, complete)}
        />

        <PageSection
          title="Auffälligkeiten"
          description={
            avg && report.highlights_reason === null
              ? `Gegenüber dem Durchschnitt von ${formatMonth(
                  avg.from
                )} bis ${formatMonth(avg.to)}.`
              : undefined
          }
          data-testid="highlights-section"
        >
          <Highlights report={report} />
        </PageSection>

        <PageSection
          title="Woher das Geld kam"
          description="Einnahmen nach Art. Pfeil neben einem Posten: aufschlüsseln."
          disablePadding
        >
          <RowsTable
            rows={statement.income.rows}
            total={statement.income.total}
            totalLabel="Summe Einnahmen"
            options={{
              showShare: true,
              comparison: comparison ? 'income' : undefined,
            }}
            averageLabel={averageLabel}
            ariaLabel="Einnahmen nach Art"
            testId="income-table"
          />
        </PageSection>

        <PageSection
          title="Wohin das Geld ging"
          description="Ausgaben nach Art, die größten zuerst."
          disablePadding
        >
          <RowsTable
            rows={statement.expense.rows}
            total={statement.expense.total}
            totalLabel="Summe Ausgaben"
            options={{
              showShare: true,
              comparison: comparison ? 'expense' : undefined,
            }}
            averageLabel={averageLabel}
            ariaLabel="Ausgaben nach Art"
            testId="expense-table"
          />
        </PageSection>

        <PageSection
          title="Im Vergleich"
          description="Einnahmen, Ausgaben und Ergebnis anderer Monate."
          disablePadding
        >
          <ComparisonTable
            report={report}
            emptyText={
              complete
                ? 'Noch keine Vergleichsmonate.'
                : 'Der Vergleich folgt, wenn der Monat vollständig ist.'
            }
          />
        </PageSection>

        <PageSection
          title="Kasse und Konto"
          description="Was die Kasse eingenommen hat und was davon aufs Konto kam."
        >
          {report.reconciliation ? (
            <ReconciliationTable rec={report.reconciliation} />
          ) : (
            <Typography color="text.secondary" data-testid="no-reconciliation">
              {complete
                ? 'Für diesen Monat gibt es keine Kassenberichte.'
                : 'Der Abgleich folgt, wenn der Monat vollständig ist – Einzahlungen der letzten Tage fehlen sonst noch.'}
            </Typography>
          )}
          {report.kasse_previous_year && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1.5 }}
              data-testid="kasse-previous-year"
            >
              Kasse im Vorjahresmonat:{' '}
              {formatEuro(report.kasse_previous_year.revenue)} an{' '}
              {report.kasse_previous_year.days} Öffnungstagen (Ø{' '}
              {formatEuro(report.kasse_previous_year.avg_day)} je Tag).
            </Typography>
          )}
        </PageSection>

        <PageSection
          title="Unter dem Strich (neutral)"
          description="Privat, Darlehen und Umbuchungen – sie ändern den Kontostand, nicht das Ergebnis."
          disablePadding
        >
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Neutral" data-testid="neutral">
              <TableBody>
                <StatementSumRow
                  label="Ergebnis"
                  amount={statement.result}
                  options={{}}
                  strong={false}
                />
                {statement.neutral.rows.map((row) => (
                  <StatementRow key={row.category} row={row} options={{}} />
                ))}
                <StatementSumRow
                  label="Kontoveränderung"
                  amount={statement.net_change}
                  options={{}}
                />
              </TableBody>
            </Table>
          </TableContainer>
        </PageSection>

        {notes.length > 0 && (
          <PageSection title="Hinweise" data-testid="month-notes">
            <ReportNotes notes={notes} />
          </PageSection>
        )}
      </PageLayout>
    </Box>
  )
}
