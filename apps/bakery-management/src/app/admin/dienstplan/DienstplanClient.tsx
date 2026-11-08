'use client'
import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  CalendarMonth as CalendarIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Badge as StaffIcon,
} from '@mui/icons-material'
import {
  ABSENCE_STATUS_LABELS,
  ABSENCE_TYPE_LABELS,
  AREAS,
  AREA_LABELS,
  deleteAbsence,
  deleteShift,
  fetchCalendar,
  fetchShiftTemplates,
  formatAbsenceRange,
  formatDateWithWeekday,
  formatMinutes,
  groupByArea,
  type Absence,
  type AbsenceType,
  type Calendar,
  type CalendarDay,
  type DienstplanWarning,
  type Employee,
  type Shift,
  type ShiftTemplate,
} from '../../../lib/dienstplanApi'
import {
  addDays,
  formatDateShort,
  todayIso,
} from '../../../lib/backzettelFormat'
import {
  CALENDAR_VIEWS,
  CALENDAR_VIEW_LABELS,
  cellKey,
  closedDayLabel,
  dienstplanHref,
  entriesByCell,
  formatWeekTitle,
  mondayOf,
  parseAreaFilter,
  parseView,
  parseWeek,
  staffingText,
  weekDates,
  type AreaFilter,
  type CalendarView,
  type CellEntries,
} from '../../../lib/dienstplanCalendar'
import { ColorDot, messageOf } from './mitarbeiter/EmployeeDialog'
import { profileHref } from './mitarbeiter/MitarbeiterClient'
import AbsenceDialog from './AbsenceDialog'
import ShiftDialog from './ShiftDialog'

type DialogState =
  | { kind: 'shift'; employee: Employee; date: string; shift: Shift | null }
  | {
      kind: 'absence'
      employee: Employee
      date: string
      absence: Absence | null
    }
  | null

interface AddMenu {
  anchor: HTMLElement
  employee: Employee
  date: string
}

interface Notice {
  message: string
  warnings: DienstplanWarning[]
}

/** Farbe je Abwesenheitsart (Palette, damit Hell/Dunkel stimmen). */
const ABSENCE_COLORS: Record<AbsenceType, 'info' | 'success' | 'warning'> = {
  urlaub: 'info',
  frei: 'success',
  abwesend: 'warning',
}

/** Schichten nur im Verkauf und nur für aktive Mitarbeiter (die API prüft). */
function canHaveShifts(employee: Employee): boolean {
  return employee.area === 'verkauf' && employee.active
}

const AREA_FILTERS: AreaFilter[] = ['alle', ...AREAS]

const NAME_COLUMN_WIDTH = 170
const DAY_COLUMN_MIN_WIDTH = 128

/**
 * Kalender des Dienstplans (TASK-042, nur Inhaber mit persönlicher
 * Sitzung). Woche (Standard): Zeilen = Mitarbeitende nach Bereich (Verkauf
 * zuerst), Spalten Mo-So; Zellen zeigen Schichten mit Uhrzeit und
 * Abwesenheitsbalken (geplant gestrichelt). Ruhetag und Feiertage sind
 * hinterlegt und benannt, die Kopfzeile je Tag zeigt „Verkauf besetzt“.
 *
 * Alle Daten kommen aus `GET /api/dienstplan?from&to`; Feiertage, Ruhetag
 * und Besetzung rechnet der Browser nicht selbst. Woche, Ansicht und
 * Bereich stehen in der URL.
 */
