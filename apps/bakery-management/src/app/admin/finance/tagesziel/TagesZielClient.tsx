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
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material'
import {
  Flag as TargetIcon,
  Login as LoginIcon,
  WarningAmber as StaleIcon,
} from '@mui/icons-material'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '@bakery/shared/contexts'
import {
  classifyFinanceError,
  fetchTargetPeriod,
  fetchTargetStatus,
  fetchTargets,
  type FinanceAccessProblem,
} from '../../../../lib/targetsApi'
import type {
  TargetDay,
  TargetEvaluation,
  TargetLevelKey,
  TargetPeriodResponse,
  TargetStatusResponse,
  TargetsResponse,
} from '../../../../lib/targetsTypes'
import {
  formatEuro,
  formatMonth,
  formatReportDate,
} from '../../../../lib/reportFormat'
import TargetStatusChip, {
  formatRatio,
  useTargetStatusColors,
} from '../../../../components/targets/TargetStatusChip'

// ---------------------------------------------------------------------------
// Formatierung
// ---------------------------------------------------------------------------

const currencyNoCents = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const percent1 = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 1,
})
const factorFormat = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** `+12,30 €` / `−4,00 €` - mit Vorzeichen, damit die Richtung lesbar ist. */
export function formatSignedEuro(value: number): string {
  const text = formatEuro(Math.abs(value))
  return value < 0 ? `−${text}` : `+${text}`
}

/** `2026-09-02` → `02.09.` */
function shortDate(date: string): string {
  const [, m, d] = date.split('-')
  return `${d}.${m}.`
}

