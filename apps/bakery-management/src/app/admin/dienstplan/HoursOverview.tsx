'use client'
import React from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Drawer,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  Close as CloseIcon,
  ChevronRight as OpenIcon,
  WarningAmber as WarningIcon,
} from '@mui/icons-material'
import {
  AREA_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  formatCents,
  formatDateDe,
  formatDays,
  formatMinutes,
  formatWage,
  groupByArea,
  minijobText,
  monthBasisText,
  payFormula,
  payText,
  totalPayText,
  totalWageCostText,
  wageCostFormula,
  wageCostText,
  type Employee,
  type HoursOverview,
  type HoursOverviewRow,
  type MinijobCheck,
  type MonthHours,
  type PeriodHours,
  type PlannedHours,
} from '../../../lib/dienstplanApi'
import {
  MONTH_NAMES,
  formatMonthTitle,
  hoursTexts,
  isoWeekNumber,
} from '../../../lib/dienstplanCalendar'
import { TOUCH_MEDIA } from '../../../lib/muiTheme'
import {
  ErrorState,
  KeyFigures,
  LoadingState,
  PageSection,
  type KeyFigure,
} from '../../../components/layout'
import { ColorDot } from './mitarbeiter/EmployeeDialog'
import { profileHref } from './mitarbeiter/MitarbeiterClient'
import { AreaGroupRow, stickyName } from './calendarParts'
import { HowItWorks, InfoButton } from './HoursInfo'
import type {
  HoursInfoContext,
  HoursInfoKey,
} from '../../../lib/dienstplanInfo'

/** Namensspalte der Übersicht: breiter als im Raster - hier ist Platz. */
const OVERVIEW_NAME_WIDTH = { xs: 140, sm: 200 } as const

/**
 * Stunden und Überstunden unter dem Kalender (Woche und Monat). Bezahlt wird
 * der **Monat** (vorläufig 11/2026): im laufenden Monat Plan bis heute gegen
 * Soll bis heute, Minusstunden einer Woche gleichen Überstunden einer
 * anderen im selben Monat aus; die Woche steht nur als Richtwert daneben.
 * Dazu die geschätzten Lohnkosten (Plan × Stundenlohn) und die
 * Minijob-Grenze. Gerechnet hat die API (`hoursOverview`/`monthHours` in
 * `vacation.core.js`, `GET /api/dienstplan/hours`) - hier nur Text.
 */

type PeriodKey = 'week' | 'month'

/** Zustand der Stundenübersicht (lädt neben dem Kalender, blockiert ihn nie). */
export type OverviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; value: HoursOverview }

/** „KW 46“ bzw. „November 2026“. */
export function periodLabel(
  overview: HoursOverview,
  key: PeriodKey
): string | null {
  if (key === 'week') {
    const week = overview.periods.week
    return week ? `KW ${isoWeekNumber(week.from)}` : null
  }
  return formatMonthTitle(overview.periods.month.from)
}

/**
 * Reicht die Woche in zwei Monate, sagt ein Satz, welcher Monat daneben
 * steht (der ihres Donnerstags, wie die Kalenderwoche).
 */
function spanningNote(overview: HoursOverview): string {
  const week = overview.periods.week
  if (!week || week.from.slice(0, 7) === week.to.slice(0, 7)) return ''
  return ` Die ${periodLabel(
    overview,
    'week'
  )} reicht in zwei Monate; daneben steht der Monat ihres Donnerstags (${formatMonthTitle(
    overview.periods.month.from
  )}).`
}

/** „09.11. – 15.11.2026“ */
function rangeText(range: { from: string; to: string }): string {
  return `${formatDateDe(range.from).slice(0, 6)} – ${formatDateDe(range.to)}`
}

/** Was die Erklärtexte aus der Antwort brauchen (Minijob-Grenze, Jahr). */
function infoContext(overview: HoursOverview): HoursInfoContext {
  return {
    minijobLimitCents: overview.totals.month.minijob.limitCents,
    year: overview.periods.month.from.slice(0, 4),
  }
}

/** Bezeichnung mit (i)-Knopf zur Regel dahinter. */
function withInfo(
  label: string,
  info: HoursInfoKey,
  context?: HoursInfoContext
): React.ReactNode {
  return (
    <>
      {label}
      <InfoButton info={info} context={context} />
    </>
  )
}

