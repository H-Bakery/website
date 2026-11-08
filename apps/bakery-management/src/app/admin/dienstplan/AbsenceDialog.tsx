'use client'
import React from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  ABSENCE_STATUSES,
  ABSENCE_STATUS_LABELS,
  ABSENCE_TYPES,
  ABSENCE_TYPE_LABELS,
  createAbsence,
  updateAbsence,
  type Absence,
  type AbsenceInput,
  type AbsenceStatus,
  type AbsenceType,
  type DienstplanWarning,
} from '../../../lib/dienstplanApi'
import { messageOf } from './mitarbeiter/EmployeeDialog'

/**
 * Formular abschicken mit Ladezustand und deutscher Fehlermeldung der API
 * (Dialoge im Profil und im Kalender).
 */
export function useSubmit<T>(
  action: () => Promise<T>,
  onDone: (result: T) => void
) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onDone(await action())
    } catch (err) {
      setError(messageOf(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, submit }
}

/** Dialoge auf dem Telefon bildschirmfüllend. */
export function useFullScreenDialog(): boolean {
  const theme = useTheme()
  return useMediaQuery(theme.breakpoints.down('sm'))
}

/**
 * Abwesenheit eintragen oder ändern: Art, Status, Zeitraum (ganze Tage,
 * halber Tag nur für einen Tag), Notiz. Überschneidungen mit Schichten
 * meldet die API als Hinweis, nicht als Fehler. Mit `onDelete` steht beim
 * Bearbeiten „Löschen“ im Dialog (Kalender); `employeeName` nennt die Person
 * im Titel, wenn der Dialog nicht auf ihrem Profil steht.
 */
export default function AbsenceDialog({
  employeeId,
  absence,
  defaultDate,
  employeeName,
  onClose,
  onDone,
  onDelete,
}: {
  employeeId: number
  absence: Absence | null
  defaultDate: string
  employeeName?: string
  onClose: () => void
  onDone: (warnings: DienstplanWarning[]) => void
  onDelete?: () => void
}) {
  const fullScreen = useFullScreenDialog()
  const [type, setType] = React.useState<AbsenceType>(absence?.type ?? 'urlaub')
  const [status, setStatus] = React.useState<AbsenceStatus>(
    absence?.status ?? 'geplant'
  )
  const [startDate, setStartDate] = React.useState(
    absence?.startDate ?? defaultDate
  )
  const [endDate, setEndDate] = React.useState(
    absence?.endDate ?? absence?.startDate ?? defaultDate
  )
  const [halfDay, setHalfDay] = React.useState(absence?.halfDay ?? false)
  const [note, setNote] = React.useState(absence?.note ?? '')

  const singleDay = !!startDate && startDate === endDate
  const endBeforeStart = !!startDate && !!endDate && endDate < startDate
  const input: AbsenceInput = {
    type,
    status,
    startDate,
    endDate: endDate || startDate,
    halfDay: singleDay && halfDay,
    note: note.trim() || null,
  }
  const changes: AbsenceInput = absence
    ? (Object.fromEntries(
        Object.entries(input).filter(
          ([key, value]) =>
            (absence as unknown as Record<string, unknown>)[key] !== value
        )
      ) as AbsenceInput)
    : { employeeId, ...input }
  const invalid =
    !startDate ||
    endBeforeStart ||
    (absence !== null && Object.keys(changes).length === 0)

  const { busy, error, submit } = useSubmit(
    () =>
      absence ? updateAbsence(absence.id, changes) : createAbsence(changes),
    (result) => onDone(result.warnings)
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
          {absence ? 'Abwesenheit bearbeiten' : 'Abwesenheit eintragen'}
          {employeeName ? ` – ${employeeName}` : ''}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Art"
                value={type}
                onChange={(e) => setType(e.target.value as AbsenceType)}
                helperText="Nur Urlaub zählt aufs Urlaubskonto."
                fullWidth
              >
                {ABSENCE_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {ABSENCE_TYPE_LABELS[t]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AbsenceStatus)}
                helperText=" "
                fullWidth
              >
                {ABSENCE_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {ABSENCE_STATUS_LABELS[s]}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Von"
                type="date"
                value={startDate}
                onChange={(e) => {
                  const next = e.target.value
                  // Bis folgt dem Von, solange es ein einzelner Tag war.
                  if (!endDate || endDate === startDate || endDate < next) {
                    setEndDate(next)
                  }
                  setStartDate(next)
                }}
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
              />
              <TextField
                label="Bis"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                error={endBeforeStart}
                helperText={endBeforeStart ? 'Liegt vor dem Beginn.' : ' '}
                fullWidth
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={singleDay && halfDay}
                  onChange={(e) => setHalfDay(e.target.checked)}
                  disabled={!singleDay}
                />
              }
              label={
                singleDay
                  ? 'Halber Tag (zählt 0,5)'
                  : 'Halber Tag - nur für einen einzelnen Tag'
              }
            />
            <TextField
              label="Notiz (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              inputProps={{ maxLength: 500 }}
              multiline
              minRows={2}
              helperText="Keine Gesundheitsangaben oder Gründe einer Krankheit eintragen."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          {absence && onDelete && (
            <Button color="error" onClick={onDelete} sx={{ mr: 'auto' }}>
              Löschen
            </Button>
          )}
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="contained" disabled={busy || invalid}>
            {absence ? 'Speichern' : 'Eintragen'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