export default function DienstplanClient({
  week: weekParam,
  view: viewParam,
  area: areaParam,
}: {
  week?: string
  view?: string
  area?: string
}) {
  const router = useRouter()
  const [week, setWeek] = React.useState<string>(
    () => parseWeek(weekParam) ?? mondayOf(todayIso())
  )
  const [view, setView] = React.useState<CalendarView>(() =>
    parseView(viewParam)
  )
  const [area, setArea] = React.useState<AreaFilter>(() =>
    parseAreaFilter(areaParam)
  )
  const [calendar, setCalendar] = React.useState<Calendar | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<Notice | null>(null)
  const [templates, setTemplates] = React.useState<ShiftTemplate[]>([])
  const [addMenu, setAddMenu] = React.useState<AddMenu | null>(null)
  const [dialog, setDialog] = React.useState<DialogState>(null)
  const requestRef = React.useRef(0)

  const dates = React.useMemo(() => weekDates(week), [week])

  const reload = React.useCallback(async () => {
    if (view !== 'woche') return
    const request = ++requestRef.current
    setLoading(true)
    try {
      const next = await fetchCalendar({ from: week, to: addDays(week, 6) })
      if (request !== requestRef.current) return
      setCalendar(next)
      setLoadError(null)
    } catch (err) {
      if (request !== requestRef.current) return
      setLoadError(
        messageOf(err, 'Der Dienstplan konnte nicht geladen werden.')
      )
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [week, view])

  React.useEffect(() => {
    void reload()
  }, [reload])

  // Schichtvorlagen einmal laden; ohne Vorlagen werden Zeiten frei eingetragen.
  React.useEffect(() => {
    let cancelled = false
    fetchShiftTemplates().then(
      (list) => {
        if (!cancelled) setTemplates(list)
      },
      () => undefined
    )
    return () => {
      cancelled = true
    }
  }, [])

  const navigate = (next: {
    week?: string
    view?: CalendarView
    area?: AreaFilter
  }) => {
    const state = {
      week: next.week ?? week,
      view: next.view ?? view,
      area: next.area ?? area,
    }
    setWeek(state.week)
    setView(state.view)
    setArea(state.area)
    router.replace(dienstplanHref(state), { scroll: false })
  }

  const done = (message: string, warnings: DienstplanWarning[] = []) => {
    setDialog(null)
    setError(null)
    setNotice({ message, warnings })
    void reload()
  }

  const removeShift = async (shift: Shift, employee: Employee) => {
    if (
      !window.confirm(
        `Schicht ${shift.startTime}–${shift.endTime} von ${
          employee.displayName
        } am ${formatDateWithWeekday(shift.date)} löschen?`
      )
    ) {
      return
    }
    try {
      await deleteShift(shift.id)
      done('Schicht gelöscht.')
    } catch (err) {
      setDialog(null)
      setError(messageOf(err, 'Löschen fehlgeschlagen.'))
    }
  }

  const removeAbsence = async (absence: Absence, employee: Employee) => {
    if (
      !window.confirm(
        `${ABSENCE_TYPE_LABELS[absence.type]} von ${
          employee.displayName
        } (${formatAbsenceRange(absence)}) löschen?`
      )
    ) {
      return
    }
    try {
      await deleteAbsence(absence.id)
      done('Abwesenheit gelöscht.')
    } catch (err) {
      setDialog(null)
      setError(messageOf(err, 'Löschen fehlgeschlagen.'))
    }
  }

  const openAdd = (anchor: HTMLElement, employee: Employee, date: string) => {
    if (canHaveShifts(employee)) {
      setAddMenu({ anchor, employee, date })
    } else {
      setDialog({ kind: 'absence', employee, date, absence: null })
    }
  }

  const thisWeek = mondayOf(calendar?.today ?? todayIso())

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            <CalendarIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Dienstplan
          </Typography>
          <Typography color="text.secondary">
            Schichten im Verkauf, Urlaub und Abwesenheiten
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/admin/dienstplan/mitarbeiter"
          variant="outlined"
          startIcon={<StaffIcon />}
        >
          Mitarbeiter
        </Button>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
          mb: 2,
        }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_, value: CalendarView | null) =>
            value && navigate({ view: value })
          }
          aria-label="Ansicht"
        >
          {CALENDAR_VIEWS.map((v) => (
            <ToggleButton key={v} value={v}>
              {CALENDAR_VIEW_LABELS[v]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {view === 'woche' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              aria-label="Vorige Woche"
              onClick={() => navigate({ week: addDays(week, -7) })}
            >
              <PrevIcon />
            </IconButton>
            <Button
              size="small"
              variant="outlined"
              onClick={() => navigate({ week: thisWeek })}
              disabled={week === thisWeek}
            >
              Heute
            </Button>
            <IconButton
              aria-label="Nächste Woche"
              onClick={() => navigate({ week: addDays(week, 7) })}
            >
              <NextIcon />
            </IconButton>
            <Typography
              component="h2"
              variant="subtitle1"
              sx={{ fontWeight: 600, ml: 1 }}
              data-testid="week-title"
            >
              {formatWeekTitle(week)}
            </Typography>
          </Box>
        )}
      </Box>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={area}
        onChange={(_, value: AreaFilter | null) =>
          value && navigate({ area: value })
        }
        aria-label="Bereich"
        sx={{ mb: 2, flexWrap: 'wrap' }}
      >
        {AREA_FILTERS.map((a) => (
          <ToggleButton key={a} value={a}>
            {a === 'alle' ? 'Alle' : AREA_LABELS[a]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}
      {notice && (
        <Alert
          severity={notice.warnings.length > 0 ? 'warning' : 'success'}
          sx={{ mb: 2 }}
          onClose={() => setNotice(null)}
        >
          {notice.message}
          {notice.warnings.map((w) => (
            <Box
              key={`${w.code}:${w.message}`}
              component="span"
              sx={{ display: 'block' }}
            >
              Hinweis: {w.message}
            </Box>
          ))}
        </Alert>
      )}

      {view !== 'woche' ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="text.secondary">
            {view === 'monat' ? 'Die Monatsansicht' : 'Die Jahresansicht'}{' '}
            folgt. Bis dahin zeigt die Woche alle Einträge.
          </Typography>
        </Paper>
      ) : calendar === null ? (
        loadError ? null : (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress aria-label="Dienstplan wird geladen" />
          </Box>
        )
      ) : (
        <WeekView
          calendar={calendar}
          dates={dates}
          area={area}
          loading={loading}
          onAdd={openAdd}
          onShift={(employee, shift) =>
            setDialog({ kind: 'shift', employee, date: shift.date, shift })
          }
          onAbsence={(employee, absence, date) =>
            setDialog({ kind: 'absence', employee, date, absence })
          }
        />
      )}

      <Menu
        anchorEl={addMenu?.anchor ?? null}
        open={addMenu !== null}
        onClose={() => setAddMenu(null)}
      >
        <MenuItem
          onClick={() => {
            if (!addMenu) return
            setDialog({
              kind: 'shift',
              employee: addMenu.employee,
              date: addMenu.date,
              shift: null,
            })
            setAddMenu(null)
          }}
        >
          Schicht anlegen
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!addMenu) return
            setDialog({
              kind: 'absence',
              employee: addMenu.employee,
              date: addMenu.date,
              absence: null,
            })
            setAddMenu(null)
          }}
        >
          Abwesenheit eintragen
        </MenuItem>
      </Menu>

      {dialog?.kind === 'shift' && (
        <ShiftDialog
          employee={dialog.employee}
          date={dialog.date}
          shift={dialog.shift}
          templates={templates}
          onClose={() => setDialog(null)}
          onDone={(warnings) =>
            done(
              dialog.shift ? 'Schicht gespeichert.' : 'Schicht angelegt.',
              warnings
            )
          }
          onDelete={
            dialog.shift
              ? () => void removeShift(dialog.shift as Shift, dialog.employee)
              : undefined
          }
        />
      )}
      {dialog?.kind === 'absence' && (
        <AbsenceDialog
          employeeId={dialog.employee.id}
          employeeName={dialog.employee.displayName}
          absence={dialog.absence}
          defaultDate={dialog.date}
          onClose={() => setDialog(null)}
          onDone={(warnings) =>
            done(
              dialog.absence
                ? 'Abwesenheit gespeichert.'
                : 'Abwesenheit eingetragen.',
              warnings
            )
          }
          onDelete={
            dialog.absence
              ? () =>
                  void removeAbsence(dialog.absence as Absence, dialog.employee)
              : undefined
          }
        />
      )}
    </Box>
  )
}

