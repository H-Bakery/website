'use client'
import React from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  ArrowBack as BackIcon,
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
  type DienstplanWarning,
  type Employee,
  type EmployeeProfile,
  type Entitlement,
  type VacationBalance,
} from '../../../../../lib/dienstplanApi'
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

/**
 * Profil eines Mitarbeiters (TASK-042, nur Inhaber mit persönlicher
 * Sitzung): Stammdaten (bearbeiten, ausscheiden / wieder aktivieren),
 * Urlaubskonto des gewählten Jahres, Anspruch je Jahr, Abwesenheiten des
 * Jahres (anlegen, ändern, löschen) und die kommenden Schichten.
 *
 * Alle Zahlen des Kontos kommen fertig aus der API (`vacation.core.js`);
 * fehlt der Anspruch, steht „offen“ - nie 0.
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
    return loadError ? (
      <Box>
        <BackLink />
        <Alert severity="error">{loadError}</Alert>
      </Box>
    ) : (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Profil wird geladen" />
      </Box>
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
    <Box>
      <BackLink />
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ColorDot color={employee.color} size={20} />
          <Box>
            <Typography variant="h4" component="h1">
              {employee.displayName}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
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
            </Stack>
          </Box>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            component={Link}
            href={`/admin/dienstplan?bereich=${employee.area}`}
            variant="outlined"
            startIcon={<CalendarIcon />}
          >
            Im Kalender
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setDialog({ kind: 'employee' })}
          >
            Bearbeiten
          </Button>
          <Button
            variant="outlined"
            color={employee.active ? 'warning' : 'primary'}
            onClick={() => void toggleActive()}
          >
            {employee.active ? 'Ausscheiden' : 'Wieder aktivieren'}
          </Button>
        </Stack>
      </Box>

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

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          alignItems: 'start',
        }}
      >
        <MasterData employee={employee} />

        <Section
          title={`Urlaubskonto ${shownYear}`}
          action={
            <Stack direction="row" alignItems="center">
              <IconButton
                aria-label="Vorheriges Jahr"
                onClick={() => setYear(shownYear - 1)}
                disabled={shownYear <= 2000}
              >
                <PrevIcon />
              </IconButton>
              <IconButton
                aria-label="Nächstes Jahr"
                onClick={() => setYear(shownYear + 1)}
                disabled={shownYear >= 2100}
              >
                <NextIcon />
              </IconButton>
            </Stack>
          }
        >
          <BalanceView balance={balance} year={shownYear} />
          <Button
            size="small"
            startIcon={<EditIcon />}
            sx={{ mt: 1 }}
            onClick={() =>
              setDialog({ kind: 'entitlement', year: shownYear, row: yearRow })
            }
          >
            Anspruch und Übertrag {shownYear}
          </Button>
          {profile.entitlements.length > 0 && (
            <EntitlementList
              rows={profile.entitlements}
              onEdit={(row) =>
                setDialog({ kind: 'entitlement', year: row.year, row })
              }
            />
          )}
        </Section>

        <Section
          title={`Abwesenheiten ${shownYear}`}
          action={
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setDialog({ kind: 'absence', absence: null })}
            >
              Eintragen
            </Button>
          }
        >
          {profile.absences.length === 0 ? (
            <Typography color="text.secondary">
              Keine Abwesenheiten in {shownYear}.
            </Typography>
          ) : (
            <List disablePadding aria-label={`Abwesenheiten ${shownYear}`}>
              {profile.absences.map((absence, index) => (
                <ListItem
                  key={absence.id}
                  divider={index < profile.absences.length - 1}
                  disableGutters
                  data-testid={`absence-${absence.id}`}
                  secondaryAction={
                    <Box sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Bearbeiten">
                        <IconButton
                          aria-label={`Abwesenheit ${formatAbsenceRange(
                            absence
                          )} bearbeiten`}
                          onClick={() =>
                            setDialog({ kind: 'absence', absence })
                          }
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
                    </Box>
                  }
                  sx={{ pr: 12 }}
                >
                  <ListItemText
                    primary={
                      <Box
                        component="span"
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 1,
                          alignItems: 'center',
                        }}
                      >
                        <span>{formatAbsenceRange(absence)}</span>
                        <Chip
                          size="small"
                          color={
                            absence.type === 'urlaub' ? 'primary' : 'default'
                          }
                          variant="outlined"
                          label={ABSENCE_TYPE_LABELS[absence.type]}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          sx={
                            absence.status === 'geplant'
                              ? { borderStyle: 'dashed' }
                              : undefined
                          }
                          label={ABSENCE_STATUS_LABELS[absence.status]}
                        />
                      </Box>
                    }
                    secondary={[
                      absence.type === 'urlaub'
                        ? `${formatDays(absence.days)} Urlaubstage`
                        : null,
                      absence.note,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Section>

        <Section title="Kommende Schichten">
          {employee.area !== 'verkauf' &&
          profile.upcomingShifts.length === 0 ? (
            <Typography color="text.secondary">
              Schichten gibt es nur im Verkauf.
            </Typography>
          ) : profile.upcomingShifts.length === 0 ? (
            <Typography color="text.secondary">
              Keine Schichten geplant.
            </Typography>
          ) : (
            <List disablePadding aria-label="Kommende Schichten">
              {profile.upcomingShifts.map((shift, index) => (
                <ListItem
                  key={shift.id}
                  divider={index < profile.upcomingShifts.length - 1}
                  disableGutters
                >
                  <ListItemText
                    primary={`${formatDateWithWeekday(shift.date)}, ${
                      shift.startTime
                    }–${shift.endTime}`}
                    secondary={[
                      formatMinutes(shift.minutes),
                      shift.breakMinutes > 0
                        ? `${shift.breakMinutes} min Pause`
                        : null,
                      shift.note,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Section>
      </Box>

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
    </Box>
  )
}

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

function BackLink() {
  return (
    <Button
      component={Link}
      href="/admin/dienstplan/mitarbeiter"
      startIcon={<BackIcon />}
      size="small"
      sx={{ mb: 2 }}
    >
      Alle Mitarbeiter
    </Button>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Paper variant="outlined" component="section" sx={{ p: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </Paper>
  )
}

/** Zeile „Bezeichnung - Wert“, auf dem Handy untereinander. */
function Field({
  label,
  value,
  hint,
  testId,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  testId?: string
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 2,
        py: 0.75,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Box>
        <Typography variant="body2">{label}</Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </Box>
      <Typography
        variant="body2"
        fontWeight={600}
        sx={{ textAlign: 'right', overflowWrap: 'anywhere' }}
        data-testid={testId}
      >
        {value}
      </Typography>
    </Box>
  )
}

