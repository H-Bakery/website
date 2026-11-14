'use client'
import React from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { Check as CheckIcon } from '@mui/icons-material'
import {
  AREAS,
  AREA_LABELS,
  EMPLOYEE_COLORS,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  createEmployee,
  employeeChanges,
  numberToInput,
  parseHoursInput,
  parseWageInput,
  updateEmployee,
  wageToInput,
  type Area,
  type Employee,
  type EmployeeInput,
  type EmploymentType,
} from '../../../../lib/dienstplanApi'
import { fetchUsers, type AdminUser } from '../../../../lib/authApi'
import { TOUCH_MEDIA } from '../../../../lib/muiTheme'

export function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Farbpunkt eines Mitarbeiters (Kalenderfarbe); ohne Farbe ein Ring. */
export function ColorDot({
  color,
  size = 12,
}: {
  color: string | null
  size?: number
}) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        bgcolor: color ?? 'transparent',
        border: 1,
        borderColor: color ?? 'divider',
      }}
    />
  )
}

/**
 * Mitarbeiter anlegen (`employee` fehlt) oder Stammdaten ändern. Beim Ändern
 * geht nur, was sich wirklich geändert hat, an die API (PATCH ohne Änderung
 * wird gar nicht erst geschickt). Die Regeln (Ein-/Austritt, Login schon
 * verknüpft, Einträge außerhalb der Beschäftigung) prüft die API; ihre
 * deutsche Meldung steht im Dialog.
 */
