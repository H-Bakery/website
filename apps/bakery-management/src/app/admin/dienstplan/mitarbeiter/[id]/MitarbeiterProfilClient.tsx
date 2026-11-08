'use client'
import React from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material'
import {
  ABSENCE_STATUS_LABELS,
  ABSENCE_TYPE_LABELS,
  AREA_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  deleteAbsence,
  fetchEmployeeProfile,
  formatAbsenceRange,
  formatDateDe,
  formatDateWithWeekday,
  formatDays,
  formatMinutes,
  formatOpenDays,
  numberToInput,
  parseDaysInput,
  saveEntitlement,
  updateEmployee,
  type Absence,
  type ProfileAbsence,
  type DienstplanWarning,
  type Employee,
  type EmployeeProfile,
  type Entitlement,
  type Shift,
  type VacationBalance,
} from '../../../../../lib/dienstplanApi'
import {
  EmptyState,
  ErrorState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
  ResponsiveList,
  SECTION_GAP,
  type ResponsiveColumn,
} from '../../../../../components/layout'
import EmployeeDialog, { ColorDot, messageOf } from '../EmployeeDialog'
import AbsenceDialog, {
  useFullScreenDialog,
  useSubmit,
} from '../../AbsenceDialog'

type DialogState =
  | { kind: 'employee' }
  | { kind: 'entitlement'; year: number; row: Entitlement | null }
  | { kind: 'absence'; absence: Absence | null }
  | null

interface Notice {
  message: string
  warnings: DienstplanWarning[]
}

const BACK = {
  href: '/admin/dienstplan/mitarbeiter',
  label: 'Alle Mitarbeiter',
}

/**
 * Profil eines Mitarbeiters (TASK-042, nur Inhaber mit persönlicher
 * Sitzung): Stammdaten (bearbeiten, ausscheiden / wieder aktivieren),
 * Urlaubskonto des gewählten Jahres, Anspruch je Jahr, Abwesenheiten des
 * Jahres (anlegen, ändern, löschen) und die kommenden Schichten.
 *
 * Alle Zahlen des Kontos kommen fertig aus der API (`vacation.core.js`);
 * fehlt der Anspruch, steht „offen“ - nie 0.
 *
 * Layout-Kit: Stammdaten und Urlaubskonto nebeneinander (ab `md`),
 * Abwesenheiten und Schichten als `ResponsiveList` in voller Breite (am
 * Handy Karten).
 */