function addDaysIso(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${month}-${String(last).padStart(2, '0')}`
}

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

const DEFAULT_RANGE_DAYS = 28

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

function LevelToggle({
  value,
  onChange,
  meta,
}: {
  value: TargetLevelKey
  onChange: (level: TargetLevelKey) => void
  meta: TargetsResponse['levels']
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_e, next: TargetLevelKey | null) => {
        if (next) onChange(next)
      }}
      aria-label="Zielstufe"
    >
      <ToggleButton value="breakeven">{meta.breakeven.label}</ToggleButton>
      <ToggleButton value="draw">
        {meta.draw.label}
        {meta.draw.assumed && (
          <Chip
            label="Annahme"
            size="small"
            variant="outlined"
            sx={{ ml: 1, height: 20 }}
          />
        )}
      </ToggleButton>
    </ToggleButtonGroup>
  )
}

function StatusTile({
  title,
  subtitle,
  evaluation,
  extra,
}: {
  title: string
  subtitle?: string
  evaluation: TargetEvaluation
  extra?: React.ReactNode
}) {
  return (
    <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" display="block">
          {subtitle}
        </Typography>
      )}
      <Typography variant="h5" component="p" sx={{ mt: 1 }}>
        {evaluation.actual === null ? '–' : formatEuro(evaluation.actual)}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {evaluation.target === null
          ? 'kein Ziel'
          : `Ziel ${formatEuro(evaluation.target)}`}
        {evaluation.diff !== null && ` · ${formatSignedEuro(evaluation.diff)}`}
      </Typography>
      <Box sx={{ mt: 1.5 }}>
        <TargetStatusChip evaluation={evaluation} size="medium" />
      </Box>
      {extra}
    </Paper>
  )
}

function WeekdayTable({
  targets,
  level,
}: {
  targets: TargetsResponse
  level: TargetLevelKey
}) {
  const rows = targets.levels[level].weekdays
  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Ziel je Wochentag
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tagesbasis {formatEuro(targets.levels[level].daily_base)} ×
        Wochentagsfaktor. Faktoren aus {targets.factors.days_used ?? 0} Tagen
        vom {formatReportDate(targets.factors.window?.from ?? '')} bis{' '}
        {formatReportDate(targets.factors.window?.to ?? '')}, normiert auf
        Mittelwert 1. Ø Ist ist der Durchschnitt derselben Tage.
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Ziel je Wochentag">
          <TableHead>
            <TableRow>
              <TableCell>Wochentag</TableCell>
              <TableCell align="right">Faktor</TableCell>
              <TableCell align="right">Ziel</TableCell>
              <TableCell align="right">Ø Ist</TableCell>
              <TableCell align="right">Abweichung</TableCell>
              <TableCell align="right">Tage</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const diff =
                row.target !== null && row.average_revenue !== null
                  ? row.average_revenue - row.target
                  : null
              const ratio =
                row.target !== null &&
                row.target > 0 &&
                row.average_revenue !== null
                  ? row.average_revenue / row.target
                  : null
              return (
                <TableRow key={row.iso}>
                  <TableCell>
                    {row.label}
                    {row.closed && (
                      <Chip
                        label="Ruhetag"
                        size="small"
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {row.factor === null
                      ? '–'
                      : factorFormat.format(row.factor)}
                  </TableCell>
                  <TableCell align="right">
                    {row.target === null ? '–' : formatEuro(row.target)}
                  </TableCell>
                  <TableCell align="right">
                    {row.average_revenue === null
                      ? '–'
                      : formatEuro(row.average_revenue)}
                  </TableCell>
                  <TableCell align="right">
                    {diff === null
                      ? '–'
                      : `${formatSignedEuro(diff)}${
                          ratio !== null ? ` (${formatRatio(ratio)})` : ''
                        }`}
                  </TableCell>
                  <TableCell align="right">{row.samples}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  )
}

interface DayPoint {
  date: string
  label: string
  actual: number | null
  target: number | null
  status: TargetEvaluation['status']
  statusLabel: string
}

function DayChart({ points }: { points: DayPoint[] }) {
  const theme = useTheme()
  const colors = useTargetStatusColors()
  const grid = theme.palette.divider
  const axis = theme.palette.text.secondary
  const paper = theme.palette.background.paper
  const text = theme.palette.text.primary
  return (
    <Box sx={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ left: 8, right: 8 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: axis, fontSize: 12 }}
            stroke={grid}
            interval="preserveStartEnd"
          />
          <YAxis
            width={80}
            tickFormatter={(v: number) => currencyNoCents.format(v)}
            tick={{ fill: axis, fontSize: 12 }}
            stroke={grid}
          />
          <Tooltip
            formatter={(value: number | string, name: string) => [
              formatEuro(Number(value)),
              name === 'actual' ? 'Ist' : 'Ziel',
            ]}
            labelFormatter={(label, payload) => {
              const p =
                payload && payload[0] && (payload[0].payload as DayPoint)
              return p ? `${p.label} · ${p.statusLabel}` : String(label)
            }}
            contentStyle={{
              backgroundColor: paper,
              color: text,
              borderColor: grid,
            }}
            itemStyle={{ color: text }}
            labelStyle={{ color: text }}
          />
          <Bar
            dataKey="actual"
            name="actual"
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          >
            {points.map((p) => (
              <Cell key={p.date} fill={colors[p.status]} />
            ))}
          </Bar>
          <Line
            type="stepAfter"
            dataKey="target"
            name="target"
            stroke={text}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  )
}

function DayTable({
  days,
  level,
}: {
  days: TargetDay[]
  level: TargetLevelKey
}) {
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label="Tagesverlauf">
        <TableHead>
          <TableRow>
            <TableCell>Tag</TableCell>
            <TableCell align="right">Ist</TableCell>
            <TableCell align="right">Ziel</TableCell>
            <TableCell align="right">Abweichung</TableCell>
            <TableCell>Ampel</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {days.map((day) => {
            const ev = day.levels[level]
            return (
              <TableRow key={day.date}>
                <TableCell>
                  {day.short}, {formatReportDate(day.date)}
                </TableCell>
                <TableCell align="right">
                  {ev.actual === null ? '–' : formatEuro(ev.actual)}
                </TableCell>
                <TableCell align="right">
                  {ev.target === null ? '–' : formatEuro(ev.target)}
                </TableCell>
                <TableCell align="right">
                  {ev.diff === null ? '–' : formatSignedEuro(ev.diff)}
                </TableCell>
                <TableCell>
                  <TargetStatusChip evaluation={ev} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Box>
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
            href="/admin/login?next=/admin/finance/tagesziel"
            color="inherit"
            size="small"
            startIcon={<LoginIcon />}
          >
            Zur Anmeldung
          </Button>
        }
      >
        <AlertTitle>Anmeldung erforderlich</AlertTitle>
        Das Tagesziel ist nur nach Anmeldung als Inhaber/Admin sichtbar.
      </Alert>
    )
  }
  if (kind === 'forbidden') {
    return (
      <Alert severity="warning">
        <AlertTitle>Keine Berechtigung</AlertTitle>
        {message} Das Tagesziel sehen nur Konten mit der Rolle Inhaber/Admin.{' '}
        <Link href="/admin/login?next=/admin/finance/tagesziel">
          Mit einem anderen Konto anmelden
        </Link>
      </Alert>
    )
  }
  return (
    <Alert severity="error">
      <AlertTitle>Tagesziel konnte nicht geladen werden</AlertTitle>
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
  | { phase: 'no-target'; reason: string; partial?: Partial<TargetsResponse> }
  | { phase: 'ok'; targets: TargetsResponse; status: TargetStatusResponse }

export default function TagesZielClient() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [state, setState] = useState<PageState>({ phase: 'loading' })
  const [level, setLevel] = useState<TargetLevelKey>('breakeven')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [period, setPeriod] = useState<TargetPeriodResponse | null>(null)
  const [periodError, setPeriodError] = useState<string | null>(null)
  const [periodLoading, setPeriodLoading] = useState(false)
  const [month, setMonth] = useState('')
  const [monthView, setMonthView] = useState<TargetStatusResponse | null>(null)
  const [monthError, setMonthError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      const targets = await fetchTargets()
      if (targets.status === 'no-target') {
        setState({
          phase: 'no-target',
          reason: targets.reason,
          partial: targets.partial,
        })
        return
      }
      const status = await fetchTargetStatus()
      if (status.status === 'no-target') {
        setState({ phase: 'no-target', reason: status.reason })
        return
      }
      setState({ phase: 'ok', targets: targets.data, status: status.data })
      const last = status.data.last_evaluated_date ?? status.data.today
      setTo(last)
      setFrom(addDaysIso(last, -(DEFAULT_RANGE_DAYS - 1)))
      setMonth(last.slice(0, 7))
      setMonthView(status.data)
    } catch (err) {
      const { kind, message } = classifyFinanceError(err)
      setState({ phase: 'access', kind, message })
    }
  }, [])

  // Erst laden, wenn der AuthProvider ein gespeichertes Token geprüft hat.
  useEffect(() => {
    if (authLoading) return
    load()
  }, [authLoading, isAuthenticated, load])

  // Tagesverlauf über den gewählten Zeitraum - gerechnet auf dem Server.
  useEffect(() => {
    if (state.phase !== 'ok' || !from || !to || from > to) return
    let cancelled = false
    setPeriodLoading(true)
    fetchTargetPeriod(from, to)
      .then((result) => {
        if (cancelled) return
        if (result.status === 'no-target') {
          setPeriodError(result.reason)
          setPeriod(null)
          return
        }
        setPeriodError(null)
        setPeriod(result.data)
      })
      .catch((err) => {
        if (cancelled) return
        setPeriodError(classifyFinanceError(err).message)
        setPeriod(null)
      })
      .finally(() => {
        if (!cancelled) setPeriodLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [state.phase, from, to])

  // Monatssicht: Woche/Monat bis zum letzten ausgewerteten Tag des Monats.
  useEffect(() => {
    if (state.phase !== 'ok' || !month) return
    const last = state.status.last_evaluated_date ?? state.status.today
    const refDate = monthEnd(month) < last ? monthEnd(month) : last
    if (refDate === state.status.day.date) {
      setMonthView(state.status)
      setMonthError(null)
      return
    }
    let cancelled = false
    fetchTargetStatus(refDate)
      .then((result) => {
        if (cancelled) return
        if (result.status === 'no-target') {
          setMonthError(result.reason)
          setMonthView(null)
          return
        }
        setMonthError(null)
        setMonthView(result.data)
      })
      .catch((err) => {
        if (cancelled) return
        setMonthError(classifyFinanceError(err).message)
        setMonthView(null)
      })
    return () => {
      cancelled = true
    }
  }, [state, month])

  const monthOptions = useMemo(() => {
    if (state.phase !== 'ok') return []
    const last = (state.status.last_evaluated_date ?? state.status.today).slice(
      0,
      7
    )
    return Array.from({ length: 12 }, (_v, i) => shiftMonth(last, -i))
  }, [state])

  const header = (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h4" component="h1">
        <TargetIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Tagesziel
      </Typography>
      <Typography variant="subtitle1" color="text.secondary">
        Break-even als Tagesziel je Wochentag - rückblickend aus den
        Tagesabschlüssen der Kasse
      </Typography>
    </Box>
  )

  if (state.phase === 'loading') {
    return (
      <Box>
        {header}
        <LinearProgress aria-label="Tagesziel wird geladen" />
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

  if (state.phase === 'no-target') {
    const cfg = state.partial?.config
    return (
      <Box>
        {header}
        <Alert severity="info">
          <AlertTitle>Kein Tagesziel verfügbar</AlertTitle>
          {state.reason} Es wird bewusst kein geschätzter Wert angezeigt. Die
          Parameter stehen im hq-Repo unter data/finance/config/targets.json.
        </Alert>
        {cfg && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Stand der Kostenbasis: {formatReportDate(cfg.updated)} · Modus:{' '}
            {cfg.mode === 'manual' ? 'manuell vorgegeben' : 'abgeleitet'}
          </Typography>
        )}
      </Box>
    )
  }

  const { targets, status } = state
  const cfg = targets.config
  const costBase = targets.cost_base
  const levelInfo = targets.levels[level]
  const dayEval = status.day.levels[level]
  const weekEval = status.week.levels[level]
  const monthEval = status.month.levels[level]
  const projection = status.month.projection[level]

  const points: DayPoint[] = (period?.days ?? []).map((d) => ({
    date: d.date,
    label: `${d.short} ${shortDate(d.date)}`,
    actual: d.levels[level].actual,
    target: d.levels[level].target,
    status: d.levels[level].status,
    statusLabel: d.levels[level].label,
  }))

  return (
    <Box>
      {header}

      {/* Kopfzeile: Stand der Kostenbasis und zuletzt ausgewerteter Tag */}
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        alignItems="center"
        useFlexGap
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          Zuletzt ausgewertet:{' '}
          <strong>
            {targets.last_evaluated_date
              ? `${status.day.weekday}, ${formatReportDate(
                  targets.last_evaluated_date
                )}`
              : 'noch kein Tag'}
          </strong>{' '}
          · Kostenbasis: Stand {formatReportDate(cfg.updated)} (
          {cfg.mode === 'manual'
            ? 'manuell vorgegeben'
            : `abgeleitet aus ${
                costBase.window?.months ?? 0
              } Monaten Finanzdaten`}
          ) · {cfg.business_days_per_month} Geschäftstage/Monat · Schwellen{' '}
          {formatRatio(cfg.thresholds.green)} /{' '}
          {formatRatio(cfg.thresholds.amber)}
        </Typography>
        {cfg.stale && (
          <Chip
            icon={<StaleIcon />}
            color="warning"
            variant="outlined"
            size="small"
            label={`Kostenbasis ${cfg.age_months} Monate alt`}
          />
        )}
      </Stack>

      {cfg.stale && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>Kostenbasis veraltet</AlertTitle>
          Der Stand der Kostenbasis ist {cfg.age_months} Monate alt (Warnung ab{' '}
          {cfg.stale_after_months}). Nach Personal- oder Preisänderungen ist ein
          Ziel aus alten Daten irreführend - bitte `updated` und gegebenenfalls
          den Modus in targets.json prüfen.
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        Cashflow-Sicht nach Buchungsdatum, keine GuV: Abschreibungen,
        Rückstellungen und Rücklagen fehlen, das tatsächliche Plus liegt über
        dieser Linie. Die Ampel blickt zurück - der frischeste Tag ist im
        Regelfall gestern; der laufende Tag ist offen, nie rot. Einzeltage sind
        Rauschen: Woche und Monat zählen.
      </Alert>

      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 3 }}
      >
        <LevelToggle value={level} onChange={setLevel} meta={targets.levels} />
        {levelInfo.assumed && (
          <Typography variant="body2" color="text.secondary">
            Annahme: Die Privatentnahme ist{' '}
            {levelInfo.private_draw_source === 'derived'
              ? 'aus den neutralen Kategorien (Privat, Geldtransit) abgeleitet'
              : 'nicht bekannt'}{' '}
            - ob das Entnahmen sind, ist fachlich nicht geklärt.
          </Typography>
        )}
      </Stack>

      {/* Kennzahlen der gewählten Stufe */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatusTile
            title="Letzter Tag"
            subtitle={`${status.day.weekday}, ${formatReportDate(
              status.day.date
            )}`}
            evaluation={dayEval}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatusTile
            title={`Woche bis ${shortDate(status.week.to)}`}
            subtitle={`KW ${status.week.iso_week.slice(-2)} · ${
              weekEval.days_counted
            } Tag${weekEval.days_counted === 1 ? '' : 'e'} bewertet`}
            evaluation={weekEval}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatusTile
            title={`Monat bis ${shortDate(status.month.to)}`}
            subtitle={`${formatMonth(status.month.month)} · ${
              monthEval.days_counted
            } Tag${monthEval.days_counted === 1 ? '' : 'e'} bewertet`}
            evaluation={monthEval}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatusTile
            title="Hochrechnung Monatsende"
            subtitle={`${projection.remaining_days} Geschäftstag${
              projection.remaining_days === 1 ? '' : 'e'
            } offen · Restziel ${formatEuro(projection.remaining_target)}`}
            evaluation={{
              ...projection,
              actual: projection.projected_actual,
              target: projection.month_target,
            }}
          />
        </Grid>
      </Grid>

      {/* Kostenbasis */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Kostenbasis
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              Variable Kostenquote
            </Typography>
            <Typography variant="h6" component="p">
              {percent1.format(costBase.variable_cost_ratio ?? 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Deckungsbeitrag{' '}
              {percent1.format(costBase.contribution_ratio ?? 0)}
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              Fixkosten je Monat
            </Typography>
            <Typography variant="h6" component="p">
              {formatEuro(levelInfo.fixed_costs_monthly)}
            </Typography>
            {level === 'draw' && (
              <Typography variant="caption" color="text.secondary">
                inkl. Entnahme {formatEuro(levelInfo.private_draw_monthly ?? 0)}
              </Typography>
            )}
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              Break-even je Monat
            </Typography>
            <Typography variant="h6" component="p">
              {formatEuro(levelInfo.breakeven_monthly)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              davon Kasse {formatEuro(levelInfo.pos_target_monthly)}
              {(costBase.non_pos_revenue_monthly ?? 0) > 0 &&
                `, außer Kasse ${formatEuro(
                  costBase.non_pos_revenue_monthly ?? 0
                )}`}
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              Tagesziel (Basis)
            </Typography>
            <Typography variant="h6" component="p">
              {formatEuro(levelInfo.daily_base)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              je Geschäftstag vor Wochentagsfaktor
            </Typography>
          </Grid>
        </Grid>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Ein Euro weniger Wareneinsatz wirkt stärker als ein Euro mehr Umsatz -
          die Kostenquote gehört deshalb mit auf diese Seite.
        </Typography>
        {costBase.assumptions && costBase.assumptions.length > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <AlertTitle>Annahmen</AlertTitle>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {costBase.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </Box>
          </Alert>
        )}
      </Paper>

      <Stack spacing={3}>
        <WeekdayTable targets={targets} level={level} />

        {/* Tagesverlauf */}
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            Tagesverlauf
          </Typography>
          <Stack
            direction="row"
            spacing={2}
            flexWrap="wrap"
            alignItems="center"
            useFlexGap
            sx={{ mb: 2 }}
          >
            <TextField
              label="Von"
              type="date"
              size="small"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: to }}
            />
            <TextField
              label="Bis"
              type="date"
              size="small"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: from }}
            />
            {periodLoading && (
              <Typography variant="body2" color="text.secondary">
                Lädt …
              </Typography>
            )}
          </Stack>
          {periodError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {periodError}
            </Alert>
          )}
          {period && (
            <>
              <Typography
                variant="body2"
                component="div"
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                Balken: Tagesumsatz in Ampelfarbe, gestrichelte Linie: Ziel des
                Wochentags. Zeitraum gesamt:{' '}
                {period.levels[level].actual === null
                  ? '–'
                  : formatEuro(period.levels[level].actual)}{' '}
                von{' '}
                {period.levels[level].target === null
                  ? '–'
                  : formatEuro(period.levels[level].target)}{' '}
                <TargetStatusChip evaluation={period.levels[level]} />
              </Typography>
              <DayChart points={points} />
              <Box sx={{ mt: 2 }}>
                <DayTable days={period.days} level={level} />
              </Box>
            </>
          )}
        </Paper>

        {/* Monatssicht */}
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            Monatssicht
          </Typography>
          <FormControl size="small" sx={{ minWidth: 200, mb: 2 }}>
            <InputLabel id="targets-month-label">Monat</InputLabel>
            <Select
              labelId="targets-month-label"
              label="Monat"
              value={month}
              onChange={(e) => setMonth(String(e.target.value))}
            >
              {monthOptions.map((m) => (
                <MenuItem key={m} value={m}>
                  {formatMonth(m)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {monthError && <Alert severity="error">{monthError}</Alert>}
          {monthView && <MonthSummary view={monthView} level={level} />}
        </Paper>
      </Stack>
    </Box>
  )
}

function MonthSummary({
  view,
  level,
}: {
  view: TargetStatusResponse
  level: TargetLevelKey
}) {
  const m = view.month
  const toDate = m.levels[level]
  const proj = m.projection[level]
  const rows: Array<[string, string]> = [
    [
      `Ist bis ${shortDate(m.to)}`,
      toDate.actual === null ? '–' : formatEuro(toDate.actual),
    ],
    [
      `Ziel bis ${shortDate(m.to)}`,
      toDate.target === null ? '–' : formatEuro(toDate.target),
    ],
    ['Bewertete Tage', String(toDate.days_counted)],
    [
      'Offene Geschäftstage bis Monatsende',
      `${proj.remaining_days} · Restziel ${formatEuro(proj.remaining_target)}`,
    ],
    [
      'Monatsziel',
      proj.month_target === null ? '–' : formatEuro(proj.month_target),
    ],
    [
      'Hochrechnung Monatsende',
      proj.projected_actual === null ? '–' : formatEuro(proj.projected_actual),
    ],
  ]
  return (
    <Box>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        {formatMonth(m.month)}
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Monatssicht">
          <TableBody>
            {rows.map(([label, value]) => (
              <TableRow key={label}>
                <TableCell component="th" scope="row">
                  {label}
                </TableCell>
                <TableCell align="right">{value}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell component="th" scope="row">
                Ampel bis {shortDate(m.to)}
              </TableCell>
              <TableCell align="right">
                <TargetStatusChip evaluation={toDate} />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row">
                Ampel Hochrechnung
              </TableCell>
              <TableCell align="right">
                <TargetStatusChip evaluation={proj} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1, display: 'block' }}
      >
        Hochrechnung: der bisherige Zielerreichungsgrad wird über die
        Wochentagsfaktoren auf die restlichen Geschäftstage übertragen.
        Vergangene Tage ohne Bericht zählen weder als Ist noch als Ziel.
      </Typography>
    </Box>
  )
}