export default function EmployeeDialog({
  employee,
  onClose,
  onDone,
}: {
  employee?: Employee
  onClose: () => void
  onDone: (employee: Employee) => void
}) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [displayName, setDisplayName] = React.useState(
    employee?.displayName ?? ''
  )
  const [area, setArea] = React.useState<Area>(employee?.area ?? 'verkauf')
  const [employmentType, setEmploymentType] = React.useState<
    EmploymentType | ''
  >(employee?.employmentType ?? '')
  const [hours, setHours] = React.useState(numberToInput(employee?.weeklyHours))
  const [wage, setWage] = React.useState(wageToInput(employee?.hourlyWageCents))
  const [entryDate, setEntryDate] = React.useState(employee?.entryDate ?? '')
  const [exitDate, setExitDate] = React.useState(employee?.exitDate ?? '')
  const [color, setColor] = React.useState<string | null>(
    employee?.color ?? null
  )
  const [userId, setUserId] = React.useState<number | ''>(
    employee?.userId ?? ''
  )
  const [note, setNote] = React.useState(employee?.note ?? '')
  const [users, setUsers] = React.useState<AdminUser[] | null>(null)
  // Logins nicht geladen ist nicht „keine Logins“: das Feld bleibt gesperrt
  // und sagt es; die Verknüpfung bleibt dann, wie sie ist.
  const [usersError, setUsersError] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetchUsers().then(
      (list) => {
        if (!cancelled) setUsers(list)
      },
      () => {
        if (!cancelled) setUsersError(true)
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  const weeklyHours = parseHoursInput(hours)
  const hoursInvalid = Number.isNaN(weeklyHours)
  const hourlyWageCents = parseWageInput(wage)
  const wageInvalid = Number.isNaN(hourlyWageCents)
  const exitBeforeEntry = !!entryDate && !!exitDate && exitDate < entryDate
  const input: EmployeeInput = {
    displayName: displayName.trim(),
    area,
    employmentType: employmentType || null,
    weeklyHours: hoursInvalid ? null : weeklyHours,
    hourlyWageCents: wageInvalid ? null : hourlyWageCents,
    entryDate: entryDate || null,
    exitDate: exitDate || null,
    color,
    userId: userId === '' ? null : userId,
    note: note.trim() || null,
  }
  const changes = employee ? employeeChanges(employee, input) : input
  const invalid =
    !displayName.trim() ||
    hoursInvalid ||
    wageInvalid ||
    exitBeforeEntry ||
    (!!employee && Object.keys(changes).length === 0)

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (invalid) return
    setBusy(true)
    setError(null)
    try {
      onDone(
        employee
          ? await updateEmployee(employee.id, changes)
          : await createEmployee(input)
      )
    } catch (err) {
      setError(messageOf(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setBusy(false)
    }
  }

  // Ein deaktivierter Login bleibt auswählbar, wenn er schon verknüpft ist.
  const userOptions = (users ?? []).filter(
    (u) => u.active || u.id === employee?.userId
  )

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
    >
      <form onSubmit={submit} noValidate>
        <DialogTitle>
          {employee
            ? `${employee.displayName} bearbeiten`
            : 'Neuer Mitarbeiter'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Name"
              helperText="So steht die Person im Dienstplan"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              inputProps={{ maxLength: 80 }}
              required
              autoFocus
            />
            <TextField
              select
              label="Bereich"
              value={area}
              onChange={(e) => setArea(e.target.value as Area)}
              helperText="Alle Bereiche haben Schichten, Urlaub und Abwesenheiten; die Besetzung im Kalender zählt nur den Verkauf."
            >
              {AREAS.map((a) => (
                <MenuItem key={a} value={a}>
                  {AREA_LABELS[a]}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Beschäftigung"
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(e.target.value as EmploymentType | '')
                }
                helperText={
                  employmentType === 'minijob'
                    ? 'Lohnkosten des Monats werden gegen die Minijob-Grenze geprüft'
                    : undefined
                }
                fullWidth
              >
                <MenuItem value="">
                  <em>offen</em>
                </MenuItem>
                {EMPLOYMENT_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {EMPLOYMENT_TYPE_LABELS[t]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Wochenstunden (Soll)"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                inputProps={{ inputMode: 'decimal' }}
                error={hoursInvalid}
                helperText={hoursInvalid ? 'Eine Zahl von 0 bis 60.' : ' '}
                fullWidth
              />
            </Stack>
            <TextField
              label="Stundenlohn brutto (€, optional)"
              value={wage}
              onChange={(e) => setWage(e.target.value)}
              inputProps={{ inputMode: 'decimal' }}
              placeholder="z. B. 13,90"
              error={wageInvalid}
              helperText={
                wageInvalid
                  ? 'Ein Betrag von 0,01 bis 999,99 € (z. B. 13,90).'
                  : 'Nur für die geschätzte Überstundenbezahlung im Dienstplan - nur du siehst ihn. Leer = offen.'
              }
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Eintritt"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="optional"
                fullWidth
              />
              <TextField
                label="Austritt"
                type="date"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                error={exitBeforeEntry}
                helperText={
                  exitBeforeEntry ? 'Liegt vor dem Eintritt.' : 'optional'
                }
                fullWidth
              />
            </Stack>
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
                id="employee-color-label"
                sx={{ mb: 0.5 }}
              >
                Farbe im Kalender
              </Typography>
              <Box
                role="radiogroup"
                aria-labelledby="employee-color-label"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
              >
                <Button
                  size="small"
                  variant={color === null ? 'contained' : 'outlined'}
                  role="radio"
                  aria-checked={color === null}
                  onClick={() => setColor(null)}
                >
                  Keine
                </Button>
                {EMPLOYEE_COLORS.map((c) => (
                  <Tooltip key={c} title={c}>
                    <Box
                      component="button"
                      type="button"
                      role="radio"
                      aria-checked={color === c}
                      aria-label={`Farbe ${c}`}
                      onClick={() => setColor(c)}
                      sx={{
                        width: 36,
                        height: 36,
                        // eigene klickbare Fläche: auf Touch 44 px
                        [TOUCH_MEDIA]: { minWidth: 44, minHeight: 44 },
                        borderRadius: '50%',
                        bgcolor: c,
                        border: 2,
                        borderColor:
                          color === c ? 'text.primary' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 0,
                      }}
                    >
                      {color === c && (
                        <CheckIcon
                          fontSize="small"
                          sx={{ color: theme.palette.getContrastText(c) }}
                        />
                      )}
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            </Box>
            <TextField
              select
              label="Login (optional)"
              value={userId}
              onChange={(e) =>
                setUserId(e.target.value === '' ? '' : Number(e.target.value))
              }
              disabled={users === null}
              error={usersError}
              helperText={
                usersError
                  ? 'Logins konnten nicht geladen werden - Verknüpfung bleibt unverändert.'
                  : 'Verknüpft die Person mit ihrem Benutzerkonto - nicht nötig, wenn sie keinen Login hat.'
              }
            >
              <MenuItem value="">
                <em>kein Login</em>
              </MenuItem>
              {/* Liste (noch) nicht da: eine bestehende Verknüpfung nicht als
                  „kein Login“ zeigen - sie bleibt beim Speichern erhalten. */}
              {users === null && employee?.userId != null && (
                <MenuItem value={employee.userId}>
                  {usersError
                    ? 'verknüpft (Liste nicht geladen)'
                    : 'verknüpft (Logins werden geladen …)'}
                </MenuItem>
              )}
              {userOptions.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.displayName} ({u.username})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Notiz (nur Inhaber)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              inputProps={{ maxLength: 500 }}
              multiline
              minRows={2}
              helperText="Keine Adresse, Telefonnummer, Bankdaten oder Gesundheitsangaben - die gehören in die Lohnbuchhaltung."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="contained" disabled={busy || invalid}>
            {employee ? 'Speichern' : 'Anlegen'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