/**
 * Wochentabelle. Auf schmalen Bildschirmen scrollt sie waagrecht; die
 * Namensspalte bleibt stehen.
 */
function WeekView({
  calendar,
  dates,
  area,
  loading,
  onAdd,
  onShift,
  onAbsence,
}: {
  calendar: Calendar
  dates: readonly string[]
  area: AreaFilter
  loading: boolean
  onAdd: (anchor: HTMLElement, employee: Employee, date: string) => void
  onShift: (employee: Employee, shift: Shift) => void
  onAbsence: (employee: Employee, absence: Absence, date: string) => void
}) {
  const days = new Map(calendar.days.map((d) => [d.date, d]))
  const cells = entriesByCell(calendar, dates)
  const anyShifts = calendar.shifts.length > 0
  const shown =
    area === 'alle'
      ? calendar.employees
      : calendar.employees.filter((e) => e.area === area)
  const groups = groupByArea(shown)

  if (calendar.employees.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography color="text.secondary">
          Noch keine Mitarbeiter. Unter{' '}
          <Link href="/admin/dienstplan/mitarbeiter">Mitarbeiter</Link> anlegen.
        </Typography>
      </Paper>
    )
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {loading && (
        <LinearProgress
          aria-label="Woche wird geladen"
          sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4 }}
        />
      )}
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ overflowX: 'auto', opacity: loading ? 0.6 : 1 }}
      >
        <Table
          size="small"
          aria-label={`Dienstplan ${formatWeekTitle(dates[0])}`}
          sx={{
            tableLayout: 'fixed',
            minWidth: NAME_COLUMN_WIDTH + 7 * DAY_COLUMN_MIN_WIDTH,
            '& td, & th': { borderRight: 1, borderColor: 'divider' },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  ...stickyName,
                  zIndex: 3,
                  width: NAME_COLUMN_WIDTH,
                }}
              >
                Mitarbeiter
              </TableCell>
              {dates.map((date) => (
                <DayHeader
                  key={date}
                  date={date}
                  day={days.get(date)}
                  today={date === calendar.today}
                  anyShifts={anyShifts}
                />
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography color="text.secondary" sx={{ py: 1 }}>
                    Keine Mitarbeiter in diesem Bereich.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <React.Fragment key={group.area}>
                  <TableRow>
                    <TableCell
                      component="th"
                      scope="rowgroup"
                      colSpan={8}
                      sx={{ fontWeight: 700, py: 0.75 }}
                    >
                      {group.label} ({group.employees.length})
                    </TableCell>
                  </TableRow>
                  {group.employees.map((employee) => (
                    <TableRow
                      key={employee.id}
                      data-testid={`row-${employee.id}`}
                    >
                      <TableCell component="th" scope="row" sx={stickyName}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            minWidth: 0,
                          }}
                        >
                          <ColorDot color={employee.color} />
                          <Box
                            component={Link}
                            href={profileHref(employee.id)}
                            sx={{
                              color: 'text.primary',
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {employee.displayName}
                          </Box>
                        </Box>
                        {!employee.active && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label="ausgeschieden"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </TableCell>
                      {dates.map((date) => (
                        <DayCell
                          key={date}
                          employee={employee}
                          date={date}
                          day={days.get(date)}
                          entries={cells.get(cellKey(employee.id, date))}
                          onAdd={onAdd}
                          onShift={onShift}
                          onAbsence={onAbsence}
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
    </Box>
  )
}

const stickyName = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  bgcolor: 'background.paper',
  verticalAlign: 'top',
} as const

function DayHeader({
  date,
  day,
  today,
  anyShifts,
}: {
  date: string
  day: CalendarDay | undefined
  today: boolean
  anyShifts: boolean
}) {
  const closedName = day ? closedDayLabel(day) : null
  return (
    <TableCell
      data-testid={`day-${date}`}
      sx={{
        verticalAlign: 'top',
        bgcolor: day?.closed ? 'action.selected' : undefined,
        borderBottom: today ? 3 : 1,
        borderBottomColor: today ? 'primary.main' : 'divider',
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 700 }}
        color={today ? 'primary' : undefined}
      >
        {formatDateShort(date)}
        {today ? ' · heute' : ''}
      </Typography>
      {closedName && (
        <Typography variant="caption" sx={{ display: 'block' }}>
          {closedName}
        </Typography>
      )}
      {day?.halfDayName && !day.closed && (
        <Typography variant="caption" sx={{ display: 'block' }}>
          {day.halfDayName} (halber Tag)
        </Typography>
      )}
      {day && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block' }}
          data-testid={`staffing-${date}`}
        >
          {staffingText(day, anyShifts)}
        </Typography>
      )}
    </TableCell>
  )
}

function DayCell({
  employee,
  date,
  day,
  entries,
  onAdd,
  onShift,
  onAbsence,
}: {
  employee: Employee
  date: string
  day: CalendarDay | undefined
  entries: CellEntries | undefined
  onAdd: (anchor: HTMLElement, employee: Employee, date: string) => void
  onShift: (employee: Employee, shift: Shift) => void
  onAbsence: (employee: Employee, absence: Absence, date: string) => void
}) {
  const shifts = entries?.shifts ?? []
  const absences = entries?.absences ?? []
  const empty = shifts.length === 0 && absences.length === 0
  const addLabel = `Eintrag für ${
    employee.displayName
  } am ${formatDateWithWeekday(date)} anlegen`
  return (
    <TableCell
      data-testid={`cell-${employee.id}-${date}`}
      sx={{
        p: 0.5,
        verticalAlign: 'top',
        height: 56,
        bgcolor: day?.closed ? 'action.hover' : undefined,
      }}
    >
      {empty ? (
        <ButtonBase
          aria-label={addLabel}
          onClick={(e) => onAdd(e.currentTarget, employee, date)}
          sx={{
            width: '100%',
            height: '100%',
            minHeight: 48,
            borderRadius: 1,
            color: 'text.disabled',
            '& svg': { opacity: 0 },
            '&:hover, &:focus-visible': {
              bgcolor: 'action.hover',
              '& svg': { opacity: 1 },
            },
          }}
        >
          <AddIcon fontSize="small" />
        </ButtonBase>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {absences.map((absence) => (
            <AbsenceBar
              key={absence.id}
              absence={absence}
              onClick={() => onAbsence(employee, absence, date)}
            />
          ))}
          {shifts.map((shift) => (
            <ShiftBlock
              key={shift.id}
              shift={shift}
              color={employee.color}
              onClick={() => onShift(employee, shift)}
            />
          ))}
          <Tooltip title="Eintrag hinzufügen">
            <IconButton
              size="small"
              aria-label={addLabel}
              onClick={(e) => onAdd(e.currentTarget, employee, date)}
              sx={{ alignSelf: 'flex-start', p: 0.25 }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </TableCell>
  )
}

/** Abwesenheit als Balken: genehmigt gefüllt, geplant gestrichelt. */
function AbsenceBar({
  absence,
  onClick,
}: {
  absence: Absence
  onClick: () => void
}) {
  const color = ABSENCE_COLORS[absence.type]
  const planned = absence.status === 'geplant'
  const label = `${ABSENCE_TYPE_LABELS[absence.type]}${
    absence.halfDay ? ' ½' : ''
  }`
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={`${ABSENCE_TYPE_LABELS[absence.type]} (${
        ABSENCE_STATUS_LABELS[absence.status]
      }) ${formatAbsenceRange(absence)} bearbeiten`}
      data-testid={`absence-${absence.id}`}
      data-status={absence.status}
      sx={{
        width: '100%',
        justifyContent: 'flex-start',
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        typography: 'caption',
        fontWeight: 600,
        border: 2,
        borderStyle: planned ? 'dashed' : 'solid',
        borderColor: `${color}.main`,
        bgcolor: planned ? 'transparent' : `${color}.main`,
        color: planned ? 'text.primary' : `${color}.contrastText`,
      }}
    >
      {label}
      {planned ? ' · geplant' : ''}
    </ButtonBase>
  )
}

/** Schicht mit Uhrzeit; der Rand links trägt die Farbe der Person. */
function ShiftBlock({
  shift,
  color,
  onClick,
}: {
  shift: Shift
  color: string | null
  onClick: () => void
}) {
  const time = `${shift.startTime}–${shift.endTime}`
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={`Schicht ${time} am ${formatDateWithWeekday(
        shift.date
      )} bearbeiten`}
      title={[formatMinutes(shift.minutes), shift.note]
        .filter(Boolean)
        .join(' · ')}
      data-testid={`shift-${shift.id}`}
      sx={{
        width: '100%',
        justifyContent: 'flex-start',
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        typography: 'caption',
        fontWeight: 600,
        border: 1,
        borderColor: 'divider',
        borderLeft: 4,
        borderLeftColor: color ?? 'primary.main',
        bgcolor: 'background.paper',
        color: 'text.primary',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {time}
    </ButtonBase>
  )
}
