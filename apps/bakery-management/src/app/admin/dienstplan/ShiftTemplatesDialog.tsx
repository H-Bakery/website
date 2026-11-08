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
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material'
import {
  createShiftTemplate,
  deleteShiftTemplate,
  fetchShiftTemplates,
  updateShiftTemplate,
  type ShiftTemplate,
} from '../../../lib/dienstplanApi'
import { ErrorState, LoadingState } from '../../../components/layout'
import { messageOf } from './mitarbeiter/EmployeeDialog'
import { useFullScreenDialog } from './AbsenceDialog'
import { TIME, parseBreak } from './ShiftDialog'

/** Länge des Namens - dieselbe Grenze prüft die API (`MAX_TEMPLATE_NAME`). */
const MAX_NAME = 40

type Draft = Omit<ShiftTemplate, 'id'>

/** Reihenfolge wie `GET /shift-templates`: nach Beginn, dann Name. */
function sortTemplates(list: ShiftTemplate[]): ShiftTemplate[] {
  return [...list].sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) ||
      a.name.localeCompare(b.name, 'de')
  )
}

function describe(t: ShiftTemplate): string {
  return `${t.startTime}–${t.endTime}${
    t.breakMinutes > 0 ? ` · Pause ${t.breakMinutes} min` : ''
  }`
}

/**
 * Schichtvorlagen pflegen (Entscheidung 1 „Vorlagen + frei“, nur Inhaber):
 * Liste, anlegen, ändern, löschen. Eine Vorlage füllt im Schichtdialog die
 * Zeiten vor; ändern oder löschen ändert keine bestehenden Schichten. Die
 * Liste lädt der Dialog selbst frisch; jede Änderung meldet er mit
 * `onChange` an den Kalender, damit der Schichtdialog sie sofort hat.
 * Regeln (Ende nach Beginn, Pause kürzer als die Schicht) prüft die API -
 * ihre deutsche Meldung steht im Dialog.
 */
export default function ShiftTemplatesDialog({
  onClose,
  onChange,
}: {
  onClose: () => void
  onChange: (templates: ShiftTemplate[]) => void
}) {
  const fullScreen = useFullScreenDialog()
  const [templates, setTemplates] = React.useState<ShiftTemplate[] | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<ShiftTemplate | null>(null)
  const [name, setName] = React.useState('')
  const [startTime, setStartTime] = React.useState('')
  const [endTime, setEndTime] = React.useState('')
  const [breakText, setBreakText] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoadError(null)
    try {
      setTemplates(sortTemplates(await fetchShiftTemplates()))
    } catch (err) {
      setLoadError(
        messageOf(err, 'Die Schichtvorlagen konnten nicht geladen werden.')
      )
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const fill = (t: ShiftTemplate | null) => {
    setEditing(t)
    setName(t?.name ?? '')
    setStartTime(t?.startTime ?? '')
    setEndTime(t?.endTime ?? '')
    setBreakText(t ? String(t.breakMinutes) : '')
    setError(null)
  }

  const breakMinutes = parseBreak(breakText)
  const breakInvalid = Number.isNaN(breakMinutes)
  const startValid = TIME.test(startTime)
  const endValid = TIME.test(endTime)
  const endNotAfterStart = startValid && endValid && endTime <= startTime
  const draft: Draft = {
    name: name.trim(),
    startTime,
    endTime,
    breakMinutes: breakInvalid ? 0 : breakMinutes,
  }
  // Beim Ändern nur, was sich geändert hat (kein PATCH ohne Änderung).
  const changes: Partial<Draft> = editing
    ? (Object.fromEntries(
        Object.entries(draft).filter(
          ([key, value]) =>
            (editing as unknown as Record<string, unknown>)[key] !== value
        )
      ) as Partial<Draft>)
    : draft
  const invalid =
    !draft.name ||
    !startValid ||
    !endValid ||
    endNotAfterStart ||
    breakInvalid ||
    (editing !== null && Object.keys(changes).length === 0)

  const apply = (next: ShiftTemplate[]) => {
    const sorted = sortTemplates(next)
    setTemplates(sorted)
    onChange(sorted)
  }

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (invalid || templates === null) return
    setBusy(true)
    setError(null)
    try {
      if (editing) {
        const saved = await updateShiftTemplate(editing.id, changes)
        apply(templates.map((t) => (t.id === saved.id ? saved : t)))
      } else {
        apply([...templates, await createShiftTemplate(draft)])
      }
      fill(null)
    } catch (err) {
      setError(messageOf(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (template: ShiftTemplate) => {
    if (
      templates === null ||
      !window.confirm(
        `Vorlage „${template.name}“ löschen? Bestehende Schichten bleiben, wie sie sind.`
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await deleteShiftTemplate(template.id)
      apply(templates.filter((t) => t.id !== template.id))
      if (editing?.id === template.id) fill(null)
    } catch (err) {
      setError(messageOf(err, 'Löschen fehlgeschlagen.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
    >
      <DialogTitle>Schichtvorlagen</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Eine Vorlage füllt beim Anlegen einer Schicht die Zeiten vor; sie
            bleiben je Schicht änderbar. Ändern oder Löschen einer Vorlage
            ändert keine bestehenden Schichten.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {templates === null ? (
            loadError ? (
              <ErrorState message={loadError} onRetry={() => void load()} />
            ) : (
              <LoadingState dense label="Schichtvorlagen werden geladen …" />
            )
          ) : (
            <>
              {templates.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Noch keine Schichtvorlagen.
                </Typography>
              ) : (
                <List
                  dense
                  disablePadding
                  aria-label="Schichtvorlagen"
                  data-testid="shift-template-list"
                >
                  {templates.map((t, index) => (
                    <ListItem
                      key={t.id}
                      divider={index < templates.length - 1}
                      disableGutters
                      data-testid={`shift-template-${t.id}`}
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Bearbeiten">
                            <IconButton
                              aria-label={`${t.name} bearbeiten`}
                              onClick={() => fill(t)}
                              disabled={busy}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Löschen">
                            <IconButton
                              aria-label={`${t.name} löschen`}
                              onClick={() => void remove(t)}
                              disabled={busy}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      }
                      sx={{ pr: 12 }}
                    >
                      <ListItemText
                        primary={t.name}
                        secondary={describe(t)}
                        primaryTypographyProps={{ fontWeight: 600 }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}

              <Box
                component="form"
                onSubmit={save}
                noValidate
                aria-labelledby="shift-template-form-title"
              >
                <Typography
                  variant="subtitle2"
                  component="h3"
                  id="shift-template-form-title"
                  sx={{ mb: 1.5 }}
                >
                  {editing ? `„${editing.name}“ bearbeiten` : 'Neue Vorlage'}
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    inputProps={{ maxLength: MAX_NAME }}
                    helperText="z. B. Früh, Spät, Samstag"
                    required
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Beginn"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ step: 300 }}
                      required
                      fullWidth
                    />
                    <TextField
                      label="Ende"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ step: 300 }}
                      error={endNotAfterStart}
                      helperText={endNotAfterStart ? 'Ende nach Beginn.' : ' '}
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
                  <Box
                    sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}
                  >
                    {editing && (
                      <Button onClick={() => fill(null)} disabled={busy}>
                        Abbrechen
                      </Button>
                    )}
                    <Button
                      type="submit"
                      variant="outlined"
                      disabled={busy || invalid}
                    >
                      {editing ? 'Vorlage speichern' : 'Vorlage anlegen'}
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Fertig
        </Button>
      </DialogActions>
    </Dialog>
  )
}