export default function MitarbeiterProfilClient({ id }: { id: number }) {
  // Ohne Wahl liefert die API das laufende Jahr (Berlin).
  const [year, setYear] = React.useState<number | undefined>(undefined)
  const [profile, setProfile] = React.useState<EmployeeProfile | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<Notice | null>(null)
  const [dialog, setDialog] = React.useState<DialogState>(null)
  const requestRef = React.useRef(0)

  const reload = React.useCallback(async () => {
    const request = ++requestRef.current
    try {
      const next = await fetchEmployeeProfile(id, year)
      if (request !== requestRef.current) return
      setProfile(next)
      setLoadError(null)
    } catch (err) {
      if (request !== requestRef.current) return
      setLoadError(messageOf(err, 'Das Profil konnte nicht geladen werden.'))
    }
  }, [id, year])

  React.useEffect(() => {
    void reload()
  }, [reload])

  const done = (message: string, warnings: DienstplanWarning[] = []) => {
    setDialog(null)
    setError(null)
    setNotice({ message, warnings })
    void reload()
  }

  if (!profile) {
    return (
      <PageLayout title="Mitarbeiter" back={BACK}>
        {loadError ? (
          <ErrorState message={loadError} onRetry={() => void reload()} />
        ) : (
          <LoadingState label="Profil wird geladen …" />
        )}
      </PageLayout>
    )
  }

  const { employee, balance } = profile
  // Das Jahr der geladenen Daten - beim Blättern bleibt bis zur Antwort das alte stehen.
  const shownYear = profile.year
  const yearRow =
    profile.entitlements.find((row) => row.year === shownYear) ?? null

  const toggleActive = async () => {
    const leaving = employee.active
    if (
      leaving &&
      !window.confirm(
        `${employee.displayName} als ausgeschieden markieren? Die Person erscheint nicht mehr im Kalender; Urlaub und Schichten bleiben erhalten. Schichten ab heute vorher löschen.`
      )
    ) {
      return
    }
    try {
      await updateEmployee(employee.id, { active: !leaving })
      done(
        leaving
          ? `${employee.displayName} ist ausgeschieden.`
          : `${employee.displayName} ist wieder aktiv.`
      )
    } catch (err) {
      setError(messageOf(err, 'Speichern fehlgeschlagen.'))
    }
  }

  const removeAbsence = async (absence: Absence) => {
    if (
      !window.confirm(
        `${ABSENCE_TYPE_LABELS[absence.type]} ${formatAbsenceRange(
          absence
        )} löschen?`
      )
    ) {
      return
    }
    try {
      await deleteAbsence(absence.id)
      done('Abwesenheit gelöscht.')
    } catch (err) {
      setError(messageOf(err, 'Löschen fehlgeschlagen.'))
    }
  }

  return (
    <PageLayout
      title={employee.displayName}
      subtitle={subtitleOf(employee)}
      back={BACK}
      status={
        <>
          <Chip
            size="small"
            variant="outlined"
            label={AREA_LABELS[employee.area]}
          />
          <Chip
            size="small"
            color={employee.active ? 'success' : 'default'}
            variant={employee.active ? 'filled' : 'outlined'}
            label={employee.active ? 'aktiv' : 'ausgeschieden'}
          />
        </>
      }
      actions={
        <Button
          component={Link}
          href={`/admin/dienstplan?bereich=${employee.area}`}
          variant="outlined"
          startIcon={<CalendarIcon />}
        >
          Im Kalender
        </Button>
      }
    >
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {loadError && (
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

      <Box
        sx={{
          display: 'grid',
          gap: SECTION_GAP,
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: 'repeat(2, minmax(0, 1fr))',
          },
          alignItems: 'start',
        }}
      >
        <PageSection
          title="Stammdaten"
          actions={
            <>
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => setDialog({ kind: 'employee' })}
              >
                Bearbeiten
              </Button>
              <Button
                size="small"
                color={employee.active ? 'warning' : 'primary'}
                onClick={() => void toggleActive()}
              >
                {employee.active ? 'Ausscheiden' : 'Wieder aktivieren'}
              </Button>
            </>
          }
        >
          <MasterData employee={employee} />
        </PageSection>

        <PageSection
          title={`Urlaubskonto ${shownYear}`}
          description="Arbeitstage; genehmigter und geplanter Urlaub getrennt."
          actions={
            <>
              <Tooltip title="Vorheriges Jahr">
                <span>
                  <IconButton
                    aria-label="Vorheriges Jahr"
                    onClick={() => setYear(shownYear - 1)}
                    disabled={shownYear <= 2000}
                  >
                    <PrevIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Nächstes Jahr">
                <span>
                  <IconButton
                    aria-label="Nächstes Jahr"
                    onClick={() => setYear(shownYear + 1)}
                    disabled={shownYear >= 2100}
                  >
                    <NextIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          }
          detailsLabel="Anspruch je Jahr"
          details={
            profile.entitlements.length > 0 ? (
              <EntitlementList
                rows={profile.entitlements}
                onEdit={(row) =>
                  setDialog({ kind: 'entitlement', year: row.year, row })
                }
              />
            ) : undefined
          }
        >
          <BalanceView balance={balance} year={shownYear} />
          <Button
            size="small"
            startIcon={<EditIcon />}
            sx={{ mt: 1.5, ml: -0.5 }}
            onClick={() =>
              setDialog({ kind: 'entitlement', year: shownYear, row: yearRow })
            }
          >
            Anspruch und Übertrag {shownYear}
          </Button>
        </PageSection>
      </Box>

      <PageSection
        title={`Abwesenheiten ${shownYear}`}
        description="Nur Urlaub zählt aufs Urlaubskonto."
        actions={
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setDialog({ kind: 'absence', absence: null })}
          >
            Eintragen
          </Button>
        }
        disablePadding={profile.absences.length > 0}
      >
        {profile.absences.length === 0 ? (
          <EmptyState title={`Keine Abwesenheiten in ${shownYear}.`} />
        ) : (
          <ResponsiveList
            aria-label={`Abwesenheiten ${shownYear}`}
            rows={profile.absences}
            columns={ABSENCE_COLUMNS}
            rowKey={(absence) => absence.id}
            rowTestId={(absence) => `absence-${absence.id}`}
            actions={(absence) => (
              <>
                <Tooltip title="Bearbeiten">
                  <IconButton
                    aria-label={`Abwesenheit ${formatAbsenceRange(
                      absence
                    )} bearbeiten`}
                    onClick={() => setDialog({ kind: 'absence', absence })}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Löschen">
                  <IconButton
                    aria-label={`Abwesenheit ${formatAbsenceRange(
                      absence
                    )} löschen`}
                    onClick={() => void removeAbsence(absence)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </>
            )}
          />
        )}
      </PageSection>

      <PageSection
        title="Kommende Schichten"
        disablePadding={profile.upcomingShifts.length > 0}
      >
        {profile.upcomingShifts.length === 0 ? (
          <EmptyState
            title={
              employee.area !== 'verkauf'
                ? 'Schichten gibt es nur im Verkauf.'
                : 'Keine Schichten geplant.'
            }
          />
        ) : (
          <ResponsiveList
            aria-label="Kommende Schichten"
            rows={profile.upcomingShifts}
            columns={SHIFT_COLUMNS}
            rowKey={(shift) => shift.id}
            rowTestId={(shift) => `upcoming-shift-${shift.id}`}
          />
        )}
      </PageSection>

      {dialog?.kind === 'employee' && (
        <EmployeeDialog
          employee={employee}
          onClose={() => setDialog(null)}
          onDone={(saved) => done(`${saved.displayName} gespeichert.`)}
        />
      )}
      {dialog?.kind === 'entitlement' && (
        <EntitlementDialog
          employeeId={employee.id}
          year={dialog.year}
          row={dialog.row}
          onClose={() => setDialog(null)}
          onDone={() => done(`Anspruch ${dialog.year} gespeichert.`)}
        />
      )}
      {dialog?.kind === 'absence' && (
        <AbsenceDialog
          employeeId={employee.id}
          absence={dialog.absence}
          defaultDate={defaultAbsenceDate(shownYear)}
          onClose={() => setDialog(null)}
          onDone={(warnings) =>
            done(
              dialog.absence
                ? 'Abwesenheit gespeichert.'
                : 'Abwesenheit eingetragen.',
              warnings
            )
          }
        />
      )}
    </PageLayout>
  )
}

