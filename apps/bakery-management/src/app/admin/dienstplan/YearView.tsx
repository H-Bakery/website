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
  formatAbsenceRange,
  formatDays,
  formatOpenDays,
  groupByArea,
  type Absence,
  type BalanceListEntry,
  type Calendar,
  type Employee,
} from '../../../lib/dienstplanApi'
import {
  MONTH_NAMES,
  MONTH_SHORT,
  monthSegment,
  type AreaFilter,
} from '../../../lib/dienstplanCalendar'
import { TOUCH_MEDIA } from '../../../lib/muiTheme'
import {
  ABSENCE_COLORS,
  AbsenceLegend,
  AreaGroupRow,
  EmployeeNameCell,
  NAME_COLUMN_WIDTH,
  stickyName,
} from './calendarParts'

const MONTH_WIDTH = 56
const BALANCE_WIDTH = 132

/** Konten eines Jahres: geladen, nicht geladen (Fehler) oder noch unterwegs. */
export type YearBalances =
  | { status: 'ok'; byEmployee: Map<number, BalanceListEntry> }
  | { status: 'error' }
  | { status: 'loading' }

/**
 * Jahresansicht: je Person eine Zeile mit zwölf Monaten, Abwesenheiten als
 * Balken an ihrer Stelle im Monat (geplant gestrichelt), daneben das
 * Urlaubskonto des Jahres aus `GET /api/dienstplan/balance?year` - der
 * Browser rechnet keine Salden. Ein Monat im Kopf öffnet die Monatsansicht;
 * ein Monat einer Person mit Abwesenheiten öffnet sie zum Bearbeiten
 * (`onCell`, wie in Woche und Monat).
 */
