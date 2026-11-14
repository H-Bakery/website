'use client'
import React from 'react'
import Link from 'next/link'
import {
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
} from '@mui/icons-material'
import {
  AREA_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  formatDateDe,
  formatDays,
  formatMinutes,
  formatWage,
  groupByArea,
  payFormula,
  payText,
  totalPayText,
  type Employee,
  type HoursOverview,
  type HoursOverviewRow,
  type HoursTotals,
  type PeriodHours,
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

/** Namensspalte der Übersicht: breiter als im Raster - hier ist Platz. */
const OVERVIEW_NAME_WIDTH = { xs: 140, sm: 220 } as const

/**
 * Stunden und Überstunden unter dem Kalender (Woche und Monat): je Person
 * Plan, Soll und Differenz der Woche und des Monats und die geschätzte
 * Überstundenbezahlung, darüber die Summen, je Person Details in einer
 * Schublade (`HoursDrawer`). Gerechnet hat die API (`hoursOverview` in
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

function periodKeys(overview: HoursOverview): PeriodKey[] {
  return overview.periods.week ? ['week', 'month'] : ['month']
}

/** „09.11. – 15.11.2026“ */
function rangeText(range: { from: string; to: string }): string {
  return `${formatDateDe(range.from).slice(0, 6)} – ${formatDateDe(range.to)}`
}

/** Kurz für die Kennzahlen: „KW 46“ bzw. „November“ (das Jahr steht im Kopf). */
function shortLabel(overview: HoursOverview, key: PeriodKey): string {
  if (key === 'week') return periodLabel(overview, 'week') ?? ''
  return MONTH_NAMES[Number(overview.periods.month.from.slice(5, 7)) - 1]
}

function totalFigures(overview: HoursOverview): KeyFigure[] {
  return periodKeys(overview).flatMap((key): KeyFigure[] => {
    const t = overview.totals[key] as HoursTotals
    const label = shortLabel(overview, key)
    return [
      {
        label: `Plan ${label}`,
        value: formatMinutes(t.plannedMinutes),
        hint:
          t.targetMinutes === null
            ? 'Soll offen'
            : `Soll ${formatMinutes(t.targetMinutes)}${
                t.noTargetCount > 0 ? ` (ohne ${t.noTargetCount} offen)` : ''
              }`,
        'data-testid': `total-plan-${key}`,
      },
      {
        label: `Überstunden ${label}`,
        value: totalPayText(t),
        hint: [
          'geschätzt',
          t.overtimeMinutes === null
            ? 'Überstunden offen'
            : formatMinutes(t.overtimeMinutes),
          t.missingWageCount > 0
            ? `${t.missingWageCount} × Stundenlohn offen`
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
        tone: t.missingWageCount > 0 ? 'warning' : 'default',
        'data-testid': `total-pay-${key}`,
      },
    ]
  })
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
      description={`Nach Plan (Schichten) - Ist-Stunden gibt es noch nicht. Überstunden = Plan über Soll; Bezahlung geschätzt = Überstunden × Stundenlohn, ohne Zuschläge. Person antippen: Details.${
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
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
            <KeyFigures
              variant="plain"
              dense
              items={totalFigures(overview)}
              aria-label="Summen der Stunden"
              data-testid="hours-totals"
            />
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
  const keys = periodKeys(overview)
  const rows = new Map(overview.rows.map((r) => [r.employeeId, r]))
  const groups = groupByArea(overview.employees)
  const columns = 2 + keys.length
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
            xs: OVERVIEW_NAME_WIDTH.xs + 88 + keys.length * 150,
            sm: 600,
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
            {keys.map((key) => (
              <TableCell key={key} align="right">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {periodLabel(overview, key)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Plan − Soll, Überstunden
                </Typography>
              </TableCell>
            ))}
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
                    keys={keys}
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

function OverviewRow({
  employee,
  row,
  keys,
  onOpen,
}: {
  employee: Employee
  row: HoursOverviewRow
  keys: PeriodKey[]
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
      {keys.map((key) => (
        <PeriodCell
          key={key}
          employeeId={employee.id}
          periodKey={key}
          hours={row[key] as PeriodHours}
        />
      ))}
    </TableRow>
  )
}

/**
 * Ein Zeitraum einer Person in einer Zelle: die Differenz groß, darunter
 * Plan / Soll und - bei Überstunden - die geschätzte Bezahlung
 * („≈ 69,50 €“) oder „Stundenlohn offen“.
 */
function PeriodCell({
  employeeId,
  periodKey,
  hours,
}: {
  employeeId: number
  periodKey: PeriodKey
  hours: PeriodHours
}) {
  const t = hoursTexts(hours)
  const pay = hours.pay
  const showPay = pay.status === 'ok' || pay.status === 'no-wage'
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
          sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          {payText(pay)}
        </Typography>
      )}
    </TableCell>
  )
}

/**
 * Details einer Person: Stundenlohn, Woche und Monat mit Plan, Soll,
 * Differenz, Überstunden und der geschätzten Bezahlung samt Rechenweg. Den
 * Stundenlohn pflegt der Inhaber im Profil.
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
          width: narrow ? '100%' : 420,
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
                    : null,
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

          {periodKeys(overview).map((key) => {
            const h = row[key] as PeriodHours
            const range =
              key === 'week' ? overview.periods.week : overview.periods.month
            return (
              <Box key={key} data-testid={`drawer-${key}`}>
                <Typography variant="subtitle2" component="h3">
                  {key === 'week' ? 'Woche' : 'Monat'}{' '}
                  {periodLabel(overview, key)}
                </Typography>
                {range && (
                  <Typography variant="caption" color="text.secondary">
                    {rangeText(range)}
                  </Typography>
                )}
                <PeriodDetails hours={h} />
              </Box>
            )
          })}

          <Typography variant="caption" color="text.secondary">
            Geschätzt nach Plan: noch keine Ist-Stunden, ohne Zuschläge und ohne
            Freizeitausgleich - keine Lohnabrechnung. Minusstunden der Woche
            oder des Monats verrechnet die Schätzung nicht.
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
        label="Überstunden-Bezahlung (geschätzt)"
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
}: {
  label: string
  value: string
  hint?: string
  testId?: string
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
        sx={{ m: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </>
  )
}