/** Eine Zeile unter dem Namen: Beschäftigung und Wochenstunden. */
function subtitleOf(employee: Employee): string | undefined {
  const parts: string[] = []
  if (employee.employmentType) {
    parts.push(EMPLOYMENT_TYPE_LABELS[employee.employmentType])
  }
  if (employee.weeklyHours !== null) {
    parts.push(`${formatDays(employee.weeklyHours)} Std./Woche`)
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
}

const ABSENCE_COLUMNS: ResponsiveColumn<ProfileAbsence>[] = [
  {
    key: 'range',
    header: 'Zeitraum',
    primary: true,
    cell: (absence) => (
      <Typography variant="body2" fontWeight={600}>
        {formatAbsenceRange(absence)}
      </Typography>
    ),
  },
  {
    key: 'type',
    header: 'Art',
    inline: true,
    cell: (absence) => (
      <Chip
        size="small"
        color={absence.type === 'urlaub' ? 'primary' : 'default'}
        variant="outlined"
        label={ABSENCE_TYPE_LABELS[absence.type]}
      />
    ),
  },
  {
    key: 'status',
    header: 'Status',
    inline: true,
    cell: (absence) => (
      <Chip
        size="small"
        variant="outlined"
        sx={
          absence.status === 'geplant' ? { borderStyle: 'dashed' } : undefined
        }
        label={ABSENCE_STATUS_LABELS[absence.status]}
      />
    ),
  },
  {
    key: 'days',
    header: 'Urlaubstage',
    align: 'right',
    // Nur Urlaub zählt aufs Konto - bei „frei“/„abwesend“ keine Zahl.
    // Gezeigt wird der Anteil im Jahr (wie im Konto); reicht die
    // Abwesenheit über den Jahreswechsel, steht die Summe darunter.
    cell: (absence) => <AbsenceDaysCell absence={absence} />,
    cardCell: (absence) => <AbsenceDaysCell absence={absence} unit />,
  },
  {
    key: 'note',
    header: 'Notiz',
    cell: (absence) => absence.note ?? '–',
  },
]

function AbsenceDaysCell({
  absence,
  unit = false,
}: {
  absence: ProfileAbsence
  unit?: boolean
}) {
  if (absence.type !== 'urlaub') return <>–</>
  const suffix = unit ? ' Tage' : ''
  return (
    <>
      {formatDays(absence.daysInYear)}
      {suffix}
      {absence.daysInYear !== absence.days && (
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block' }}
        >
          von insgesamt {formatDays(absence.days)}
        </Typography>
      )}
    </>
  )
}

const SHIFT_COLUMNS: ResponsiveColumn<Shift>[] = [
  {
    key: 'date',
    header: 'Tag',
    primary: true,
    cell: (shift) => (
      <Typography variant="body2" fontWeight={600}>
        {formatDateWithWeekday(shift.date)}
      </Typography>
    ),
  },
  {
    key: 'time',
    header: 'Zeit',
    cell: (shift) => `${shift.startTime}–${shift.endTime}`,
  },
  {
    key: 'minutes',
    header: 'Arbeitszeit',
    cell: (shift) =>
      [
        formatMinutes(shift.minutes),
        shift.breakMinutes > 0 ? `${shift.breakMinutes} min Pause` : null,
      ]
        .filter(Boolean)
        .join(' · '),
  },
  {
    key: 'note',
    header: 'Notiz',
    cell: (shift) => shift.note ?? '–',
  },
]

/** Startdatum für eine neue Abwesenheit: heute im laufenden Jahr, sonst 1.1. */
function defaultAbsenceDate(year: number): string {
  const today = new Date()
  const iso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
  return iso.startsWith(`${year}-`) ? iso : `${year}-01-01`
}

/**
 * Bezeichnung-Wert-Liste (`<dl>`): Bezeichnung links in `text.secondary`,
 * Wert rechts; am Handy bricht ein langer Wert um, statt die Seite zu
 * verbreitern.
 */
function DataList({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        columnGap: 2,
        '& > dt, & > dd': {
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
        },
        '& > dt:nth-last-of-type(1), & > dd:nth-last-of-type(1)': {
          borderBottom: 0,
        },
      }}
    >
      {children}
    </Box>
  )
}

