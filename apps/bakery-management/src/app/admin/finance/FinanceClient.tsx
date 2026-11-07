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
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip as MuiTooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  CheckCircleOutline as OkIcon,
  ErrorOutline as WarnIcon,
  Login as LoginIcon,
} from '@mui/icons-material'
import {
  Bar,
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
import { useSession } from '../../../lib/session'
import {
  classifyFinanceError,
  fetchFinanceMonths,
  fetchFinanceSummary,
  PERSONAL_SESSION_HINT,
  type FinanceAccessProblem,
} from '../../../lib/financeApi'
import type {
  FinanceInvariant,
  FinanceMonthPoint,
  FinanceOverview,
  FinanceStructureRow,
  FinanceSummaryResponse,
} from '../../../lib/financeTypes'
import {
  EmptyState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../components/layout'
import { PresetButtons } from '../../../components/analytics/DateRangeFilter'

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

const SERIES_NAMES: Record<string, string> = {
  income: 'Einnahmen',
  expense: 'Ausgaben',
  result: 'Ergebnis',
}

function MonthlyChart({ series }: { series: FinanceMonthPoint[] }) {
  const colors = useSeriesColors()
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const data = series.map((m) => ({
    ...m,
    label: formatMonth(m.month),
  }))
  return (
    <Box sx={{ width: '100%', height: phone ? 260 : 340 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, left: 0, right: 8 }}>
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: colors.axis, fontSize: 12 }}
            stroke={colors.grid}
          />
          <YAxis
            width={phone ? 64 : 84}
            tickFormatter={(v: number) => currencyNoCents.format(v)}
            tick={{ fill: colors.axis, fontSize: 12 }}
            stroke={colors.grid}
          />
          <ReferenceLine y={0} stroke={colors.axis} />
          <Tooltip
            formatter={(value: number | string, name: string) => [
              formatEuro(Number(value)),
              SERIES_NAMES[name] ?? name,
            ]}
            labelFormatter={(label) => String(label)}
            contentStyle={{
              backgroundColor: colors.tooltipBg,
              color: colors.tooltipText,
              borderColor: colors.grid,
              borderRadius: 8,
            }}
            itemStyle={{ color: colors.tooltipText }}
            labelStyle={{ color: colors.tooltipText }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: colors.tooltipText }}>
                {SERIES_NAMES[value] ?? value}
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
  )
}

/**
 * Kostenstruktur als eine Tabelle mit Anteilsbalken - vorher standen
 * daneben noch ein Balkendiagramm mit denselben Zahlen.
 */
