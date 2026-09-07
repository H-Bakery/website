'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material'
import {
  AccountBalance as FinanceIcon,
  CheckCircleOutline as OkIcon,
  ErrorOutline as WarnIcon,
  Login as LoginIcon,
} from '@mui/icons-material'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '@bakery/shared/contexts'
import {
  classifyFinanceError,
  fetchFinanceMonths,
  fetchFinanceSummary,
  type FinanceAccessProblem,
} from '../../../lib/financeApi'
import type {
  FinanceInvariant,
  FinanceMonthPoint,
  FinanceOverview,
  FinanceStructureRow,
  FinanceSummaryResponse,
} from '../../../lib/financeTypes'

// ---------------------------------------------------------------------------
// Formatierung
// ---------------------------------------------------------------------------

const currency = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})
const currencyNoCents = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const percent = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 1,
})

export function formatEuro(value: number): string {
  return currency.format(value)
}

/** `2026-03` → `Mär 2026` */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  if (!year || !m) return month
  return new Date(year, m - 1, 1).toLocaleDateString('de-DE', {
    month: 'short',
    year: 'numeric',
  })
}

function formatMonthLong(month: string): string {
  const [year, m] = month.split('-').map(Number)
  if (!year || !m) return month
  return new Date(year, m - 1, 1).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  })
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'unbekannt'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(iso: string | null): string {
  if (!iso) return '–'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('de-DE')
}

// ---------------------------------------------------------------------------
// Farben - kategorial, in beiden Modi geprüft (blau / orange / aqua):
// Einnahmen und Ausgaben stehen sich außerdem über die Nulllinie gegenüber,
// die Farbe trägt die Unterscheidung also nie allein.
// ---------------------------------------------------------------------------

function useSeriesColors() {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'
  return {
    income: dark ? '#3987e5' : '#2a78d6',
    expense: dark ? '#d95926' : '#eb6834',
    result: dark ? '#199e70' : '#1baf7a',
    grid: theme.palette.divider,
    axis: theme.palette.text.secondary,
    tooltipBg: theme.palette.background.paper,
    tooltipText: theme.palette.text.primary,
  }
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="h5" component="p">
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Paper>
  )
}

function MonthlyChart({ series }: { series: FinanceMonthPoint[] }) {
  const colors = useSeriesColors()
  const data = series.map((m) => ({
    ...m,
    label: formatMonth(m.month),
  }))
  const names: Record<string, string> = {
    income: 'Einnahmen',
    expense: 'Ausgaben',
    result: 'Ergebnis',
  }
  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Monatsverlauf
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Betriebliche Einnahmen und Ausgaben je Monat; die Linie ist das Ergebnis
        (Einnahmen + Ausgaben). Neutrale Bewegungen sind nicht enthalten.
      </Typography>
      <Box sx={{ width: '100%', height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ left: 8, right: 8 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.axis, fontSize: 12 }}
              stroke={colors.grid}
            />
            <YAxis
              width={90}
              tickFormatter={(v: number) => currencyNoCents.format(v)}
              tick={{ fill: colors.axis, fontSize: 12 }}
              stroke={colors.grid}
            />
            <ReferenceLine y={0} stroke={colors.axis} />
            <Tooltip
              formatter={(value: number | string, name: string) => [
                formatEuro(Number(value)),
                names[name] ?? name,
              ]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                backgroundColor: colors.tooltipBg,
                color: colors.tooltipText,
                borderColor: colors.grid,
              }}
              itemStyle={{ color: colors.tooltipText }}
              labelStyle={{ color: colors.tooltipText }}
            />
            <Legend
              formatter={(value) => (
                <span style={{ color: colors.tooltipText }}>
                  {names[value] ?? value}
                </span>
              )}
            />
            <Bar
              dataKey="income"
              fill={colors.income}
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expense"
              fill={colors.expense}
              radius={[0, 0, 4, 4]}
              maxBarSize={36}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="result"
              stroke={colors.result}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, fill: colors.tooltipBg }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  )
}