function DataRow({
  label,
  value,
  hint,
  testId,
}: {
  label: React.ReactNode
  value: React.ReactNode
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
        sx={{
          m: 0,
          textAlign: 'right',
          overflowWrap: 'anywhere',
          fontVariantNumeric: 'tabular-nums',
        }}
        data-testid={testId}
      >
        {value}
      </Typography>
    </>
  )
}

function MasterData({ employee }: { employee: Employee }) {
  return (
    <DataList>
      <DataRow label="Bereich" value={AREA_LABELS[employee.area]} />
      <DataRow
        label="Beschäftigung"
        value={
          employee.employmentType
            ? EMPLOYMENT_TYPE_LABELS[employee.employmentType]
            : '–'
        }
      />
      <DataRow
        label="Wochenstunden (Soll)"
        value={
          employee.weeklyHours === null ? '–' : formatDays(employee.weeklyHours)
        }
      />
      <DataRow label="Eintritt" value={formatDateDe(employee.entryDate)} />
      <DataRow label="Austritt" value={formatDateDe(employee.exitDate)} />
      <DataRow
        label="Kalenderfarbe"
        value={
          <Box
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
          >
            <ColorDot color={employee.color} size={14} />
            {employee.color ? 'gesetzt' : 'keine'}
          </Box>
        }
      />
      <DataRow
        label="Login"
        value={employee.userId === null ? 'kein Login' : 'verknüpft'}
      />
      {employee.note && <DataRow label="Notiz" value={employee.note} />}
    </DataList>
  )
}

function BalanceView({
  balance,
  year,
}: {
  balance: VacationBalance
  year: number
}) {
  if (balance.status === 'not-employed') {
    return (
      <EmptyState
        title={`In ${year} nicht beschäftigt (Ein-/Austritt) - kein Urlaubskonto.`}
      />
    )
  }
  const noConfig = balance.status === 'no-config'
  const deadline = formatDateDe(balance.carryoverDeadline)
  const proRata =
    balance.status === 'ok' && balance.fullYear === false
      ? `anteilig ${balance.months} von 12 Monaten (Jahresanspruch ${formatDays(
          balance.entitlementDays
        )})`
      : undefined
  return (
    <Stack spacing={2}>
      {noConfig && (
        <Alert severity="info">
          Für {year} ist kein Urlaubsanspruch erfasst - Anspruch und Rest sind
          offen.
        </Alert>
      )}
      <KeyFigures
        variant="plain"
        dense
        aria-label={`Urlaubskonto ${year}`}
        items={[
          {
            label: 'Anspruch',
            value: (
              <span data-testid="balance-entitlement">
                {formatOpenDays(balance.entitlement)}
              </span>
            ),
            hint: proRata,
          },
          {
            label: 'Genommen',
            value: (
              <span data-testid="balance-approved">
                {formatDays(balance.approvedDays)}
              </span>
            ),
            hint: 'genehmigt',
          },
          {
            label: 'Geplant',
            value: (
              <span data-testid="balance-planned">
                {formatDays(balance.plannedDays)}
              </span>
            ),
            hint: 'noch nicht genehmigt',
          },
          {
            label: 'Rest',
            value: (
              <span data-testid="balance-remaining">
                {formatOpenDays(balance.remainingDays)}
              </span>
            ),
            hint: (
              <>
                nach geplantem Urlaub:{' '}
                <span data-testid="balance-remaining-after-planned">
                  {formatOpenDays(balance.remainingAfterPlannedDays)}
                </span>
              </>
            ),
          },
        ]}
      />
      <DataList>
        <DataRow
          label={`Übertrag aus ${year - 1}`}
          hint={
            balance.carryoverDays !== null
              ? `verfällt am ${deadline}, soweit nicht genommen`
              : 'nicht erfasst'
          }
          value={formatDays(balance.carryoverDays)}
          testId="balance-carryover"
        />
        <DataRow
          label="Verfallen"
          hint={
            balance.carryoverOpen !== null && balance.carryoverOpen > 0
              ? `${formatDays(
                  balance.carryoverOpen
                )} Tage Übertrag noch bis ${deadline}`
              : `Übertrag, nicht bis ${deadline} genommen`
          }
          value={formatDays(balance.carryoverExpired)}
          testId="balance-expired"
        />
      </DataList>
    </Stack>
  )
}