function CostTable({ rows }: { rows: FinanceStructureRow[] }) {
  if (rows.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
        Keine Ausgaben im gewählten Zeitraum.
      </Typography>
    )
  }
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label="Kostenstruktur nach Kategorie">
        <TableHead>
          <TableRow>
            <TableCell>Kategorie</TableCell>
            <TableCell align="right">Abfluss</TableCell>
            <TableCell align="right" sx={{ width: { sm: 180 } }}>
              Anteil
            </TableCell>
            <TableCell
              align="right"
              sx={{ display: { xs: 'none', sm: 'table-cell' } }}
            >
              Buchungen
            </TableCell>
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
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                {formatEuro(row.expense)}
              </TableCell>
              <TableCell align="right">
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 1,
                  }}
                >
                  <LinearProgress
                    variant="determinate"
                    value={Math.max(0, Math.min(100, row.share * 100))}
                    aria-hidden
                    sx={{
                      flex: 1,
                      maxWidth: 96,
                      height: 6,
                      borderRadius: 3,
                      display: { xs: 'none', sm: 'block' },
                    }}
                  />
                  <span>{percent.format(row.share)}</span>
                </Box>
              </TableCell>
              <TableCell
                align="right"
                sx={{ display: { xs: 'none', sm: 'table-cell' } }}
              >
                {row.count}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function InvariantBadge({ invariant }: { invariant: FinanceInvariant }) {
  if (invariant.ok) {
    return (
      <MuiTooltip title="Einnahmen + Ausgaben + Neutral = Kontoveränderung, in jedem Monat">
        <Chip
          icon={<OkIcon />}
          color="success"
          variant="outlined"
          size="small"
          label="Summenprüfung stimmig"
        />
      </MuiTooltip>
    )
  }
  return (
    <MuiTooltip
      title={invariant.violations
        .map(
          (v) => `${v.month ?? 'gesamt'}: ${v.rule} (Δ ${formatEuro(v.diff)})`
        )
        .join(' · ')}
    >
      <Chip
        icon={<WarnIcon />}
        color="warning"
        variant="outlined"
        size="small"
        label={`Summenprüfung: ${invariant.violations.length} Abweichung(en)`}
      />
    </MuiTooltip>
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
  if (kind === 'personal_session') {
    // F4: Inhaber an einer PIN-Station - die API verlangt eine
    // Passwort-Sitzung (403 personal_session_required, B4). Bewusst ohne
    // Anmelde-Link: eine PIN-Sitzung gibt es nur an einem Stationsgerät, und
    // eine Passwort-Sitzung dort hielte Finanzen und Benutzerverwaltung 12 h
    // statt 10 min offen (F1 beendet sie beim Einrichten der Station).
    return (
      <Alert severity="info" data-testid="personal-session-notice">
        <AlertTitle>Finanzdaten an der Station nicht verfügbar</AlertTitle>
        {PERSONAL_SESSION_HINT}
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

/**
 * Monatsauswahl. `value` `''` heißt „offenes Ende“ (erster bzw. letzter Monat
 * mit Daten) - angezeigt wird dann genau dieser Monat, nicht ein leeres Feld
 * mit der Beschriftung als Platzhalter (vorher sah der Filter aus, als sei
 * nichts gewählt, obwohl drei Monate zu sehen waren).
 */
function MonthSelect({
  id,
  label,
  value,
  boundary,
  months,
  isDisabled,
  onChange,
}: {
  id: string
  label: string
  value: string
  /** Monat, für den `''` steht. */
  boundary: string
  months: string[]
  isDisabled: (month: string) => boolean
  onChange: (month: string) => void
}) {
  const shown = value || boundary
  return (
    <FormControl
      size="small"
      sx={{ flex: '1 1 9.5rem', minWidth: 0, maxWidth: { sm: 200 } }}
    >
      <InputLabel id={id} shrink>
        {label}
      </InputLabel>
      <Select
        labelId={id}
        label={label}
        value={value}
        displayEmpty
        notched
        renderValue={() => (shown ? formatMonthLong(shown) : '–')}
        onChange={(e) => onChange(String(e.target.value))}
      >
        {months.map((m) => (
          <MenuItem
            key={m}
            value={m === boundary ? '' : m}
            disabled={isDisabled(m)}
          >
            {formatMonthLong(m)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

/**
 * Schnellwahl der Finanzen: die jüngsten n Monate mit Daten. Nur Längen,
 * die kürzer als der ganze Zeitraum sind - sonst stünden zwei Knöpfe für
 * dasselbe da.
 */
export function financePresets(
  months: string[]
): { label: string; from: string; to: string }[] {
  const presets: { label: string; from: string; to: string }[] = []
  const n = months.length
  const lengths: [number, string][] = [
    [1, 'Letzter Monat'],
    [3, '3 Monate'],
    [6, '6 Monate'],
    [12, '12 Monate'],
  ]
  for (const [len, label] of lengths) {
    if (len < n) presets.push({ label, from: months[n - len], to: '' })
  }
  presets.push({ label: 'Gesamter Zeitraum', from: '', to: '' })
  return presets
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

const TITLE = 'Finanzen'
const SUBTITLE = 'Cashflow-Sicht nach Buchungsdatum, keine GuV'

export default function FinanceClient() {
  const { isAuthenticated, isLoading: authLoading } = useSession()
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

  // Erst laden, wenn der SessionProvider ein gespeichertes Token geprüft hat -
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
      // Eine noch laufende Anfrage ist abgebrochen (cancelled) und setzt
      // ihr „Lädt …“ nicht mehr zurück - sonst stand es nach „Gesamter
      // Zeitraum“ für immer da.
      setRangeLoading(false)
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

  if (state.phase === 'loading') {
    return (
      <PageLayout title={TITLE} subtitle={SUBTITLE}>
        <LoadingState label="Finanzdaten werden geladen" />
      </PageLayout>
    )
  }

  if (state.phase === 'access') {
    return (
      <PageLayout title={TITLE} subtitle={SUBTITLE}>
        <AccessNotice kind={state.kind} message={state.message} />
      </PageLayout>
    )
  }

  if (state.phase === 'no-data') {
    return (
      <PageLayout title={TITLE} subtitle={SUBTITLE}>
        <EmptyState
          title="Keine Finanzdaten vorhanden"
          description={`${state.reason} Die Daten entstehen im hq-Repo unter data/finance (Import der Kontoauszüge); es werden bewusst keine Beispielwerte angezeigt.`}
        />
      </PageLayout>
    )
  }

  const { summary } = state
  const view: RangeView = range ?? {
    series: summary.derived.series,
    overview: summary.derived.overview,
    costs: summary.derived.cost_structure,
  }
  const { overview } = view
  const firstMonth = availableMonths[0] ?? ''
  const lastMonth = availableMonths[availableMonths.length - 1] ?? ''

  return (
    <PageLayout
      title={TITLE}
      subtitle={SUBTITLE}
      status={<InvariantBadge invariant={summary.derived.invariant} />}
    >
      <PageSection
        detailsLabel="Was diese Zahlen sind"
        details={
          <Typography variant="body2" color="text.secondary">
            Zuordnung nach Zahlungs-, nicht nach Leistungsdatum; keine
            Abschreibungen, Rückstellungen oder Umsatzsteuer-Abgrenzung; nur
            dieses eine Konto. Neutrale Bewegungen (Geldtransit, Privat,
            Finanzierung) zählen nur in der Kontoveränderung.
          </Typography>
        }
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <MonthSelect
            id="finance-from-label"
            label="Von"
            value={from}
            boundary={firstMonth}
            months={availableMonths}
            isDisabled={(m) => m > (to || lastMonth)}
            onChange={(m) => setFrom(m === firstMonth ? '' : m)}
          />
          <MonthSelect
            id="finance-to-label"
            label="Bis"
            value={to}
            boundary={lastMonth}
            months={availableMonths}
            isDisabled={(m) => m < (from || firstMonth)}
            onChange={(m) => setTo(m === lastMonth ? '' : m)}
          />
          {rangeLoading && (
            <Typography variant="body2" color="text.secondary" role="status">
              Lädt …
            </Typography>
          )}
        </Box>
        <Box sx={{ mt: 1.5 }}>
          <PresetButtons
            presets={financePresets(availableMonths).map((p) => ({
              label: p.label,
              active: p.from === from && p.to === to,
              onClick: () => {
                setFrom(p.from)
                setTo(p.to)
              },
            }))}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Stand: {formatTimestamp(summary.generated_at)} · Daten{' '}
          {formatDate(summary.period.from)} – {formatDate(summary.period.to)} ·{' '}
          {summary.transaction_count.toLocaleString('de-DE')} Buchungen
        </Typography>
      </PageSection>

      {rangeError && <Alert severity="error">{rangeError}</Alert>}

      <KeyFigures
        aria-label="Kennzahlen des Zeitraums"
        items={[
          {
            label: 'Einnahmen',
            value: formatEuro(overview.income),
            hint: `${overview.months} Monat${overview.months === 1 ? '' : 'e'}`,
          },
          { label: 'Ausgaben', value: formatEuro(overview.expense) },
          {
            label: 'Ergebnis',
            value: formatEuro(overview.result),
            hint: 'Einnahmen + Ausgaben',
          },
          {
            label: 'Kontoveränderung',
            value: formatEuro(overview.net_change),
            hint: `inkl. neutral ${formatEuro(overview.neutral)}`,
          },
        ]}
      />

      <PageSection
        title="Monatsverlauf"
        description="Balken: Einnahmen und Ausgaben, Linie: Ergebnis."
      >
        {view.series.length === 0 ? (
          <Typography color="text.secondary">
            Keine Monate im gewählten Zeitraum.
          </Typography>
        ) : (
          <MonthlyChart series={view.series} />
        )}
      </PageSection>

      <PageSection
        title="Kostenstruktur"
        description="Abflüsse nach Kategorie im gewählten Zeitraum"
        disablePadding
      >
        <CostTable rows={view.costs} />
        {summary.uncategorized.count > 0 && (
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Alert severity="info">
              <AlertTitle>Nicht zugeordnete Buchungen</AlertTitle>
              {summary.uncategorized.count} Buchung
              {summary.uncategorized.count === 1 ? '' : 'en'} mit zusammen{' '}
              {formatEuro(summary.uncategorized.amount)} sind im gesamten
              Zeitraum keiner Kategorie zugeordnet. Das ist gewollt: lieber
              sichtbar als geraten. Die Zuordnung wird im hq-Repo gepflegt
              (data/finance/config/categories.json).
            </Alert>
          </Box>
        )}
      </PageSection>
    </PageLayout>
  )
}
