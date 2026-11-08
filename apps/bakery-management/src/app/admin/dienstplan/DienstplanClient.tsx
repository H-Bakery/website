'use client'
import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
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
  Badge as StaffIcon,
  Schedule as TemplatesIcon,
} from '@mui/icons-material'
import {
  ABSENCE_STATUS_LABELS,
  ABSENCE_TYPE_LABELS,
  AREAS,
  AREA_LABELS,
  deleteAbsence,
  deleteShift,
  fetchBalances,
  fetchCalendar,
  fetchShiftTemplates,
  formatAbsenceRange,
  formatDateWithWeekday,
  formatMinutes,
  groupByArea,
  type Absence,
  type Calendar,
  type CalendarDay,
  type DienstplanWarning,
  type Employee,
  type Shift,
  type ShiftTemplate,
} from '../../../lib/dienstplanApi'
import { formatDateShort, todayIso } from '../../../lib/backzettelFormat'
import {
  CALENDAR_VIEWS,
  CALENDAR_VIEW_LABELS,
  cellKey,
  closedDayLabel,
  dienstplanHref,
  entriesByCell,
  formatMonthTitle,
  formatPeriodTitle,
  formatWeekTitle,
  mondayOf,
  parseAreaFilter,
  parsePeriod,
  parseView,
  periodEnd,
  periodStart,
  staffingText,
  stepPeriod,
  switchPeriod,
  weekDates,
  type AreaFilter,
  type CalendarView,
  type CellEntries,
} from '../../../lib/dienstplanCalendar'
import { TOUCH_MEDIA } from '../../../lib/muiTheme'
import {
  DayNavigator,
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../components/layout'
import { messageOf } from './mitarbeiter/EmployeeDialog'
import AbsenceDialog from './AbsenceDialog'
import ShiftDialog from './ShiftDialog'
import ShiftTemplatesDialog from './ShiftTemplatesDialog'
import MonthView from './MonthView'
import YearView, { type YearBalances } from './YearView'
import {
  ABSENCE_COLORS,
  AreaGroupRow,
  EmployeeNameCell,
  NAME_COLUMN_WIDTH,
  stickyName,
} from './calendarParts'

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

/** Schichten nur im Verkauf und nur für aktive Mitarbeiter (die API prüft). */
function canHaveShifts(employee: Employee): boolean {
  return employee.area === 'verkauf' && employee.active
}

const AREA_FILTERS: AreaFilter[] = ['alle', ...AREAS]

/**
 * Breite einer Tagesspalte der Woche (px): Handy schmaler, damit neben der
 * stehenbleibenden Namensspalte noch ein Tag sichtbar ist.
 */
const DAY_COLUMN_MIN_WIDTH = { xs: 112, sm: 128 } as const

/** Beschriftung der Navigation je Ansicht. */
const PERIOD_NAV: Record<
  CalendarView,
  { label: string; prev: string; next: string; testId: string }
> = {
  woche: {
    label: 'Woche',
    prev: 'Vorige Woche',
    next: 'Nächste Woche',
    testId: 'week-navigator',
  },
  monat: {
    label: 'Monat',
    prev: 'Voriger Monat',
    next: 'Nächster Monat',
    testId: 'month-navigator',
  },
  jahr: {
    label: 'Jahr',
    prev: 'Voriges Jahr',
    next: 'Nächstes Jahr',
    testId: 'year-navigator',
  },
}

/** Testkennung des Abschnittstitels je Ansicht. */
const TITLE_TEST_ID: Record<CalendarView, string> = {
  woche: 'week-title',
  monat: 'month-title',
  jahr: 'year-title',
}

const SECTION_HINT: Record<CalendarView, string> = {
  woche:
    'Leere Zelle antippen: Schicht oder Abwesenheit anlegen. Eintrag antippen: bearbeiten.',
  monat:
    'Tag antippen: die Woche öffnet sich, dort wird eingetragen und bearbeitet. Punkt = Schicht.',
  jahr: 'Monat antippen: Monatsansicht. Rechts das Urlaubskonto des Jahres.',
}

/**
 * Kalender des Dienstplans (TASK-042, nur Inhaber mit persönlicher
 * Sitzung). Woche (Standard): Zeilen = Mitarbeitende nach Bereich (Verkauf
 * zuerst), Spalten Mo-So; Zellen zeigen Schichten mit Uhrzeit und
 * Abwesenheitsbalken (geplant gestrichelt). Ruhetag und Feiertage sind
 * hinterlegt und benannt, die Kopfzeile je Tag zeigt „Verkauf besetzt“.
 * Monat: Tage als schmale Spalten mit Abwesenheiten und Schicht-Punkten
 * (`MonthView`). Jahr: zwölf Monate je Person mit Urlaubsbalken und dem
 * Konto daneben (`YearView`).
 *
 * Alle Daten kommen aus `GET /api/dienstplan?from&to` (und für das Jahr
 * `GET /api/dienstplan/balance?year`); Feiertage, Ruhetag, Besetzung und
 * Salden rechnet der Browser nicht selbst. Zeitraum, Ansicht und Bereich
 * stehen in der URL.
 *
 * Layout-Kit: Wechsel des Zeitraums als `DayNavigator` (Woche, Monat oder
 * Jahr) vorne im Kopf, Ansicht und Bereich als Aktionen des
 * Kalender-Abschnitts; das Raster selbst ist eine eigene Tabelle, die am
 * Handy waagrecht scrollt (die Namensspalte bleibt stehen).
 */
export default function DienstplanClient({
  week: weekParam,
  month: monthParam,
  year: yearParam,
  view: viewParam,
  area: areaParam,
}: {
  week?: string
  month?: string
  year?: string
  view?: string
  area?: string
}) {
  const router = useRouter()
  const [view, setView] = React.useState<CalendarView>(() =>
    parseView(viewParam)
  )
  // Erster Tag des gezeigten Zeitraums: Montag, Monatserster oder 1.1.
  const [start, setStart] = React.useState<string>(() =>
    parsePeriod(
      parseView(viewParam),
      { week: weekParam, month: monthParam, year: yearParam },
      todayIso()
    )
  )
  const [area, setArea] = React.useState<AreaFilter>(() =>
    parseAreaFilter(areaParam)
  )
  const [calendar, setCalendar] = React.useState<Calendar | null>(null)
  const [balances, setBalances] = React.useState<{
    year: number
    value: YearBalances
  } | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<Notice | null>(null)
  const [templates, setTemplates] = React.useState<ShiftTemplate[]>([])
  const [templatesError, setTemplatesError] = React.useState<string | null>(
    null
  )
  const [templatesOpen, setTemplatesOpen] = React.useState(false)
  const [addMenu, setAddMenu] = React.useState<AddMenu | null>(null)
  const [dialog, setDialog] = React.useState<DialogState>(null)
  const requestRef = React.useRef(0)

  // Weiche Navigation auf dieselbe Seite (Seitenleiste, Links mit anderer
  // Query) ändert nur die Props - der Zustand folgt der URL.
  React.useEffect(() => {
    const nextView = parseView(viewParam)
    setView(nextView)
    setStart(
      parsePeriod(
        nextView,
        { week: weekParam, month: monthParam, year: yearParam },
        todayIso()
      )
    )
    setArea(parseAreaFilter(areaParam))
  }, [weekParam, monthParam, yearParam, viewParam, areaParam])

  const end = periodEnd(view, start)
  const year = Number(start.slice(0, 4))
  const dates = React.useMemo(
    () => (view === 'woche' ? weekDates(start) : []),
    [view, start]
  )
  // Nur den Zeitraum zeigen, für den der Kalender geladen ist: beim
  // Blättern (oder wenn das Laden scheitert) nie die Zellen des alten
  // Zeitraums mit den Tagen des neuen - nicht geladen ist nicht leer.
  const shownCalendar =
    calendar !== null && calendar.from === start && calendar.to === end
      ? calendar
      : null

  const reload = React.useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    if (view === 'jahr') {
      // Das Konto kommt getrennt; scheitert nur es, steht das Jahr trotzdem.
      setBalances((current) =>
        current?.year === year
          ? current
          : { year, value: { status: 'loading' } }
      )
      fetchBalances(year).then(
        (list) => {
          if (request !== requestRef.current) return
          setBalances({
            year,
            value: {
              status: 'ok',
              byEmployee: new Map(list.map((b) => [b.employeeId, b])),
            },
          })
        },
        () => {
          if (request !== requestRef.current) return
          setBalances({ year, value: { status: 'error' } })
        }
      )
    }
    try {
      const next = await fetchCalendar({ from: start, to: end })
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
  }, [start, end, view, year])

  React.useEffect(() => {
    void reload()
  }, [reload])

  // Schichtvorlagen einmal laden; ohne Vorlagen werden Zeiten frei eingetragen.
  // Scheitert das Laden, sagt der Dialog das - nicht „keine Vorlagen“.
  React.useEffect(() => {
    let cancelled = false
    fetchShiftTemplates().then(
      (list) => {
        if (cancelled) return
        setTemplates(list)
        setTemplatesError(null)
      },
      () => {
        if (!cancelled) {
          setTemplatesError(
            'Schichtvorlagen konnten nicht geladen werden - Zeiten frei eintragen.'
          )
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  const today = calendar?.today ?? todayIso()

  const navigate = (next: {
    start?: string
    view?: CalendarView
    area?: AreaFilter
  }) => {
    const nextView = next.view ?? view
    const state = {
      view: nextView,
      // Neuer Zeitraum ausdrücklich, sonst beim Ansichtswechsel umrechnen.
      start:
        next.start ??
        (nextView === view
          ? start
          : switchPeriod(view, start, nextView, today)),
      area: next.area ?? area,
    }
    setView(state.view)
    setStart(state.start)
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

  const nav = PERIOD_NAV[view]
  const sectionHint =
    shownCalendar && shownCalendar.employees.length > 0
      ? SECTION_HINT[view]
      : undefined
  // Die Tabelle steht bis an den Rand der Karte; Leer- und Ladezustand
  // bekommen das Polster des Abschnitts.
  const gridShown = shownCalendar !== null && shownCalendar.employees.length > 0

  const toolbar = (
    <>
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
      <ToggleButtonGroup
        exclusive
        size="small"
        value={area}
        onChange={(_, value: AreaFilter | null) =>
          value && navigate({ area: value })
        }
        aria-label="Bereich"
        sx={{ flexWrap: 'wrap' }}
      >
        {AREA_FILTERS.map((a) => (
          <ToggleButton key={a} value={a}>
            {a === 'alle' ? 'Alle' : AREA_LABELS[a]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </>
  )

  // Kein Kalender für diese Woche und kein Laden mehr: der Fehler steht im
  // Abschnitt statt eines (leeren) Rasters. Scheitert nur das Auffrischen
  // einer geladenen Woche, steht er oben und das Raster bleibt.
  const blockingError = shownCalendar === null && loadError && !loading

  return (
    <PageLayout
      width="wide"
      title="Dienstplan"
      subtitle="Schichten im Verkauf, Urlaub und Abwesenheiten"
      actions={
        <>
          <DayNavigator
            key={view}
            value={start}
            onChange={(date) => navigate({ start: periodStart(view, date) })}
            label={nav.label}
            step={(date, direction) => stepPeriod(view, date, direction)}
            prevLabel={nav.prev}
            nextLabel={nav.next}
            today={periodStart(view, today)}
            // Monat und Jahr sind kein einzelner Tag: statt des Datumsfelds
            // steht der Zeitraum zwischen den Pfeilen.
            display={
              view === 'monat'
                ? formatMonthTitle(start)
                : view === 'jahr'
                ? start.slice(0, 4)
                : undefined
            }
            data-testid={nav.testId}
          />
          <Button
            component={Link}
            href="/admin/dienstplan/mitarbeiter"
            variant="outlined"
            startIcon={<StaffIcon />}
          >
            Mitarbeiter
          </Button>
          <Button
            variant="outlined"
            startIcon={<TemplatesIcon />}
            onClick={() => setTemplatesOpen(true)}
          >
            Schichtvorlagen
          </Button>
        </>
      }
    >
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {/* Nur über einem geladenen Raster: beim erneuten Versuch nach einem
          blockierenden Fehler steht sonst Fehler und Laden zugleich da. */}
      {loadError && shownCalendar !== null && (
        <ErrorState message={loadError} onRetry={() => void reload()} />
      )}
      {view === 'jahr' &&
        shownCalendar !== null &&
        balances?.year === year &&
        balances.value.status === 'error' && (
          <Alert severity="warning">
            Das Urlaubskonto {year} konnte nicht geladen werden - die Spalte
            „Urlaub {year}“ bleibt offen.
          </Alert>
        )}
      {notice && (
        <Alert
          severity={notice.warnings.length > 0 ? 'warning' : 'success'}
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

      <PageSection
        title={
          <span data-testid={TITLE_TEST_ID[view]}>
            {formatPeriodTitle(view, start)}
          </span>
        }
        description={sectionHint}
        actions={toolbar}
        disablePadding={gridShown}
        data-testid="calendar-section"
      >
        {shownCalendar !== null && shownCalendar.employees.length === 0 ? (
          <EmptyState
            title="Noch keine Mitarbeiter."
            description="Erst Mitarbeiter anlegen, dann Schichten und Abwesenheiten eintragen."
            action={
              <Button
                component={Link}
                href="/admin/dienstplan/mitarbeiter"
                variant="outlined"
              >
                Zur Mitarbeiterliste
              </Button>
            }
          />
        ) : shownCalendar !== null && view === 'woche' ? (
          <WeekView
            calendar={shownCalendar}
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
        ) : shownCalendar !== null && view === 'monat' ? (
          <MonthView
            calendar={shownCalendar}
            monthStart={start}
            area={area}
            loading={loading}
            onOpenDay={(date) =>
              navigate({ view: 'woche', start: mondayOf(date) })
            }
          />
        ) : shownCalendar !== null ? (
          <YearView
            calendar={shownCalendar}
            year={year}
            balances={
              balances?.year === year ? balances.value : { status: 'loading' }
            }
            area={area}
            loading={loading}
            onOpenMonth={(monthStart) =>
              navigate({ view: 'monat', start: monthStart })
            }
          />
        ) : blockingError ? (
          <ErrorState message={loadError} onRetry={() => void reload()} />
        ) : (
          <LoadingState label="Dienstplan wird geladen …" />
        )}
      </PageSection>

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

      {templatesOpen && (
        <ShiftTemplatesDialog
          onClose={() => setTemplatesOpen(false)}
          onChange={(list) => {
            setTemplates(list)
            setTemplatesError(null)
          }}
        />
      )}
      {dialog?.kind === 'shift' && (
        <ShiftDialog
          employee={dialog.employee}
          date={dialog.date}
          shift={dialog.shift}
          templates={templates}
          templatesError={templatesError}
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
    </PageLayout>
  )
}

/**
 * Wochentabelle im Kalender-Abschnitt (bis an den Rand der Karte). Auf
 * schmalen Bildschirmen scrollt nur sie waagrecht, nie die Seite; die
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

  return (
    <Box sx={{ position: 'relative' }}>
      {loading && (
        <LinearProgress
          aria-label="Woche wird geladen"
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
          aria-label={`Dienstplan ${formatWeekTitle(dates[0])}`}
          sx={{
            tableLayout: 'fixed',
            minWidth: {
              xs: NAME_COLUMN_WIDTH.xs + 7 * DAY_COLUMN_MIN_WIDTH.xs,
              sm: NAME_COLUMN_WIDTH.sm + 7 * DAY_COLUMN_MIN_WIDTH.sm,
            },
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
                    colSpan={8}
                  />
                  {group.employees.map((employee) => (
                    <TableRow
                      key={employee.id}
                      data-testid={`row-${employee.id}`}
                    >
                      <EmployeeNameCell employee={employee} />
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
  const staffing = day ? staffingText(day, anyShifts) : null
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
        sx={{ fontWeight: 600 }}
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
      {staffing && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block' }}
          data-testid={`staffing-${date}`}
        >
          {staffing}
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
            color: 'text.secondary',
            '& svg': { opacity: 0 },
            // Touch kennt kein Hover: das Plus steht gedämpft immer da, sonst
            // sieht die Zelle leer und nicht antippbar aus.
            [TOUCH_MEDIA]: { '& svg': { opacity: 0.5 } },
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

/**
 * Einträge der Woche sind am Schreibtisch kompakt; auf Touch-Geräten sind
 * sie der einzige Weg zum Bearbeiten und bekommen 44 px (Layout-Kit).
 */
const ENTRY_TOUCH = { minHeight: 44 } as const

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
        // eigene klickbare Fläche: auf Touch 44 px hoch (Layout-Kit)
        [TOUCH_MEDIA]: ENTRY_TOUCH,
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
        [TOUCH_MEDIA]: ENTRY_TOUCH,
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