function EntitlementList({
  rows,
  onEdit,
}: {
  rows: Entitlement[]
  onEdit: (row: Entitlement) => void
}) {
  return (
    <DataList>
      {rows.map((row) => (
        <DataRow
          key={row.year}
          label={`${row.year}: ${formatOpenDays(row.entitlementDays)} Tage`}
          hint={
            row.carryoverDays === null
              ? 'Übertrag nicht erfasst'
              : `Übertrag ${formatDays(row.carryoverDays)} Tage`
          }
          value={
            <IconButton
              aria-label={`Anspruch ${row.year} bearbeiten`}
              onClick={() => onEdit(row)}
              sx={{ my: -0.5 }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          }
        />
      ))}
    </DataList>
  )
}

/** Jahresanspruch und Übertrag eines Jahres; leer = offen (`null`). */
function EntitlementDialog({
  employeeId,
  year,
  row,
  onClose,
  onDone,
}: {
  employeeId: number
  year: number
  row: Entitlement | null
  onClose: () => void
  onDone: () => void
}) {
  const fullScreen = useFullScreenDialog()
  const [entitlement, setEntitlement] = React.useState(
    numberToInput(row?.entitlementDays)
  )
  const [carryover, setCarryover] = React.useState(
    numberToInput(row?.carryoverDays)
  )
  const entitlementDays = parseDaysInput(entitlement)
  const carryoverDays = parseDaysInput(carryover)
  const entitlementInvalid = Number.isNaN(entitlementDays)
  const carryoverInvalid = Number.isNaN(carryoverDays)
  const unchanged =
    row !== null &&
    row.entitlementDays === entitlementDays &&
    row.carryoverDays === carryoverDays
  const { busy, error, submit } = useSubmit(
    () => saveEntitlement(employeeId, year, { entitlementDays, carryoverDays }),
    onDone
  )
  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      fullScreen={fullScreen}
    >
      <form
        onSubmit={(e) => {
          if (unchanged) {
            e.preventDefault()
            onClose()
            return
          }
          void submit(e)
        }}
        noValidate
      >
        <DialogTitle>Urlaubsanspruch {year}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Jahresanspruch (Tage)"
              value={entitlement}
              onChange={(e) => setEntitlement(e.target.value)}
              inputProps={{ inputMode: 'decimal' }}
              error={entitlementInvalid}
              helperText={
                entitlementInvalid
                  ? 'Eine Zahl von 0 bis 365, höchstens zwei Nachkommastellen.'
                  : 'Voller Anspruch für das ganze Jahr; bei Ein- oder Austritt im Jahr rechnet die App anteilig. Leer = offen.'
              }
              autoFocus
            />
            <TextField
              label={`Übertrag aus ${year - 1} (Tage)`}
              value={carryover}
              onChange={(e) => setCarryover(e.target.value)}
              inputProps={{ inputMode: 'decimal' }}
              error={carryoverInvalid}
              helperText={
                carryoverInvalid
                  ? 'Eine Zahl von 0 bis 365, höchstens zwei Nachkommastellen.'
                  : `Verfällt am 31.03.${year}, soweit nicht genommen. Leer = kein Übertrag erfasst.`
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || entitlementInvalid || carryoverInvalid}
          >
            Speichern
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
