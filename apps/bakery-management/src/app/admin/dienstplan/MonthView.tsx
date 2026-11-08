'use client'
import React from 'react'
import {
  Box,
  ButtonBase,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  ABSENCE_STATUS_LABELS,
  ABSENCE_TYPE_LABELS,
  formatDateWithWeekday,
  groupByArea,
  type Calendar,
  type CalendarDay,
  type Employee,
} from '../../../lib/dienstplanApi'
import {
  WEEKDAY_LETTERS,
  cellKey,
  closedDayLabel,
  entriesByCell,
  formatMonthTitle,
  monthDates,
  type AreaFilter,
  type CellEntries,
} from '../../../lib/dienstplanCalendar'
import { formatDateShort, isoWeekday } from '../../../lib/backzettelFormat'
import { TOUCH_MEDIA } from '../../../lib/muiTheme'
import {
  ABSENCE_COLORS,
  ABSENCE_LETTERS,
  AbsenceLegend,
  AreaGroupRow,
  EmployeeNameCell,
  NAME_COLUMN_WIDTH,
  stickyName,
} from './calendarParts'

/** Nur für Screenreader (wie `visuallyHidden` aus MUI). */
const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} as const

/** Breite einer Tagesspalte (px) am Schreibtisch. */
const DAY_WIDTH = 32
/** Polster einer Tageszelle (px, je Seite) und ihr Rand rechts. */
const DAY_CELL_PADDING = 2
const DAY_CELL_BORDER = 1
/**
 * Breite einer Tagesspalte auf Touch: die antippbare Fläche selbst (nicht
 * nur die Spalte) ist mindestens 44 px breit - Polster und Rand kommen dazu.
 */
const DAY_WIDTH_TOUCH = 44 + 2 * DAY_CELL_PADDING + DAY_CELL_BORDER
/**
 * Mindestbreite der Tabelle auf Touch. Gerechnet mit der breitesten
 * Namensspalte (ab `sm`): sonst bleibt den Tagen auf dem Tablet weniger
 * als 44 px; am Handy wird die Tabelle dadurch nur etwas breiter.
 */
function touchTableWidth(days: number): number {
  return (
    Math.max(NAME_COLUMN_WIDTH.xs, NAME_COLUMN_WIDTH.sm) +
    days * DAY_WIDTH_TOUCH
  )
}

/**
 * Monatsansicht (Gantt-artig): Zeilen = Mitarbeitende nach Bereich, Spalten
 * = Tage des Monats. Eine Zelle zeigt die Abwesenheit als Fläche mit Kürzel
 * (geplant gestrichelt) und Schichten als Punkt in der Farbe der Person.
 * Ruhetag und Feiertage sind hinterlegt. Eine Abwesenheit über mehrere
 * Tage steht als durchgehender Balken. Eine Zelle antippen öffnet dieselben
 * Dialoge wie in der Woche (`onCell`: anlegen oder bearbeiten); das Datum
 * im Kopf antippen öffnet die Woche dieses Tages.
 */
