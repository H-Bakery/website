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
import type { Theme } from '@mui/material/styles'
import { Add as AddIcon, Badge as StaffIcon } from '@mui/icons-material'
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
import {
  DayNavigator,
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  shiftIsoDate,
} from '../../../components/layout'
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

/**
 * Spaltenbreiten des Rasters (px): Handy schmaler, damit neben der
 * stehenbleibenden Namensspalte noch ein Tag sichtbar ist.
 */
const NAME_COLUMN_WIDTH = { xs: 116, sm: 170 } as const
const DAY_COLUMN_MIN_WIDTH = { xs: 112, sm: 128 } as const

/** Pfeile der Wochennavigation: sieben Tage weiter oder zurück. */
function weekStep(date: string, direction: 1 | -1): string | null {
  return shiftIsoDate(date, direction * 7)
}

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
 *
 * Layout-Kit: Wochenwechsel als `DayNavigator` (Schritt 7 Tage) vorne im
 * Kopf, Ansicht und Bereich als Aktionen des Kalender-Abschnitts; das Raster
 * selbst ist eine eigene Tabelle, die am Handy waagrecht scrollt (die
 * Namensspalte bleibt stehen).
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
  const [templatesError, setTemplatesError] = React.useState<string | null>(
    null
  )
  const [addMenu, setAddMenu] = React.useState<AddMenu | null>(null)
  const [dialog, setDialog] = React.useState<DialogState>(null)
  const requestRef = React.useRef(0)

  // Weiche Navigation auf dieselbe Seite (Seitenleiste, Links mit anderer
  // Query) ändert nur die Props - der Zustand folgt der URL.
  React.useEffect(() => {
    setWeek(parseWeek(weekParam) ?? mondayOf(todayIso()))
    setView(parseView(viewParam))
    setArea(parseAreaFilter(areaParam))
  }, [weekParam, viewParam, areaParam])

  const dates = React.useMemo(() => weekDates(week), [week])
  // Nur die Woche zeigen, für die der Kalender geladen ist: beim Blättern
  // (oder wenn das Laden scheitert) nie die Zellen der alten Woche mit den
  // Tagen der neuen - eine nicht geladene Woche ist keine leere Woche.
  const shownCalendar =
    calendar !== null && calendar.from === week ? calendar : null

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
          {view === 'woche' && (
            <DayNavigator
              value={week}
              onChange={(date) => navigate({ week: mondayOf(date) })}
              label="Woche"
              step={weekStep}
              prevLabel="Vorige Woche"
              nextLabel="Nächste Woche"
              today={thisWeek}
              data-testid="week-navigator"
            />
          )}
          <Button
            component={Link}
            href="/admin/dienstplan/mitarbeiter"
            variant="outlined"
            startIcon={<StaffIcon />}
          >
            Mitarbeiter
          </Button>
        </>
      }
    >
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {loadError && !blockingError && (
        <ErrorState message={loadError} onRetry={() => void reload()} />
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
          view === 'woche' ? (
            <span data-testid="week-title">{formatWeekTitle(week)}</span>
          ) : view === 'monat' ? (
            'Monatsansicht'
          ) : (
            'Jahresansicht'
          )
        }
        description={
          view === 'woche' && shownCalendar
            ? 'Leere Zelle antippen: Schicht oder Abwesenheit anlegen. Eintrag antippen: bearbeiten.'
            : undefined
        }
        actions={toolbar}
        disablePadding={view === 'woche' && shownCalendar !== null}
        data-testid="calendar-section"
      >
        {view !== 'woche' ? (
          <EmptyState
            title={`${
              view === 'monat' ? 'Die Monatsansicht' : 'Die Jahresansicht'
            } folgt.`}
            description="Bis dahin zeigt die Woche alle Einträge."
          />
        ) : shownCalendar !== null ? (
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

  if (calendar.employees.length === 0) {
    return (
      <Box sx={{ px: { xs: 2, md: 3 }, pb: { xs: 2, md: 3 } }}>
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
      </Box>
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
                  <TableRow>
                    <TableCell
                      component="th"
                      scope="rowgroup"
                      colSpan={8}
                      sx={{
                        typography: 'subtitle2',
                        fontWeight: 600,
                        py: 0.75,
                        bgcolor: 'action.hover',
                      }}
                    >
                      {/* bleibt beim waagrechten Scrollen links stehen */}
                      <Box
                        component="span"
                        sx={{
                          position: 'sticky',
                          left: 8,
                          display: 'inline-block',
                        }}
                      >
                        {group.label} ({group.employees.length})
                      </Box>
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
                              typography: 'body2',
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

/**
 * Stehenbleibende Namensspalte. Sie braucht einen deckenden Grund; im
 * Dunkelmodus legt MUI über `Paper` (Elevation 1, die Fläche von
 * `PageSection`) einen hellen Schleier - den bekommt die Zelle auch, sonst
 * wäre sie dunkler als das Raster daneben.
 */
function stickyName(theme: Theme) {
  return {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    verticalAlign: 'top',
    bgcolor: 'background.paper',
    backgroundImage:
      theme.palette.mode === 'dark'
        ? `linear-gradient(${PAPER_OVERLAY}, ${PAPER_OVERLAY})`
        : 'none',
  } as const
}

/** MUI-Schleier für Elevation 1 im Dunkelmodus (`getOverlayAlpha(1)`). */
const PAPER_OVERLAY = 'rgba(255, 255, 255, 0.051)'

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
            color: 'text.secondary',
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