function MasterData({ employee }: { employee: Employee }) {
  return (
    <Section title="Stammdaten">
      <Field label="Bereich" value={AREA_LABELS[employee.area]} />
      <Field
        label="Beschäftigung"
        value={
          employee.employmentType
            ? EMPLOYMENT_TYPE_LABELS[employee.employmentType]
            : '–'
        }
      />
      <Field
        label="Wochenstunden (Soll)"
        value={
          employee.weeklyHours === null ? '–' : formatDays(employee.weeklyHours)
        }
      />
      <Field label="Eintritt" value={formatDateDe(employee.entryDate)} />
      <Field label="Austritt" value={formatDateDe(employee.exitDate)} />
      <Field
        label="Login"
        value={employee.userId === null ? 'kein Login' : 'verknüpft'}
      />
      {employee.note && <Field label="Notiz" value={employee.note} />}
    </Section>
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
      <Alert severity="info">
        In {year} nicht beschäftigt (Ein-/Austritt) - kein Urlaubskonto.
      </Alert>
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
    <Box>
      {noConfig && (
        <Alert severity="info" sx={{ mb: 1 }}>
          Für {year} ist kein Urlaubsanspruch erfasst - Anspruch und Rest sind
          offen.
        </Alert>
      )}
      <Field
        label="Anspruch"
        hint={proRata}
        value={formatOpenDays(balance.entitlement)}
        testId="balance-entitlement"
      />
      <Field
        label={`Übertrag aus ${year - 1}`}
        hint={
          balance.carryoverDays !== null
            ? `verfällt am ${deadline}, soweit nicht genommen`
            : 'nicht erfasst'
        }
        value={formatDays(balance.carryoverDays)}
        testId="balance-carryover"
      />
      <Field
        label="Genommen"
        hint="genehmigter Urlaub im Jahr"
        value={formatDays(balance.approvedDays)}
        testId="balance-approved"
      />
      <Field
        label="Geplant"
        hint="noch nicht genehmigt"
        value={formatDays(balance.plannedDays)}
        testId="balance-planned"
      />
      <Field
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
      <Field
        label="Rest"
        value={formatOpenDays(balance.remainingDays)}
        testId="balance-remaining"
      />
      <Field
        label="Rest nach geplantem Urlaub"
        value={formatOpenDays(balance.remainingAfterPlannedDays)}
        testId="balance-remaining-after-planned"
      />
    </Box>
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
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" component="h3">
        Anspruch je Jahr
      </Typography>
      <List dense disablePadding aria-label="Anspruch je Jahr">
        {rows.map((row) => (
          <ListItem
            key={row.year}
            disableGutters
            secondaryAction={
              <IconButton
                edge="end"
                aria-label={`Anspruch ${row.year} bearbeiten`}
                onClick={() => onEdit(row)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemText
              primary={`${row.year}: ${formatOpenDays(
                row.entitlementDays
              )} Tage`}
              secondary={
                row.carryoverDays === null
                  ? 'Übertrag nicht erfasst'
                  : `Übertrag ${formatDays(row.carryoverDays)} Tage`
              }
            />
          </ListItem>
        ))}
      </List>
    </Box>
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