export default function MonthView({
  calendar,
  monthStart,
  area,
  loading,
  onCell,
  onOpenWeek,
}: {
  calendar: Calendar
  monthStart: string
  area: AreaFilter
  loading: boolean
  onCell: (
    anchor: HTMLElement,
    employee: Employee,
    date: string,
    entries: CellEntries | undefined
  ) => void
  onOpenWeek: (date: string) => void
}) {
  const dates = monthDates(monthStart)
  const days = new Map(calendar.days.map((d) => [d.date, d]))
  const cells = entriesByCell(calendar, dates)
  const shown =
    area === 'alle'
      ? calendar.employees
      : calendar.employees.filter((e) => e.area === area)
  const groups = groupByArea(shown)
  const columns = dates.length + 1

  return (
    <Box sx={{ position: 'relative' }}>
      {loading && (
        <LinearProgress
          aria-label="Monat wird geladen"
          sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4 }}
        />
      )}
      <TableContainer
        sx={{
          overflowX: 'auto',
          borderTop: 1,
          borderColor: 'divider',
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Table
          size="small"
          aria-label={`Dienstplan ${formatMonthTitle(monthStart)}`}
          sx={{
            tableLayout: 'fixed',
            minWidth: {
              xs: NAME_COLUMN_WIDTH.xs + dates.length * DAY_WIDTH,
              sm: NAME_COLUMN_WIDTH.sm + dates.length * DAY_WIDTH,
            },
            [TOUCH_MEDIA]: { minWidth: touchTableWidth(dates.length) },
            '& td, & th': { borderRight: 1, borderColor: 'divider' },
            '& td:last-of-type, & th:last-of-type': { borderRight: 0 },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell
                sx={(theme) => ({
                  ...stickyName(theme),
                  zIndex: 3,
                  width: NAME_COLUMN_WIDTH,
                })}
              >
                Mitarbeiter
              </TableCell>
              {dates.map((date) => (
                <MonthDayHeader
                  key={date}
                  date={date}
                  day={days.get(date)}
                  today={date === calendar.today}
                  onOpenWeek={onOpenWeek}
                />
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ py: 1 }}
                  >
                    Keine Mitarbeiter in diesem Bereich.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <React.Fragment key={group.area}>
                  <AreaGroupRow
                    label={group.label}
                    count={group.employees.length}
                    colSpan={columns}
                  />
                  {group.employees.map((employee) => (
                    <TableRow
                      key={employee.id}
                      data-testid={`row-${employee.id}`}
                    >
                      <EmployeeNameCell employee={employee} />
                      {dates.map((date) => (
                        <MonthCell
                          key={date}
                          employee={employee}
                          date={date}
                          day={days.get(date)}
                          entries={cells.get(cellKey(employee.id, date))}
                          first={date === dates[0]}
                          last={date === dates[dates.length - 1]}
                          onCell={onCell}
                        />
                      ))}
                    </TableRow>
                  ))}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <AbsenceLegend letters />
      <MonthDayNotes dates={dates} days={days} />
    </Box>
  )
}

function MonthDayHeader({
  date,
  day,
  today,
  onOpenWeek,
}: {
  date: string
  day: CalendarDay | undefined
  today: boolean
  onOpenWeek: (date: string) => void
}) {
  const closedName = day ? closedDayLabel(day) : null
  const weekday = WEEKDAY_LETTERS[isoWeekday(date)]
  const note = closedName ?? day?.halfDayName ?? null
  return (
    <TableCell
      data-testid={`day-${date}`}
      title={note ?? undefined}
      align="center"
      sx={{
        p: 0,
        verticalAlign: 'top',
        bgcolor: day?.closed ? 'action.selected' : undefined,
        borderBottom: today ? 3 : 1,
        borderBottomColor: today ? 'primary.main' : 'divider',
      }}
    >
      <ButtonBase
        onClick={() => onOpenWeek(date)}
        aria-label={`${formatDateWithWeekday(date)}${
          note ? ` (${note})` : ''
        }: Woche öffnen`}
        sx={{
          width: '100%',
          py: 0.5,
          display: 'block',
          [TOUCH_MEDIA]: { minHeight: 44 },
          '&:hover, &:focus-visible': { bgcolor: 'action.hover' },
        }}
      >
        <Typography
          variant="caption"
          sx={{ display: 'block', fontWeight: 600 }}
          color={today ? 'primary' : undefined}
        >
          {Number(date.slice(8, 10))}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {weekday}
        </Typography>
        {note && (
          // Sichtbar nur ein Zeichen (die Spalte ist schmal): × geschlossen,
          // ½ halber Tag. Der Name steht im Tooltip (title), für
          // Screenreader ausgeschrieben und unter der Tabelle
          // (`MonthDayNotes`) - Touch kennt keinen Tooltip.
          <Typography variant="caption" display="block">
            <span aria-hidden>{closedName ? '×' : '½'}</span>
            <Box component="span" sx={visuallyHidden}>
              {closedName ?? `${note} (halber Tag)`}
            </Box>
          </Typography>
        )}
      </ButtonBase>
    </TableCell>
  )
}

/**
 * Unter der Tabelle ausgeschrieben, was die Köpfe nur als Zeichen zeigen:
 * Feiertage (×) und halbe Tage (½) des Monats mit Namen. Der Ruhetag steht
 * nicht einzeln da - er ist jede Woche derselbe.
 */
function MonthDayNotes({
  dates,
  days,
}: {
  dates: string[]
  days: Map<string, CalendarDay>
}) {
  const named: string[] = []
  for (const date of dates) {
    const day = days.get(date)
    if (!day) continue
    if (day.holidayName) {
      named.push(`${formatDateShort(date)} ${day.holidayName} (×)`)
    } else if (day.halfDayName) {
      named.push(`${formatDateShort(date)} ${day.halfDayName} (½, halber Tag)`)
    }
  }
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      component="p"
      data-testid="month-day-notes"
      sx={{ px: { xs: 2, md: 3 }, pb: 1.5, m: 0 }}
    >
      × = geschlossen (Ruhetag oder Feiertag) · ½ = zählt als halber Urlaubstag
      {named.length > 0 && <> · {named.join(' · ')}</>}
    </Typography>
  )
}

function MonthCell({
  employee,
  date,
  day,
  entries,
  first,
  last,
  onCell,
}: {
  employee: Employee
  date: string
  day: CalendarDay | undefined
  entries: CellEntries | undefined
  first: boolean
  last: boolean
  onCell: (
    anchor: HTMLElement,
    employee: Employee,
    date: string,
    entries: CellEntries | undefined
  ) => void
}) {
  const absence = entries?.absences[0] ?? null
  // Balken über mehrere Tage: zur Nachbarzelle hin ohne Rundung, Rand und
  // Polster, damit er durchgeht (am Monatsrand endet er sichtbar).
  const joinLeft = absence !== null && !first && absence.startDate < date
  const joinRight = absence !== null && !last && absence.endDate > date
  const shifts = entries?.shifts ?? []
  const color = absence ? ABSENCE_COLORS[absence.type] : null
  const planned = absence?.status === 'geplant'
  const parts = [
    ...(entries?.absences ?? []).map(
      (a) =>
        `${ABSENCE_TYPE_LABELS[a.type]}${a.halfDay ? ' (halber Tag)' : ''} (${
          ABSENCE_STATUS_LABELS[a.status]
        })`
    ),
    ...shifts.map((s) => `Schicht ${s.startTime}–${s.endTime}`),
  ]
  const closedName = day ? closedDayLabel(day) : null
  const label = `${employee.displayName}, ${formatDateWithWeekday(date)}: ${
    parts.length > 0 ? parts.join(', ') : closedName ?? 'nichts eingetragen'
  } - ${parts.length > 0 ? 'bearbeiten' : 'anlegen'}`
  return (
    <TableCell
      data-testid={`cell-${employee.id}-${date}`}
      sx={{
        p: `${DAY_CELL_PADDING}px`,
        pl: joinLeft ? 0 : undefined,
        pr: joinRight ? 0 : undefined,
        verticalAlign: 'middle',
        bgcolor: day?.closed ? 'action.hover' : undefined,
        // `!important` schlägt die Spaltenlinie der Tabelle (`& td`)
        borderRightWidth: joinRight ? '0 !important' : undefined,
      }}
    >
      <ButtonBase
        aria-label={label}
        title={parts.join(', ') || undefined}
        onClick={(event) =>
          onCell(event.currentTarget, employee, date, entries)
        }
        data-status={absence?.status}
        data-join={
          joinLeft && joinRight
            ? 'both'
            : joinLeft
            ? 'left'
            : joinRight
            ? 'right'
            : undefined
        }
        sx={{
          width: '100%',
          minHeight: 32,
          [TOUCH_MEDIA]: { minHeight: 44, minWidth: 44 },
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          borderRadius: 0.5,
          ...(joinLeft && {
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          }),
          ...(joinRight && {
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          }),
          typography: 'caption',
          fontWeight: 600,
          lineHeight: 1,
          border: absence ? 2 : 0,
          borderLeftWidth: joinLeft ? 0 : undefined,
          borderRightWidth: joinRight ? 0 : undefined,
          borderStyle: planned ? 'dashed' : 'solid',
          borderColor: color ? `${color}.main` : 'transparent',
          bgcolor: color && !planned ? `${color}.main` : 'transparent',
          color: color && !planned ? `${color}.contrastText` : 'text.primary',
          '&:hover, &:focus-visible': {
            outline: 2,
            outlineColor: 'primary.main',
          },
        }}
      >
        {absence && (
          <span>
            {ABSENCE_LETTERS[absence.type]}
            {absence.halfDay ? '½' : ''}
          </span>
        )}
        {shifts.length > 0 && (
          <Box
            component="span"
            aria-hidden
            data-testid={`shift-dot-${employee.id}-${date}`}
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: employee.color ?? 'text.primary',
              border: 1,
              borderColor: 'background.paper',
            }}
          />
        )}
      </ButtonBase>
    </TableCell>
  )
}