/** „November“ (das Jahr steht im Kopf). */
function monthName(overview: HoursOverview): string {
  return MONTH_NAMES[Number(overview.periods.month.from.slice(5, 7)) - 1]
}

function targetHint(
  targetMinutes: number | null,
  noTargetCount: number
): string {
  return targetMinutes === null
    ? 'Soll offen'
    : `Soll ${formatMinutes(targetMinutes)}${
        noTargetCount > 0 ? ` (ohne ${noTargetCount} offen)` : ''
      }`
}

function openWages(count: number): string | null {
  return count > 0 ? `${count} × Stundenlohn offen` : null
}

/**
 * Kennzahlen des Monats - die Zahl, die bezahlt wird: Plan (bis heute),
 * Überstunden netto, Lohnkosten und im laufenden Monat der ganze Monat.
 */
function monthFigures(overview: HoursOverview): KeyFigure[] {
  const t = overview.totals.month
  const name = monthName(overview)
  const current = t.phase === 'current'
  const future = t.phase === 'future'
  const basis = current ? ' bis heute' : ''
  const figures: KeyFigure[] = [
    {
      label: withInfo(`Plan ${name}${basis}`, 'bisHeute'),
      value: formatMinutes(t.plannedMinutes),
      hint: targetHint(t.targetMinutes, t.noTargetCount),
      'data-testid': 'total-plan-month',
    },
    {
      label: withInfo(`Überstunden ${name}${basis}`, 'verrechnung'),
      value: future ? 'noch keine' : totalPayText(t),
      hint: future
        ? 'Monat noch nicht begonnen'
        : [
            'geschätzt, netto im Monat',
            t.overtimeMinutes === null
              ? 'Überstunden offen'
              : formatMinutes(t.overtimeMinutes),
            openWages(t.missingWageCount),
          ]
            .filter(Boolean)
            .join(' · '),
      tone: t.missingWageCount > 0 ? 'warning' : 'default',
      'data-testid': 'total-pay-month',
    },
  ]
  const cost = future ? t.wageCost.full : t.wageCost.toDate
  if (cost) {
    figures.push({
      label: withInfo(
        `Lohnkosten ${name}${future ? ' geplant' : basis}`,
        'lohnkosten'
      ),
      value: totalWageCostText(cost),
      hint: ['geschätzt: Plan × Stundenlohn', openWages(cost.missingWageCount)]
        .filter(Boolean)
        .join(' · '),
      tone: cost.missingWageCount > 0 ? 'warning' : 'default',
      'data-testid': 'total-cost-month',
    })
  }
  if (current) {
    figures.push({
      label: 'Ganzer Monat geplant',
      value: formatMinutes(t.full.plannedMinutes),
      hint: [
        targetHint(t.full.targetMinutes, t.full.noTargetCount),
        `Lohnkosten ${totalWageCostText(t.wageCost.full)}`,
        openWages(t.wageCost.full.missingWageCount),
      ]
        .filter(Boolean)
        .join(' · '),
      'data-testid': 'total-full-month',
    })
  }
  return figures
}

/** Kennzahlen der Woche - nur ein Richtwert. */
function weekFigures(overview: HoursOverview): KeyFigure[] {
  const t = overview.totals.week
  if (!t) return []
  const label = periodLabel(overview, 'week') ?? ''
  return [
    {
      label: `Plan ${label}`,
      value: formatMinutes(t.plannedMinutes),
      hint: targetHint(t.targetMinutes, t.noTargetCount),
      'data-testid': 'total-plan-week',
    },
    {
      label: withInfo(`Überstunden ${label}`, 'woche'),
      value: totalPayText(t),
      hint: [
        'Richtwert',
        t.overtimeMinutes === null
          ? 'Überstunden offen'
          : formatMinutes(t.overtimeMinutes),
        openWages(t.missingWageCount),
      ]
        .filter(Boolean)
        .join(' · '),
      'data-testid': 'total-pay-week',
    },
  ]
}