function CostStructure({ rows }: { rows: FinanceStructureRow[] }) {
  const colors = useSeriesColors()
  const data = rows.map((r) => ({
    ...r,
    // Für das Diagramm der Betrag als positive Länge - die Tabelle daneben
    // zeigt das Vorzeichen, wie es gebucht ist.
    outflow: Math.abs(r.expense),
  }))
  const chartHeight = Math.max(200, 32 * data.length + 40)
  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Kostenstruktur
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Abflüsse nach Kategorie im gewählten Zeitraum. „Nicht zugeordnet" zählt
        hier mit, solange die Buchungen keiner Kategorie zugewiesen sind.
      </Typography>
      {data.length === 0 ? (
        <Typography color="text.secondary">
          Keine Ausgaben im gewählten Zeitraum.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box sx={{ width: '100%', height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid stroke={colors.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => currencyNoCents.format(v)}
                    tick={{ fill: colors.axis, fontSize: 12 }}
                    stroke={colors.grid}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={150}
                    tick={{ fill: colors.axis, fontSize: 12 }}
                    stroke={colors.grid}
                  />
                  <Tooltip
                    formatter={(value: number | string) => [
                      formatEuro(-Number(value)),
                      'Abfluss',
                    ]}
                    contentStyle={{
                      backgroundColor: colors.tooltipBg,
                      color: colors.tooltipText,
                      borderColor: colors.grid,
                    }}
                    itemStyle={{ color: colors.tooltipText }}
                    labelStyle={{ color: colors.tooltipText }}
                  />
                  <Bar
                    dataKey="outflow"
                    fill={colors.expense}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={20}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Kostenstruktur nach Kategorie">
                <TableHead>
                  <TableRow>
                    <TableCell>Kategorie</TableCell>
                    <TableCell align="right">Abfluss</TableCell>
                    <TableCell align="right">Anteil</TableCell>
                    <TableCell align="right">Buchungen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell>
                        {row.label}
                        {row.kind === 'offen' && (
                          <Chip
                            label="offen"
                            size="small"
                            variant="outlined"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {formatEuro(row.expense)}
                      </TableCell>
                      <TableCell align="right">
                        {percent.format(row.share)}
                      </TableCell>
                      <TableCell align="right">{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Grid>
        </Grid>
      )}
    </Paper>
  )
}

function InvariantBadge({ invariant }: { invariant: FinanceInvariant }) {
  if (invariant.ok) {
    return (
      <Chip
        icon={<OkIcon />}
        color="success"
        variant="outlined"
        size="small"
        label="Summenprüfung stimmig"
        title="Einnahmen + Ausgaben + Neutral = Kontoveränderung, in jedem Monat"
      />
    )
  }
  return (
    <Chip
      icon={<WarnIcon />}
      color="warning"
      variant="outlined"
      size="small"
      label={`Summenprüfung: ${invariant.violations.length} Abweichung(en)`}
      title={invariant.violations
        .map(
          (v) => `${v.month ?? 'gesamt'}: ${v.rule} (Δ ${formatEuro(v.diff)})`
        )
        .join('\n')}
    />
  )
}

function AccessNotice({
  kind,
  message,
}: {
  kind: FinanceAccessProblem
  message: string
}) {
  if (kind === 'unauthenticated') {
    return (
      <Alert
        severity="info"
        action={
          <Button
            component={Link}
            href="/admin/login?next=/admin/finance"
            color="inherit"
            size="small"
            startIcon={<LoginIcon />}
          >
            Zur Anmeldung
          </Button>
        }
      >
        <AlertTitle>Anmeldung erforderlich</AlertTitle>
        Die Finanzdaten sind nur nach Anmeldung als Inhaber/Admin sichtbar.
      </Alert>
    )
  }
  if (kind === 'forbidden') {
    return (
      <Alert severity="warning">
        <AlertTitle>Keine Berechtigung</AlertTitle>
        {message} Die Finanzdaten sehen nur Konten mit der Rolle Inhaber/Admin.{' '}
        <Link href="/admin/login?next=/admin/finance">
          Mit einem anderen Konto anmelden
        </Link>
      </Alert>
    )
  }
  return (
    <Alert severity="error">
      <AlertTitle>Finanzdaten konnten nicht geladen werden</AlertTitle>
      {message}
    </Alert>
  )
}

// ---------------------------------------------------------------------------
// Seite
// ---------------------------------------------------------------------------

type PageState =
  | { phase: 'loading' }
  | { phase: 'access'; kind: FinanceAccessProblem; message: string }
  | { phase: 'no-data'; reason: string }
  | { phase: 'ok'; summary: FinanceSummaryResponse }

interface RangeView {
  series: FinanceMonthPoint[]
  overview: FinanceOverview
  costs: FinanceStructureRow[]
}

export default function FinanceClient() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [state, setState] = useState<PageState>({ phase: 'loading' })
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [range, setRange] = useState<RangeView | null>(null)
  const [rangeLoading, setRangeLoading] = useState(false)
  const [rangeError, setRangeError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    setRange(null)
    try {
      const result = await fetchFinanceSummary()
      if (result.status === 'no-data') {
        setState({ phase: 'no-data', reason: result.reason })
        return
      }
      setState({ phase: 'ok', summary: result.data })
      setFrom('')
      setTo('')
    } catch (err) {
      const { kind, message } = classifyFinanceError(err)
      setState({ phase: 'access', kind, message })
    }
  }, [])

  // Erst laden, wenn der AuthProvider ein gespeichertes Token geprüft hat -
  // sonst liefe die Anfrage ohne Header los und die Seite zeigte kurz
  // "Anmeldung erforderlich", obwohl man angemeldet ist.
  useEffect(() => {
    if (authLoading) return
    load()
  }, [authLoading, isAuthenticated, load])

  const availableMonths = useMemo(
    () =>
      state.phase === 'ok' ? state.summary.months.map((m) => m.month) : [],
    [state]
  )

  // Zeitraumfilter: die Reihe kommt vom Server (`/api/finance/months`), damit
  // die Formel nur einmal existiert.
  useEffect(() => {
    if (state.phase !== 'ok') return
    if (!from && !to) {
      setRange(null)
      setRangeError(null)
      return
    }
    let cancelled = false
    setRangeLoading(true)
    fetchFinanceMonths({ from: from || undefined, to: to || undefined })
      .then((result) => {
        if (cancelled) return
        if (result.status === 'no-data') {
          setRangeError(result.reason)
          setRange(null)
          return
        }
        setRangeError(null)
        setRange({
          series: result.data.months,
          overview: result.data.overview,
          costs: result.data.cost_structure,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setRangeError(classifyFinanceError(err).message)
        setRange(null)
      })
      .finally(() => {
        if (!cancelled) setRangeLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [state.phase, from, to])

  const header = (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h4" component="h1">
        <FinanceIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Finanzen
      </Typography>
      <Typography variant="subtitle1" color="text.secondary">
        Kontobewegungen des Geschäftskontos, kategorisiert
      </Typography>
    </Box>
  )

  if (state.phase === 'loading') {
    return (
      <Box>
        {header}
        <LinearProgress aria-label="Finanzdaten werden geladen" />
      </Box>
    )
  }

  if (state.phase === 'access') {
    return (
      <Box>
        {header}
        <AccessNotice kind={state.kind} message={state.message} />
      </Box>
    )
  }

  if (state.phase === 'no-data') {
    return (
      <Box>
        {header}
        <Alert severity="info">
          <AlertTitle>Keine Finanzdaten vorhanden</AlertTitle>
          {state.reason} Die Daten entstehen im hq-Repo unter data/finance
          (Import der Kontoauszüge); es werden bewusst keine Beispielwerte
          angezeigt.
        </Alert>
      </Box>
    )
  }

  const { summary } = state
  const view: RangeView = range ?? {
    series: summary.derived.series,
    overview: summary.derived.overview,
    costs: summary.derived.cost_structure,
  }
  const { overview } = view
  const filtered = Boolean(from || to)

  return (
    <Box>
      {header}

      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        alignItems="center"
        useFlexGap
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          Stand: {formatTimestamp(summary.generated_at)} · Zeitraum{' '}
          {formatDate(summary.period.from)} – {formatDate(summary.period.to)} ·{' '}
          {summary.transaction_count.toLocaleString('de-DE')} Buchungen
        </Typography>
        <InvariantBadge invariant={summary.derived.invariant} />
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Cashflow-Sicht nach Buchungsdatum, keine GuV: Zuordnung nach Zahlungs-,
        nicht nach Leistungsdatum; keine Abschreibungen, Rückstellungen oder
        Umsatzsteuer-Abgrenzung; nur dieses eine Konto.
      </Alert>

      <Stack
        direction="row"
        spacing={2}
        flexWrap="wrap"
        alignItems="center"
        useFlexGap
        sx={{ mb: 3 }}
      >
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="finance-from-label">Von</InputLabel>
          <Select
            labelId="finance-from-label"
            label="Von"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            <MenuItem value="">Anfang</MenuItem>
            {availableMonths.map((m) => (
              <MenuItem key={m} value={m} disabled={Boolean(to) && m > to}>
                {formatMonthLong(m)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="finance-to-label">Bis</InputLabel>
          <Select
            labelId="finance-to-label"
            label="Bis"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          >
            <MenuItem value="">Ende</MenuItem>
            {availableMonths.map((m) => (
              <MenuItem key={m} value={m} disabled={Boolean(from) && m < from}>
                {formatMonthLong(m)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {filtered && (
          <Button
            size="small"
            onClick={() => {
              setFrom('')
              setTo('')
            }}
          >
            Gesamter Zeitraum
          </Button>
        )}
        {rangeLoading && (
          <Typography variant="body2" color="text.secondary">
            Lädt …
          </Typography>
        )}
      </Stack>

      {rangeError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {rangeError}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Einnahmen"
            value={formatEuro(overview.income)}
            hint={`${overview.months} Monat${overview.months === 1 ? '' : 'e'}`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile label="Ausgaben" value={formatEuro(overview.expense)} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Ergebnis"
            value={formatEuro(overview.result)}
            hint="Einnahmen + Ausgaben"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Kontoveränderung"
            value={formatEuro(overview.net_change)}
            hint={`inkl. neutral ${formatEuro(
              overview.neutral
            )} (Geldtransit, Privat, Finanzierung)`}
          />
        </Grid>
      </Grid>

      <Stack spacing={3}>
        {view.series.length === 0 ? (
          <Alert severity="info">Keine Monate im gewählten Zeitraum.</Alert>
        ) : (
          <MonthlyChart series={view.series} />
        )}

        <CostStructure rows={view.costs} />

        {summary.uncategorized.count > 0 && (
          <Alert severity="info">
            <AlertTitle>Nicht zugeordnete Buchungen</AlertTitle>
            {summary.uncategorized.count} Buchung
            {summary.uncategorized.count === 1 ? '' : 'en'} mit zusammen{' '}
            {formatEuro(summary.uncategorized.amount)} sind im gesamten Zeitraum
            keiner Kategorie zugeordnet. Das ist gewollt: lieber sichtbar als
            geraten. Die Zuordnung wird im hq-Repo gepflegt
            (data/finance/config/categories.json).
          </Alert>
        )}
      </Stack>
    </Box>
  )
}
