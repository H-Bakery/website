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
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  Login as LoginIcon,
  WarningAmber as StaleIcon,
} from '@mui/icons-material'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useSession } from '../../../../lib/session'
import {
  classifyFinanceError,
  fetchTargetPeriod,
  fetchTargetStatus,
  fetchTargets,
  PERSONAL_SESSION_HINT,
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
import {
  EmptyState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../components/layout'
import DateRangeFilter from '../../../../components/analytics/DateRangeFilter'
import { weekPresets } from '../../../../components/analytics/dateRange'

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

/**
 * Fußnote zur Wochentagstabelle. Das Verhältnis Ø Ist / Ziel ist an allen
 * Wochentagen dasselbe (der Server liefert es einmal je Stufe), deshalb
 * steht es nicht in jeder Zeile - dort läse es sich, als hätten alle
 * Wochentage exakt gleich abgeschnitten.
 */
export function describeAverageRatio(ratio: number): string {
  const delta = Math.abs(ratio - 1)
  if (delta < 0.0005) {
    return 'Im Faktorfenster lag der Ø Ist-Umsatz genau auf dem Tagesziel; das gilt für alle Wochentage gleichermaßen, weil die Faktoren aus denselben Tagen stammen.'
  }
  const direction = ratio > 1 ? 'über' : 'unter'
  return `Im Faktorfenster lag der Ø Ist-Umsatz ${percent1.format(
    delta
  )} ${direction} dem Tagesziel (${formatRatio(
    ratio
  )} des Ziels). Das Verhältnis ist an allen Wochentagen dasselbe, weil die Faktoren aus denselben Tagen stammen - die Spalte Abweichung zeigt deshalb nur den Betrag.`
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
      sx={{
        width: { xs: '100%', sm: 'auto' },
        '& .MuiToggleButton-root': {
          flex: { xs: 1, sm: 'none' },
          textTransform: 'none',
          lineHeight: 1.25,
          px: 1.5,
        },
      }}
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

const HIDE_ON_PHONE = { display: { xs: 'none', sm: 'table-cell' } } as const

/** Eine Kennzahl der Ampel: Ist groß, darunter Zeitraum, Ziel und Chip. */
function statusFigure(
  label: string,
  context: string,
  evaluation: TargetEvaluation
) {
  return {
    label,
    value: evaluation.actual === null ? '–' : formatEuro(evaluation.actual),
    hint: (
      <>
        <Box component="span" sx={{ display: 'block' }}>
          {context}
        </Box>
        <Box component="span" sx={{ display: 'block' }}>
          {evaluation.target === null
            ? 'kein Ziel'
            : `Ziel ${formatEuro(evaluation.target)}`}
          {evaluation.diff !== null &&
            ` · ${formatSignedEuro(evaluation.diff)}`}
        </Box>
        <Box
          component="span"
          sx={{
            display: 'block',
            mt: 1,
            // In schmalen Kacheln darf der Chip umbrechen statt „…“.
            '& .MuiChip-root': { height: 'auto', maxWidth: '100%', py: 0.25 },
            '& .MuiChip-label': { whiteSpace: 'normal' },
          }}
        >
          <TargetStatusChip evaluation={evaluation} />
        </Box>
      </>
    ),
  }
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
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label="Ziel je Wochentag">
        <TableHead>
          <TableRow>
            <TableCell>Wochentag</TableCell>
            <TableCell align="right" sx={HIDE_ON_PHONE}>
              Faktor
            </TableCell>
            <TableCell align="right">Ziel</TableCell>
            <TableCell align="right">Ø Ist</TableCell>
            <TableCell align="right" sx={HIDE_ON_PHONE}>
              Abweichung
            </TableCell>
            <TableCell align="right" sx={HIDE_ON_PHONE}>
              Tage
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
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
                <TableCell align="right" sx={HIDE_ON_PHONE}>
                  {row.factor === null ? '–' : factorFormat.format(row.factor)}
                </TableCell>
                <TableCell align="right">
                  {row.target === null ? '–' : formatEuro(row.target)}
                </TableCell>
                <TableCell align="right">
                  {row.average_revenue === null
                    ? '–'
                    : formatEuro(row.average_revenue)}
                </TableCell>
                <TableCell align="right" sx={HIDE_ON_PHONE}>
                  {row.deviation === null
                    ? '–'
                    : formatSignedEuro(row.deviation)}
                </TableCell>
                <TableCell align="right" sx={HIDE_ON_PHONE}>
                  {row.samples}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Box>
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

/** Achse der Ziel-Markierung - dieselben Kategorien wie die Balken. */
export const TARGET_AXIS_ID = 'target'

export interface TargetMarkerProps {
  x?: number
  y?: number
  width?: number
  height?: number
  /** Farbe der Markierung (Schrift) und des Rands (Fläche). */
  stroke: string
  halo: string
  payload?: { target?: number | null }
}

/**
 * Ziel eines Tages als waagrechter Strich genau über **seinem** Balken (von
 * `x` bis `x + width`, auf Höhe `y` = Ziel). Früher war das Ziel eine
 * `stepAfter`-Linie über die Balkenmitten - die Stufe begann in der Mitte,
 * die linke Hälfte jedes Balkens zeigte also das Ziel des Vortags (Fr 06.11.
 * stand unter dem Donnerstagsziel). Ein Rand in der Flächenfarbe hält den
 * Strich über den Ampelfarben und dem Hintergrund lesbar, hell wie dunkel.
 */
export function TargetMarker({
  x,
  y,
  width,
  stroke,
  halo,
  payload,
}: TargetMarkerProps) {
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    !Number.isFinite(y) ||
    payload?.target === null ||
    payload?.target === undefined
  ) {
    return null
  }
  return (
    <g data-testid="target-marker">
      <line x1={x} x2={x + width} y1={y} y2={y} stroke={halo} strokeWidth={6} />
      <line
        x1={x}
        x2={x + width}
        y1={y}
        y2={y}
        stroke={stroke}
        strokeWidth={2.5}
        strokeDasharray="5 3"
      />
    </g>
  )
}

function DayChart({ points }: { points: DayPoint[] }) {
  const theme = useTheme()
  const colors = useTargetStatusColors()
  const grid = theme.palette.divider
  const axis = theme.palette.text.secondary
  const paper = theme.palette.background.paper
  const text = theme.palette.text.primary
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  return (
    <Box sx={{ width: '100%', height: phone ? 240 : 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ left: 8, right: 8 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: axis, fontSize: 12 }}
            stroke={grid}
            interval="preserveStartEnd"
          />
          <XAxis xAxisId={TARGET_AXIS_ID} dataKey="label" hide />
          <YAxis
            width={phone ? 60 : 80}
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
          {/* Ziel: eine eigene, unsichtbare Kategorie-Achse, damit die
              Markierung genau über dem Balken desselben Tages liegt und
              nicht neben ihm (zwei Bar-Reihen auf einer Achse stünden
              nebeneinander). */}
          <Bar
            xAxisId={TARGET_AXIS_ID}
            dataKey="target"
            name="target"
            maxBarSize={40}
            isAnimationActive={false}
            shape={(props: unknown) => (
              <TargetMarker
                {...(props as TargetMarkerProps)}
                stroke={text}
                halo={paper}
              />
            )}
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
            <TableCell align="right" sx={HIDE_ON_PHONE}>
              Ziel
            </TableCell>
            <TableCell align="right" sx={HIDE_ON_PHONE}>
              Abweichung
            </TableCell>
            <TableCell>Ampel</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {days.map((day) => {
            const ev = day.levels[level]
            return (
              <TableRow key={day.date}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {day.short}, {shortDate(day.date)}
                </TableCell>
                <TableCell align="right">
                  {ev.actual === null ? '–' : formatEuro(ev.actual)}
                </TableCell>
                <TableCell align="right" sx={HIDE_ON_PHONE}>
                  {ev.target === null ? '–' : formatEuro(ev.target)}
                </TableCell>
                <TableCell align="right" sx={HIDE_ON_PHONE}>
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
  if (kind === 'personal_session') {
    // F4: Inhaber an einer PIN-Station - die API verlangt eine
    // Passwort-Sitzung (403 personal_session_required, B4). Bewusst ohne
    // Anmelde-Link: eine PIN-Sitzung gibt es nur an einem Stationsgerät, und
    // eine Passwort-Sitzung dort hielte Finanzen und Benutzerverwaltung 12 h
    // statt 10 min offen (F1 beendet sie beim Einrichten der Station).
    return (
      <Alert severity="info" data-testid="personal-session-notice">
        <AlertTitle>Tagesziel an der Station nicht verfügbar</AlertTitle>
        {PERSONAL_SESSION_HINT}
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
  const { isAuthenticated, isLoading: authLoading } = useSession()
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

  // Erst laden, wenn der SessionProvider ein gespeichertes Token geprüft hat.
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

  const title = 'Tagesziel'
  const subtitle = 'Break-even je Wochentag, rückblickend aus der Kasse'

  if (state.phase === 'loading') {
    return (
      <PageLayout title={title} subtitle={subtitle}>
        <LoadingState label="Tagesziel wird geladen" />
      </PageLayout>
    )
  }

  if (state.phase === 'access') {
    return (
      <PageLayout title={title} subtitle={subtitle}>
        <AccessNotice kind={state.kind} message={state.message} />
      </PageLayout>
    )
  }

  if (state.phase === 'no-target') {
    const cfg = state.partial?.config
    return (
      <PageLayout title={title} subtitle={subtitle}>
        <EmptyState
          title="Kein Tagesziel verfügbar"
          description={
            <>
              {state.reason} Es wird bewusst kein geschätzter Wert angezeigt.
              Die Parameter stehen im hq-Repo unter
              data/finance/config/targets.json.
              {cfg && (
                <Box component="span" sx={{ display: 'block', mt: 1 }}>
                  Stand der Kostenbasis: {formatReportDate(cfg.updated)} ·
                  Modus:{' '}
                  {cfg.mode === 'manual' ? 'manuell vorgegeben' : 'abgeleitet'}
                </Box>
              )}
            </>
          }
        />
      </PageLayout>
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
  const hasAssumptions = Boolean(
    costBase.assumptions && costBase.assumptions.length > 0
  )
  const anchor = status.last_evaluated_date ?? status.today

  const points: DayPoint[] = (period?.days ?? []).map((d) => ({
    date: d.date,
    label: `${d.short} ${shortDate(d.date)}`,
    actual: d.levels[level].actual,
    target: d.levels[level].target,
    status: d.levels[level].status,
    statusLabel: d.levels[level].label,
  }))

  const days = (n: number) => `${n} Tag${n === 1 ? '' : 'e'} bewertet`

  return (
    <PageLayout
      title={title}
      width="default"
      subtitle={
        <>
          Zuletzt ausgewertet:{' '}
          <strong>
            {targets.last_evaluated_date
              ? `${status.day.weekday}, ${formatReportDate(
                  targets.last_evaluated_date
                )}`
              : 'noch kein Tag'}
          </strong>{' '}
          · Kostenbasis: Stand {formatReportDate(cfg.updated)}
        </>
      }
      status={
        cfg.stale ? (
          <Chip
            icon={<StaleIcon />}
            color="warning"
            variant="outlined"
            size="small"
            label={`Kostenbasis ${cfg.age_months} Monate alt`}
          />
        ) : undefined
      }
    >
      {cfg.stale && (
        <Alert severity="warning">
          <AlertTitle>Kostenbasis veraltet</AlertTitle>
          Der Stand der Kostenbasis ist {cfg.age_months} Monate alt (Warnung ab{' '}
          {cfg.stale_after_months}). Nach Personal- oder Preisänderungen ist ein
          Ziel aus alten Daten irreführend - bitte `updated` und gegebenenfalls
          den Modus in targets.json prüfen.
        </Alert>
      )}

      <PageSection
        variant="plain"
        detailsLabel="So liest man die Ampel"
        details={
          <Typography variant="body2" color="text.secondary">
            Cashflow-Sicht nach Buchungsdatum, keine GuV: Abschreibungen,
            Rückstellungen und Rücklagen fehlen, das tatsächliche Plus liegt
            über dieser Linie. Die Ampel blickt zurück - der frischeste Tag ist
            im Regelfall gestern; der laufende Tag ist offen, nie rot.
            Einzeltage sind Rauschen: Woche und Monat zählen. Schwellen{' '}
            {formatRatio(cfg.thresholds.green)} /{' '}
            {formatRatio(cfg.thresholds.amber)} des Ziels.
          </Typography>
        }
      >
        <Box sx={{ mb: 2 }}>
          <LevelToggle
            value={level}
            onChange={setLevel}
            meta={targets.levels}
          />
          {levelInfo.assumed && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Annahme: Die Privatentnahme ist{' '}
              {levelInfo.private_draw_source === 'derived'
                ? 'aus den neutralen Kategorien (Privat, Geldtransit) abgeleitet'
                : 'nicht bekannt'}{' '}
              - ob das Entnahmen sind, ist fachlich nicht geklärt.
            </Typography>
          )}
        </Box>
        <KeyFigures
          aria-label="Ampel der gewählten Stufe"
          items={[
            statusFigure(
              'Letzter Tag',
              `${status.day.weekday}, ${formatReportDate(status.day.date)}`,
              dayEval
            ),
            statusFigure(
              `Woche bis ${shortDate(status.week.to)}`,
              `KW ${status.week.iso_week.slice(-2)} · ${days(
                weekEval.days_counted
              )}`,
              weekEval
            ),
            statusFigure(
              `Monat bis ${shortDate(status.month.to)}`,
              `${formatMonth(status.month.month)} · ${days(
                monthEval.days_counted
              )}`,
              monthEval
            ),
            statusFigure(
              'Hochrechnung Monatsende',
              `${projection.remaining_days} Geschäftstag${
                projection.remaining_days === 1 ? '' : 'e'
              } offen`,
              {
                ...projection,
                actual: projection.projected_actual,
                target: projection.month_target,
              }
            ),
          ]}
        />
      </PageSection>

      <PageSection
        title="Tagesverlauf"
        description="Balken: Tagesumsatz in Ampelfarbe, gestrichelt: Ziel des Wochentags"
        detailsLabel="Tage als Tabelle"
        details={
          period ? <DayTable days={period.days} level={level} /> : undefined
        }
      >
        <DateRangeFilter
          bare
          from={from}
          to={to}
          onApply={(f, t) => {
            setFrom(f)
            setTo(t)
          }}
          max={status.today}
          presets={weekPresets(anchor)}
        />
        {periodLoading && !period && (
          <LoadingState dense label="Tagesverlauf wird geladen …" />
        )}
        {periodError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {periodError}
          </Alert>
        )}
        {period && (
          <>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 1,
                mt: 2,
                mb: 1,
              }}
            >
              <Typography variant="body2">
                Zeitraum gesamt:{' '}
                <strong>
                  {period.levels[level].actual === null
                    ? '–'
                    : formatEuro(period.levels[level].actual)}
                </strong>{' '}
                von{' '}
                {period.levels[level].target === null
                  ? '–'
                  : formatEuro(period.levels[level].target)}
              </Typography>
              <TargetStatusChip evaluation={period.levels[level]} />
            </Box>
            <DayChart points={points} />
          </>
        )}
      </PageSection>

      <PageSection
        title="Ziel je Wochentag"
        description={`Tagesbasis ${formatEuro(
          levelInfo.daily_base
        )} × Wochentagsfaktor`}
        disablePadding
        detailsLabel="Wie die Faktoren entstehen"
        details={
          <>
            <Typography variant="body2" color="text.secondary">
              Faktoren aus {targets.factors.days_used ?? 0} Tagen vom{' '}
              {formatReportDate(targets.factors.window?.from ?? '')} bis{' '}
              {formatReportDate(targets.factors.window?.to ?? '')}, normiert auf
              Mittelwert 1. Ø Ist ist der Durchschnitt derselben Tage.
            </Typography>
            {levelInfo.average_ratio !== null && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1 }}
                data-testid="weekday-average-ratio"
              >
                {describeAverageRatio(levelInfo.average_ratio)}
              </Typography>
            )}
          </>
        }
      >
        <WeekdayTable targets={targets} level={level} />
      </PageSection>

      <PageSection
        title="Kostenbasis"
        description={`${
          cfg.mode === 'manual'
            ? 'Manuell vorgegeben'
            : `Abgeleitet aus ${
                costBase.window?.months ?? 0
              } Monaten Finanzdaten`
        } · ${cfg.business_days_per_month} Geschäftstage/Monat`}
        actions={
          hasAssumptions ? (
            <Chip label="Annahme" size="small" variant="outlined" />
          ) : undefined
        }
        detailsLabel={hasAssumptions ? 'Rechenweg und Annahmen' : 'Rechenweg'}
        details={
          <>
            <Typography variant="body2" color="text.secondary">
              Ein Euro weniger Wareneinsatz wirkt stärker als ein Euro mehr
              Umsatz - die Kostenquote gehört deshalb mit auf diese Seite.
            </Typography>
            {hasAssumptions && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Annahmen
                </Typography>
                <Box
                  component="ul"
                  sx={{ m: 0, pl: 2.5, color: 'text.secondary' }}
                >
                  {(costBase.assumptions ?? []).map((a) => (
                    <Typography component="li" variant="body2" key={a}>
                      {a}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
          </>
        }
      >
        <CostFigures
          items={[
            {
              label: 'Variable Kostenquote',
              value: percent1.format(costBase.variable_cost_ratio ?? 0),
              hint: `Deckungsbeitrag ${percent1.format(
                costBase.contribution_ratio ?? 0
              )}`,
            },
            {
              label: 'Fixkosten je Monat',
              value: formatEuro(levelInfo.fixed_costs_monthly),
              hint:
                level === 'draw'
                  ? `inkl. Entnahme ${formatEuro(
                      levelInfo.private_draw_monthly ?? 0
                    )}`
                  : undefined,
            },
            {
              label: 'Break-even je Monat',
              value: formatEuro(levelInfo.breakeven_monthly),
              hint: `davon Kasse ${formatEuro(levelInfo.pos_target_monthly)}${
                (costBase.non_pos_revenue_monthly ?? 0) > 0
                  ? `, außer Kasse ${formatEuro(
                      costBase.non_pos_revenue_monthly ?? 0
                    )}`
                  : ''
              }`,
            },
            {
              label: 'Tagesziel (Basis)',
              value: formatEuro(levelInfo.daily_base),
              hint: 'je Geschäftstag vor Wochentagsfaktor',
            },
          ]}
        />
      </PageSection>

      <PageSection
        title="Monatssicht"
        description="Ein Monat bis zu seinem letzten ausgewerteten Tag"
        actions={
          <FormControl size="small" sx={{ minWidth: 180 }}>
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
        }
        detailsLabel="So wird hochgerechnet"
        details={
          <Typography variant="body2" color="text.secondary">
            Hochrechnung: der bisherige Zielerreichungsgrad wird über die
            Wochentagsfaktoren auf die restlichen Geschäftstage übertragen.
            Vergangene Tage ohne Bericht zählen weder als Ist noch als Ziel.
          </Typography>
        }
      >
        {monthError && <Alert severity="error">{monthError}</Alert>}
        {monthView && <MonthSummary view={monthView} level={level} />}
      </PageSection>
    </PageLayout>
  )
}

/**
 * Kennzahlen innerhalb eines Abschnitts (ohne eigene Karten - die
 * `KeyFigures` sind Karten und stünden sonst als Karte in der Karte).
 */
function CostFigures({
  items,
}: {
  items: Array<{ label: string; value: string; hint?: string }>
}) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gap: 2,
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
        },
      }}
    >
      {items.map((item) => (
        <Box key={item.label} sx={{ minWidth: 0 }}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {item.label}
          </Typography>
          <Typography
            component="dd"
            sx={{
              m: 0,
              fontWeight: 600,
              fontSize: '1.125rem',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {item.value}
          </Typography>
          {item.hint && (
            <Typography
              component="dd"
              variant="caption"
              color="text.secondary"
              sx={{ m: 0, display: 'block' }}
            >
              {item.hint}
            </Typography>
          )}
        </Box>
      ))}
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
  const rows: Array<[string, React.ReactNode]> = [
    [
      `Ist bis ${shortDate(m.to)}`,
      toDate.actual === null ? '–' : formatEuro(toDate.actual),
    ],
    [
      `Ziel bis ${shortDate(m.to)}`,
      toDate.target === null ? '–' : formatEuro(toDate.target),
    ],
    [
      `Ampel bis ${shortDate(m.to)}`,
      <TargetStatusChip key="todate" evaluation={toDate} />,
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
    ['Ampel Hochrechnung', <TargetStatusChip key="proj" evaluation={proj} />],
  ]
  return (
    <Box>
      <Typography
        variant="subtitle1"
        component="p"
        data-testid="month-view-title"
        sx={{ fontWeight: 600, mb: 1 }}
      >
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
          </TableBody>
        </Table>
      </Box>
    </Box>
  )
}