/** Minijobs über der Grenze bzw. offen - als Hinweis über der Tabelle. */
function MinijobNotice({ overview }: { overview: HoursOverview }) {
  const t = overview.totals.month.minijob
  if (t.overCount === 0 && t.openCount === 0) return null
  const names = (status: MinijobCheck['status'][]) =>
    overview.rows
      .filter((r) => r.month.minijob && status.includes(r.month.minijob.status))
      .map(
        (r) =>
          overview.employees.find((e) => e.id === r.employeeId)?.displayName
      )
      .filter(Boolean)
      .join(', ')
  const limit =
    t.limitCents === null ? 'nicht hinterlegt' : formatCents(t.limitCents)
  return (
    <Alert
      severity={t.overCount > 0 ? 'warning' : 'info'}
      data-testid="minijob-notice"
      sx={{ mt: 1.5 }}
      action={<InfoButton info="minijob" context={infoContext(overview)} />}
    >
      {t.overCount > 0 && (
        <Box component="span" sx={{ display: 'block' }}>
          Über der Minijob-Grenze ({limit} im Monat, geplante Lohnkosten des
          ganzen Monats): <strong>{names(['over'])}</strong>.
        </Box>
      )}
      {t.openCount > 0 && (
        <Box component="span" sx={{ display: 'block' }}>
          Minijob-Grenze nicht prüfbar (Stundenlohn oder Grenze offen):{' '}
          {names(['no-wage', 'no-limit'])}.
        </Box>
      )}
    </Alert>
  )
}

function FigureGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Box>
      <Typography
        variant="overline"
        color="text.secondary"
        component="h3"
        sx={{ display: 'block', lineHeight: 1.6, mb: 0.5 }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  )
}

export function HoursOverviewSection({
  state,
  onRetry,
  onOpen,
}: {
  state: OverviewState
  onRetry: () => void
  onOpen: (employeeId: number) => void
}) {
  const overview = state.status === 'ok' ? state.value : null
  return (
    <PageSection
      title="Stunden und Überstunden"
      description={`Nach Plan (Schichten) - Ist-Stunden gibt es noch nicht. Bezahlt wird der Monat: im laufenden Monat Plan bis heute gegen Soll bis heute, Minusstunden einer Woche gleichen Überstunden einer anderen im selben Monat aus. Die Woche ist nur ein Richtwert. Bezahlung und Lohnkosten geschätzt (× Stundenlohn), ohne Zuschläge. Person antippen: Details.${
        overview ? spanningNote(overview) : ''
      }`}
      disablePadding={overview !== null && overview.employees.length > 0}
      data-testid="hours-overview"
    >
      {state.status === 'loading' ? (
        <LoadingState label="Stunden werden geladen …" />
      ) : state.status === 'error' ? (
        <ErrorState message={state.message} onRetry={onRetry} />
      ) : overview && overview.employees.length === 0 ? (
        <Typography color="text.secondary">
          Keine Mitarbeiter in diesem Bereich.
        </Typography>
      ) : overview ? (
        <>
          <Box
            sx={{ px: { xs: 2, md: 3 }, pb: 2, display: 'grid', gap: 2 }}
            data-testid="hours-totals"
          >
            <FigureGroup
              title={`${periodLabel(overview, 'month')} · ${monthBasisText(
                overview.totals.month
              )} · wird bezahlt`}
            >
              <KeyFigures
                variant="plain"
                dense
                items={monthFigures(overview)}
                aria-label="Summen des Monats"
              />
              <MinijobNotice overview={overview} />
            </FigureGroup>
            {overview.totals.week && (
              <FigureGroup
                title={`${periodLabel(overview, 'week')} · nur Richtwert`}
              >
                <KeyFigures
                  variant="plain"
                  dense
                  columns={4}
                  items={weekFigures(overview)}
                  aria-label="Summen der Woche (Richtwert)"
                />
              </FigureGroup>
            )}
            <HowItWorks context={infoContext(overview)} />
          </Box>
          <OverviewTable overview={overview} onOpen={onOpen} />
        </>
      ) : null}
    </PageSection>
  )
}

