'use client'
import React from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  createShift,
  updateShift,
  type DienstplanWarning,
  type Employee,
  type Shift,
  type ShiftInput,
  type ShiftTemplate,
} from '../../../lib/dienstplanApi'
import { TOUCH_MEDIA } from '../../../lib/muiTheme'
import { useFullScreenDialog, useSubmit } from './AbsenceDialog'

/** Uhrzeit `HH:MM` (nur Bedienführung - die API prüft die Regeln). */
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Pause lesen: leer = 0, sonst ganze Minuten 0-999; `NaN` = ungültig. */
export function parseBreak(text: string): number {
  const t = text.trim()
  if (t === '') return 0
  return /^\d{1,3}$/.test(t) ? Number(t) : NaN
}

/**
 * Schicht anlegen oder ändern (alle Bereiche): eine Schichtvorlage füllt die
 * Zeiten, die sich danach frei ändern lassen. Beim Ändern geht nur, was sich
 * geändert hat, an die API. Überschneidungen mit anderen Schichten lehnt die
 * API ab (Meldung im Dialog); eine Abwesenheit oder ein geschlossener Tag
 * kommt als Hinweis zurück.
 */
export default function ShiftDialog({
  employee,
  date,
  shift,
  templates,
  templatesError = null,
  onClose,
  onDone,
  onDelete,
}: {
  employee: Employee
  date: string
  shift: Shift | null
  templates: readonly ShiftTemplate[]
  /** Laden der Vorlagen gescheitert - dann nicht „keine Vorlagen“ sagen. */
  templatesError?: string | null
  onClose: () => void
  onDone: (warnings: DienstplanWarning[]) => void
  onDelete?: () => void
}) {
  const fullScreen = useFullScreenDialog()
  const [day, setDay] = React.useState(shift?.date ?? date)
  const [startTime, setStartTime] = React.useState(shift?.startTime ?? '')
  const [endTime, setEndTime] = React.useState(shift?.endTime ?? '')
  const [breakText, setBreakText] = React.useState(
    shift ? String(shift.breakMinutes) : ''
  )
  const [note, setNote] = React.useState(shift?.note ?? '')
  const [templateId, setTemplateId] = React.useState<number | null>(null)

  const breakMinutes = parseBreak(breakText)
  const breakInvalid = Number.isNaN(breakMinutes)
  const startValid = TIME.test(startTime)
  const endValid = TIME.test(endTime)
  // Nur Bedienführung - die Regeln (keine Schicht über Mitternacht) prüft die API.
  const endNotAfterStart = startValid && endValid && endTime <= startTime

  const input: ShiftInput = {
    date: day,
    startTime,
    endTime,
    breakMinutes: breakInvalid ? 0 : breakMinutes,
    note: note.trim() || null,
  }
  const changes: ShiftInput = shift
    ? (Object.fromEntries(
        Object.entries(input).filter(
          ([key, value]) =>
            (shift as unknown as Record<string, unknown>)[key] !== value
        )
      ) as ShiftInput)
    : { employeeId: employee.id, ...input }
  const invalid =
    !day ||
    !startValid ||
    !endValid ||
    endNotAfterStart ||
    breakInvalid ||
    (shift !== null && Object.keys(changes).length === 0)

  const { busy, error, submit } = useSubmit(
    () => (shift ? updateShift(shift.id, changes) : createShift(changes)),
    (result) => onDone(result.warnings)
  )

  const applyTemplate = (template: ShiftTemplate) => {
    setTemplateId(template.id)
    setStartTime(template.startTime)
    setEndTime(template.endTime)
    setBreakText(String(template.breakMinutes))
  }

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
          {shift ? 'Schicht bearbeiten' : 'Schicht anlegen'} –{' '}
          {employee.displayName}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Datum"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
            />
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
                id="shift-template-label"
                sx={{ mb: 0.5 }}
              >
                Schichtvorlage
              </Typography>
              {templatesError ? (
                <Typography variant="body2" color="error">
                  {templatesError}
                </Typography>
              ) : templates.length === 0 ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Keine Schichtvorlagen - Zeiten frei eintragen.
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Vorlagen wie „Früh“ anlegen: „Schichtvorlagen“ oben im
                    Dienstplan.
                  </Typography>
                </>
              ) : (
                <Box
                  role="group"
                  aria-labelledby="shift-template-label"
                  sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
                >
                  {templates.map((t) => (
                    <Chip
                      key={t.id}
                      label={`${t.name} ${t.startTime}–${t.endTime}`}
                      color={templateId === t.id ? 'primary' : 'default'}
                      variant={templateId === t.id ? 'filled' : 'outlined'}
                      onClick={() => applyTemplate(t)}
                      // Schnelleingabe am Tablet: Touch-Ziel 44 px (Layout-Kit)
                      sx={{ [TOUCH_MEDIA]: { minHeight: 44 } }}
                    />
                  ))}
                </Box>
              )}
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Beginn"
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value)
                  setTemplateId(null)
                }}
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: 300 }}
                required
                fullWidth
              />
              <TextField
                label="Ende"
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value)
                  setTemplateId(null)
                }}
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: 300 }}
                error={endNotAfterStart}
                helperText={
                  endNotAfterStart
                    ? 'Ende nach Beginn, am selben Tag.'
                    : 'Keine Schicht über Mitternacht.'
                }
                required
                fullWidth
              />
              <TextField
                label="Pause (min)"
                value={breakText}
                onChange={(e) => setBreakText(e.target.value)}
                inputProps={{ inputMode: 'numeric' }}
                error={breakInvalid}
                helperText={breakInvalid ? 'Ganze Minuten.' : 'leer = 0'}
                fullWidth
              />
            </Stack>
            <TextField
              label="Notiz (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              inputProps={{ maxLength: 500 }}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          {shift && onDelete && (
            <Button color="error" onClick={onDelete} sx={{ mr: 'auto' }}>
              Löschen
            </Button>
          )}
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="contained" disabled={busy || invalid}>
            {shift ? 'Speichern' : 'Anlegen'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