export default function YearView({
  calendar,
  year,
  balances,
  area,
  loading,
  onOpenMonth,
  onCell,
}: {
  calendar: Calendar
  year: number
  balances: YearBalances
  area: AreaFilter
  loading: boolean
  onOpenMonth: (monthStart: string) => void
  onCell: (anchor: HTMLElement, employee: Employee, absences: Absence[]) => void
}) {
  const months = MONTH_NAMES.map(
    (_, i) => `${year}-${String(i + 1).padStart(2, '0')}-01`
  )
  const shown =
    area === 'alle'
      ? calendar.employees
      : calendar.employees.filter((e) => e.area === area)
  const groups = groupByArea(shown)
  const columns = months.length + 2
  const byEmployee = new Map<number, Absence[]>()
  for (const absence of calendar.absences) {
    const list = byEmployee.get(absence.employeeId) ?? []
    list.push(absence)
    byEmployee.set(absence.employeeId, list)
  }
  const thisMonth = calendar.today.slice(0, 7)

  return (
    <Box sx={{ position: 'relative' }}>
      {loading && (
        <LinearProgress
          aria-label="Jahr wird geladen"
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
          aria-label={`Dienstplan Jahr ${year}`}
          sx={{
            tableLayout: 'fixed',
            minWidth: {
              xs: NAME_COLUMN_WIDTH.xs + 12 * MONTH_WIDTH + BALANCE_WIDTH,
              sm: NAME_COLUMN_WIDTH.sm + 12 * MONTH_WIDTH + BALANCE_WIDTH,
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
              {months.map((monthStart, i) => {
                const current = monthStart.slice(0, 7) === thisMonth
                return (
                  <TableCell
                    key={monthStart}
                    align="center"
                    sx={{
                      p: 0,
                      borderBottom: current ? 3 : 1,
                      borderBottomColor: current ? 'primary.main' : 'divider',
                    }}
                  >
                    <ButtonBase
                      onClick={() => onOpenMonth(monthStart)}
                      aria-label={`${MONTH_NAMES[i]} ${year} als Monat öffnen`}
                      sx={{
                        width: '100%',
                        minHeight: 36,
                        [TOUCH_MEDIA]: { minHeight: 44 },
                        typography: 'body2',
                        fontWeight: 600,
                        color: current ? 'primary.main' : 'text.primary',
                        '&:hover, &:focus-visible': {
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      {MONTH_SHORT[i]}
                    </ButtonBase>
                  </TableCell>
                )
              })}
              <TableCell sx={{ width: BALANCE_WIDTH }}>
                Urlaub {year}
                {balances.status === 'error' && (
                  // Statt einer eigenen Meldung über der Seite: hier, wo das
                  // Konto fehlt.
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    data-testid="balance-error"
                  >
                    Konto konnte nicht geladen werden
                  </Typography>
                )}
              </TableCell>
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
                      {months.map((monthStart) => (
                        <YearMonthCell
                          key={monthStart}
                          testId={`month-${employee.id}-${monthStart.slice(
                            0,
                            7
                          )}`}
                          employee={employee}
                          monthStart={monthStart}
                          absences={byEmployee.get(employee.id) ?? []}
                          onCell={onCell}
                        />
                      ))}
                      <BalanceCell
                        employeeId={employee.id}
                        balances={balances}
                      />
                    </TableRow>
                  ))}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <AbsenceLegend />
    </Box>
  )
}

/**
 * Ein Monat einer Person: Abwesenheiten als Balken an ihrer Stelle. Mit
 * Abwesenheiten ist der ganze Monat (nicht der schmale Balken) die
 * antippbare Fläche - auf Touch mindestens 44 px.
 */
function YearMonthCell({
  testId,
  employee,
  monthStart,
  absences,
  onCell,
}: {
  testId: string
  employee: Employee
  monthStart: string
  absences: Absence[]
  onCell: (anchor: HTMLElement, employee: Employee, absences: Absence[]) => void
}) {
  const bars = absences
    .map((absence) => ({ absence, segment: monthSegment(absence, monthStart) }))
    .filter(
      (
        bar
      ): bar is {
        absence: Absence
        segment: { left: number; width: number }
      } => bar.segment !== null
    )
  const texts = bars.map(
    ({ absence }) =>
      `${ABSENCE_TYPE_LABELS[absence.type]} (${
        ABSENCE_STATUS_LABELS[absence.status]
      }) ${formatAbsenceRange(absence)}`
  )
  const track = (
    // Text steht im Namen des Knopfs; die Balken sind nur Bild.
    <Box aria-hidden sx={{ position: 'relative', height: 16, width: '100%' }}>
      {bars.map(({ absence, segment }, i) => {
        const color = ABSENCE_COLORS[absence.type]
        const planned = absence.status === 'geplant'
        return (
          <Box
            key={absence.id}
            title={texts[i]}
            data-testid={`bar-${absence.id}-${monthStart.slice(0, 7)}`}
            data-status={absence.status}
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${segment.left * 100}%`,
              width: `${segment.width * 100}%`,
              // ein einzelner Tag bleibt sichtbar, auch gestrichelt
              minWidth: 6,
              borderRadius: 0.5,
              border: planned ? 2 : 0,
              borderStyle: 'dashed',
              borderColor: `${color}.main`,
              bgcolor: planned ? 'transparent' : `${color}.main`,
            }}
          />
        )
      })}
    </Box>
  )
  return (
    <TableCell data-testid={testId} sx={{ p: 0.5, verticalAlign: 'middle' }}>
      {bars.length === 0 ? (
        track
      ) : (
        <ButtonBase
          aria-label={`${employee.displayName}, ${texts.join(
            ', '
          )} - bearbeiten`}
          title={texts.join('\n')}
          onClick={(event) =>
            onCell(
              event.currentTarget,
              employee,
              bars.map((bar) => bar.absence)
            )
          }
          sx={{
            width: '100%',
            minHeight: 28,
            [TOUCH_MEDIA]: { minHeight: 44 },
            px: 0.25,
            borderRadius: 0.5,
            '&:hover, &:focus-visible': {
              bgcolor: 'action.hover',
              outline: 2,
              outlineColor: 'primary.main',
            },
          }}
        >
          {track}
        </ButtonBase>
      )}
    </TableCell>
  )
}

/**
 * Urlaubskonto der Person im Jahr, wie die API es rechnet: Rest, genehmigt
 * (auch noch Kommendes - daher nicht „genommen“), geplant und - wenn am 31.03. Übertrag übrig blieb - verfallen. Ohne
 * erfassten Anspruch steht der Rest als „offen“ da (nie 0); ist das Konto
 * nicht geladen, steht das da.
 */
function BalanceCell({
  employeeId,
  balances,
}: {
  employeeId: number
  balances: YearBalances
}) {
  let main: string
  let detail: string | null = null
  if (balances.status === 'loading') {
    main = '…'
  } else if (balances.status === 'error') {
    main = 'nicht geladen'
  } else {
    const balance = balances.byEmployee.get(employeeId)
    if (!balance || balance.status === 'not-employed') {
      main = 'nicht beschäftigt'
    } else {
      main = `Rest ${formatOpenDays(balance.remainingDays)}`
      // Verfallen nur, wenn ein Übertrag erfasst ist und am 31.03. etwas
      // übrig blieb - ohne Übertrag ist es nicht „0 verfallen“.
      const expired = balance.carryoverExpired ?? 0
      detail = [
        `genehmigt ${formatDays(balance.approvedDays)}`,
        `geplant ${formatDays(balance.plannedDays)}`,
        expired > 0 ? `verfallen ${formatDays(expired)}` : null,
        balance.status === 'no-config' ? 'Anspruch offen' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    }
  }
  return (
    <TableCell data-testid={`balance-${employeeId}`} sx={{ py: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {main}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary" display="block">
          {detail}
        </Typography>
      )}
    </TableCell>
  )
}