function OverviewTable({
  overview,
  onOpen,
}: {
  overview: HoursOverview
  onOpen: (employeeId: number) => void
}) {
  const hasWeek = overview.periods.week !== null
  const rows = new Map(overview.rows.map((r) => [r.employeeId, r]))
  const groups = groupByArea(overview.employees)
  const columns = hasWeek ? 5 : 4
  const t = overview.totals.month
  return (
    <TableContainer
      sx={{ overflowX: 'auto', borderTop: 1, borderColor: 'divider' }}
    >
      <Table
        size="small"
        aria-label="Stunden und Überstunden je Person"
        sx={{
          tableLayout: 'fixed',
          minWidth: {
            xs: OVERVIEW_NAME_WIDTH.xs + 88 + (columns - 2) * 150,
            sm: hasWeek ? 760 : 620,
          },
          '& td, & th': { verticalAlign: 'top' },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell
              sx={(theme) => ({
                ...stickyName(theme),
                zIndex: 3,
                width: OVERVIEW_NAME_WIDTH,
              })}
            >
              Mitarbeiter
            </TableCell>
            <TableCell align="right" sx={{ width: { xs: 88, md: 110 } }}>
              Stundenlohn
            </TableCell>
            <HeadCell
              title={periodLabel(overview, 'month') ?? ''}
              caption={
                t.phase === 'future'
                  ? 'Plan − Soll, geplant'
                  : `Plan − Soll ${monthBasisText(t)}, Überstunden`
              }
            />
            {hasWeek && (
              <HeadCell
                title={periodLabel(overview, 'week') ?? ''}
                caption="Plan − Soll, Richtwert"
              />
            )}
            <HeadCell
              title="Lohnkosten"
              caption={`${
                t.phase === 'future' ? 'geplant' : monthBasisText(t)
              }, Plan × Lohn`}
            />
          </TableRow>
        </TableHead>
        <TableBody>
          {groups.map((group) => (
            <React.Fragment key={group.area}>
              <AreaGroupRow
                label={group.label}
                count={group.employees.length}
                colSpan={columns}
              />
              {group.employees.map((employee) => {
                const row = rows.get(employee.id)
                if (!row) return null
                return (
                  <OverviewRow
                    key={employee.id}
                    employee={employee}
                    row={row}
                    hasWeek={hasWeek}
                    onOpen={onOpen}
                  />
                )
              })}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function HeadCell({ title, caption }: { title: string; caption: string }) {
  return (
    <TableCell align="right">
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {caption}
      </Typography>
    </TableCell>
  )
}

function OverviewRow({
  employee,
  row,
  hasWeek,
  onOpen,
}: {
  employee: Employee
  row: HoursOverviewRow
  hasWeek: boolean
  onOpen: (employeeId: number) => void
}) {
  return (
    <TableRow hover data-testid={`overview-${employee.id}`}>
      <TableCell component="th" scope="row" sx={stickyName}>
        <ButtonBase
          onClick={() => onOpen(employee.id)}
          aria-label={`Stunden von ${employee.displayName}: Details`}
          data-testid={`hours-open-${employee.id}`}
          sx={{
            width: '100%',
            justifyContent: 'flex-start',
            gap: 1,
            borderRadius: 1,
            textAlign: 'left',
            typography: 'body2',
            fontWeight: 600,
            minHeight: 32,
            [TOUCH_MEDIA]: { minHeight: 44 },
            '&:hover, &:focus-visible': { color: 'primary.main' },
          }}
        >
          <ColorDot color={employee.color} />
          <Box
            component="span"
            sx={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {employee.displayName}
          </Box>
          <OpenIcon fontSize="small" aria-hidden sx={{ opacity: 0.6 }} />
        </ButtonBase>
      </TableCell>
      <TableCell
        align="right"
        data-testid={`overview-wage-${employee.id}`}
        sx={{
          fontVariantNumeric: 'tabular-nums',
          color: row.hourlyWageCents === null ? 'text.secondary' : undefined,
        }}
      >
        {formatWage(row.hourlyWageCents)}
      </TableCell>
      <PeriodCell
        employeeId={employee.id}
        periodKey="month"
        hours={row.month}
        fullMonth={row.month.phase === 'current' ? row.month.full : null}
      />
      {hasWeek && row.week && (
        <PeriodCell
          employeeId={employee.id}
          periodKey="week"
          hours={row.week}
        />
      )}
      <CostCell employeeId={employee.id} month={row.month} />
    </TableRow>
  )
}

/**
 * Ein Zeitraum einer Person in einer Zelle: die Differenz groß, darunter
 * Plan / Soll und - bei Überstunden - die geschätzte Bezahlung
 * („≈ 69,50 €“) oder „Stundenlohn offen“; im laufenden Monat zusätzlich der
 * ganze Monat.
 */
function PeriodCell({
  employeeId,
  periodKey,
  hours,
  fullMonth,
}: {
  employeeId: number
  periodKey: PeriodKey
  hours: PeriodHours
  fullMonth?: PlannedHours | null
}) {
  const t = hoursTexts(hours)
  const pay = hours.pay
  const showPay =
    pay.status === 'ok' || pay.status === 'no-wage' || pay.status === 'future'
  return (
    <TableCell
      align="right"
      data-testid={`overview-${periodKey}-${employeeId}`}
      sx={{ fontVariantNumeric: 'tabular-nums' }}
    >
      <Typography
        variant="body2"
        data-testid={`overview-diff-${periodKey}-${employeeId}`}
        data-sign={t.sign ?? undefined}
        sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        {t.diff ?? 'Soll offen'}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ whiteSpace: 'nowrap' }}
      >
        {t.plan}
        {hours.targetMinutes !== null ? ` / ${t.target}` : ''}
      </Typography>
      {hours.targetMinutes !== null && hours.creditedDays > 0 && (
        <Typography variant="caption" color="text.secondary" display="block">
          ohne {formatDays(hours.creditedDays)}{' '}
          {hours.creditedDays === 1 ? 'Tag' : 'Tage'} Urlaub/abw.
        </Typography>
      )}
      {showPay && (
        <Typography
          variant="caption"
          display="block"
          data-testid={`overview-pay-${periodKey}-${employeeId}`}
          data-status={pay.status}
          title={payFormula(pay) ?? undefined}
          color={pay.status === 'future' ? 'text.secondary' : undefined}
          sx={{
            fontWeight: pay.status === 'future' ? 400 : 600,
            whiteSpace: 'nowrap',
          }}
        >
          {payText(pay)}
        </Typography>
      )}
      {fullMonth && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          data-testid={`overview-full-${employeeId}`}
          sx={{ whiteSpace: 'nowrap' }}
        >
          ganzer Monat {formatMinutes(fullMonth.plannedMinutes)}
          {fullMonth.targetMinutes !== null
            ? ` / ${formatMinutes(fullMonth.targetMinutes)}`
            : ''}
        </Typography>
      )}
    </TableCell>
  )
}

/**
 * Lohnkosten einer Person im Monat (Plan × Stundenlohn): bis heute bzw. der
 * ganze Monat, im laufenden Monat darunter der ganze Monat, bei Minijob die
 * Grenze.
 */
function CostCell({
  employeeId,
  month,
}: {
  employeeId: number
  month: MonthHours
}) {
  const main = month.wageCost.toDate ?? month.wageCost.full
  const minijob = month.minijob
  return (
    <TableCell
      align="right"
      data-testid={`overview-cost-${employeeId}`}
      sx={{ fontVariantNumeric: 'tabular-nums' }}
    >
      <Typography
        variant="body2"
        color={main.status === 'no-wage' ? 'text.secondary' : undefined}
        sx={{ fontWeight: main.status === 'no-wage' ? 400 : 600 }}
      >
        {wageCostText(main)}
      </Typography>
      {month.phase === 'current' && (
        <Typography variant="caption" color="text.secondary" display="block">
          ganzer Monat {wageCostText(month.wageCost.full)}
        </Typography>
      )}
      {minijob && <MinijobLine check={minijob} employeeId={employeeId} />}
    </TableCell>
  )
}

function MinijobLine({
  check,
  employeeId,
  year,
}: {
  check: MinijobCheck
  employeeId: number
  year?: string
}) {
  const over = check.status === 'over'
  return (
    <Typography
      variant="caption"
      display="flex"
      data-testid={`overview-minijob-${employeeId}`}
      data-status={check.status}
      color={over ? 'warning.main' : 'text.secondary'}
      sx={{
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        gap: 0.5,
        fontWeight: over ? 600 : 400,
      }}
    >
      {over && <WarningIcon aria-hidden sx={{ fontSize: 14, mt: '2px' }} />}
      <span>{minijobText(check, year)}</span>
    </Typography>
  )
}

/**
 * Details einer Person: Stundenlohn, der Monat (bezahlt: bis heute, netto)
 * mit Lohnkosten und Minijob-Grenze, der ganze Monat und die Woche als
 * Richtwert. Den Stundenlohn pflegt der Inhaber im Profil.
 */
export function HoursDrawer({
  overview,
  employeeId,
  onClose,
}: {
  overview: HoursOverview | null
  employeeId: number | null
  onClose: () => void
}) {
  const theme = useTheme()
  const narrow = useMediaQuery(theme.breakpoints.down('sm'))
  const employee = overview?.employees.find((e) => e.id === employeeId) ?? null
  const row = overview?.rows.find((r) => r.employeeId === employeeId) ?? null
  const open = employee !== null && row !== null
  return (
    <Drawer
      anchor={narrow ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: narrow ? '100%' : 440,
          maxHeight: narrow ? '90vh' : undefined,
        },
      }}
    >
      {open && overview && (
        <Box
          role="region"
          aria-label={`Stunden von ${employee.displayName}`}
          data-testid="hours-drawer"
          sx={{ p: { xs: 2, sm: 3 }, display: 'grid', gap: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="h6"
                component="h2"
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <ColorDot color={employee.color} size={14} />
                {employee.displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {[
                  AREA_LABELS[employee.area],
                  employee.employmentType
                    ? EMPLOYMENT_TYPE_LABELS[employee.employmentType]
                    : 'Beschäftigungsart offen',
                  employee.weeklyHours !== null
                    ? `${formatDays(employee.weeklyHours)} Std./Woche`
                    : 'Wochenstunden offen',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Box>
            <IconButton aria-label="Schließen" onClick={onClose} edge="end">
              <CloseIcon />
            </IconButton>
          </Box>

          <DrawerList>
            <DrawerRow
              label="Stundenlohn (brutto)"
              value={formatWage(row.hourlyWageCents)}
              testId="drawer-wage"
            />
          </DrawerList>

          <MonthDetails
            month={row.month}
            title={`Monat ${periodLabel(overview, 'month')}`}
          />

          {overview.periods.week && row.week && (
            <Box data-testid="drawer-week">
              <Typography variant="subtitle2" component="h3">
                Woche {periodLabel(overview, 'week')} · nur Richtwert
                <InfoButton info="woche" />
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {rangeText(overview.periods.week)}
              </Typography>
              <PeriodDetails hours={row.week} />
            </Box>
          )}

          <Typography variant="caption" color="text.secondary">
            Geschätzt nach Plan: noch keine Ist-Stunden, ohne Zuschläge - keine
            Lohnabrechnung. Bezahlt wird der Monat: Minusstunden einer Woche
            gleichen Überstunden einer anderen im selben Monat aus; die Woche
            ist nur ein Richtwert. Kein Übertrag zwischen Monaten.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              component={Link}
              href={profileHref(employee.id)}
              variant="outlined"
            >
              {row.hourlyWageCents === null
                ? 'Stundenlohn im Profil eintragen'
                : 'Zum Profil'}
            </Button>
          </Box>
        </Box>
      )}
    </Drawer>
  )
}

/**
 * Der Monat einer Person in Details: der gewertete Zeitraum (bis heute bzw.
 * ganzer Monat) mit Überstunden, der ganze Monat, Lohnkosten, Minijob.
 */
export function MonthDetails({
  month,
  title,
}: {
  month: MonthHours
  title: string
}) {
  const current = month.phase === 'current'
  return (
    <Box data-testid="drawer-month">
      <Typography variant="subtitle2" component="h3">
        {title} · {monthBasisText(month)}
        <InfoButton info="verrechnung" />
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {rangeText(month)}
        {month.phase === 'future'
          ? ' - noch keine Überstunden'
          : ' - wird bezahlt (netto im Monat)'}
      </Typography>
      <PeriodDetails hours={month} />
      {current && (
        <>
          <Typography
            variant="caption"
            color="text.secondary"
            component="h4"
            sx={{ display: 'block', mt: 1.5, fontWeight: 600 }}
          >
            Ganzer Monat (geplant) · {rangeText(month.full)}
          </Typography>
          <DrawerList>
            <DrawerRow
              label="Plan / Soll"
              value={`${hoursTexts(month.full).plan} / ${
                hoursTexts(month.full).target
              }`}
              testId="drawer-full"
            />
            <DrawerRow
              label="Differenz (Plan − Soll)"
              value={hoursTexts(month.full).diff ?? 'offen'}
            />
          </DrawerList>
        </>
      )}
      <Typography
        variant="caption"
        color="text.secondary"
        component="h4"
        sx={{ display: 'block', mt: 1.5, fontWeight: 600 }}
      >
        Lohnkosten (geschätzt, Plan × Stundenlohn)
        <InfoButton info="lohnkosten" />
      </Typography>
      <DrawerList>
        {month.wageCost.toDate && current && (
          <DrawerRow
            label={monthBasisText(month)}
            hint={wageCostFormula(month.wageCost.toDate) ?? undefined}
            value={wageCostText(month.wageCost.toDate)}
            testId="drawer-cost"
          />
        )}
        <DrawerRow
          label={current ? 'ganzer Monat' : monthBasisText(month)}
          hint={wageCostFormula(month.wageCost.full) ?? undefined}
          value={wageCostText(month.wageCost.full)}
          testId={current ? 'drawer-cost-full' : 'drawer-cost'}
        />
        {month.minijob && (
          <DrawerRow
            label={withInfo('Minijob-Grenze', 'minijob', {
              minijobLimitCents: month.minijob.limitCents,
              year: month.from.slice(0, 4),
            })}
            hint="geplante Lohnkosten des ganzen Monats"
            value={minijobText(month.minijob, month.from.slice(0, 4))}
            tone={month.minijob.status === 'over' ? 'warning' : undefined}
            testId="drawer-minijob"
          />
        )}
      </DrawerList>
    </Box>
  )
}

function PeriodDetails({ hours }: { hours: PeriodHours }) {
  const t = hoursTexts(hours)
  const pay = hours.pay
  return (
    <DrawerList>
      <DrawerRow
        label="Plan"
        hint={`${hours.shiftCount} ${
          hours.shiftCount === 1 ? 'Schicht' : 'Schichten'
        }`}
        value={t.plan}
      />
      <DrawerRow
        label="Soll"
        hint={
          hours.targetMinutes === null
            ? 'keine Wochenstunden erfasst'
            : hours.creditedDays > 0
            ? `ohne ${formatDays(hours.creditedDays)} ${
                hours.creditedDays === 1 ? 'Tag' : 'Tage'
              } Urlaub/abwesend`
            : `${formatDays(hours.targetDays)} Öffnungstage`
        }
        value={t.target}
      />
      <DrawerRow label="Differenz (Plan − Soll)" value={t.diff ?? 'offen'} />
      <DrawerRow
        label={withInfo('Überstunden-Bezahlung (geschätzt)', 'schaetzung')}
        hint={
          payFormula(pay) ??
          (pay.status === 'no-wage' && pay.overtimeMinutes !== null
            ? `${formatMinutes(
                pay.overtimeMinutes
              )} Überstunden, Stundenlohn fehlt`
            : undefined)
        }
        value={payText(pay)}
        testId="drawer-pay"
      />
    </DrawerList>
  )
}

function DrawerList({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        mt: 0.5,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        columnGap: 2,
        '& > dt, & > dd': { py: 0.75, borderBottom: 1, borderColor: 'divider' },
        '& > dt:nth-last-of-type(1), & > dd:nth-last-of-type(1)': {
          borderBottom: 0,
        },
      }}
    >
      {children}
    </Box>
  )
}

function DrawerRow({
  label,
  value,
  hint,
  testId,
  tone,
}: {
  label: React.ReactNode
  value: string
  hint?: string
  testId?: string
  tone?: 'warning'
}) {
  return (
    <>
      <Box component="dt" sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        {hint && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block' }}
          >
            {hint}
          </Typography>
        )}
      </Box>
      <Typography
        component="dd"
        variant="body2"
        fontWeight={600}
        data-testid={testId}
        color={tone === 'warning' ? 'warning.main' : undefined}
        sx={{
          m: 0,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          maxWidth: 220,
        }}
      >
        {value}
      </Typography>
    </>
  )
}
