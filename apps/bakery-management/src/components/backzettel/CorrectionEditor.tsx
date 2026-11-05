'use client'

import React from 'react'
import { Alert, Box, Button, Stack, TextField } from '@mui/material'
import type { BackzettelLine } from '../../lib/backzettelApi'
import {
  formatNumber,
  isIntegerUnit,
  parseDecimal,
} from '../../lib/backzettelFormat'

export interface CorrectionEditorProps {
  line: BackzettelLine
  label: string
  /** Speichert; wirft bei Fehlern (deutsche `message` der API). */
  onSave: (correction: number, reason: string | null) => Promise<void>
  onCancel: () => void
  /** Eindeutiger Präfix, weil Tabelle und Kartenliste beide gerendert sind. */
  idPrefix: string
}

/**
 * Korrektur einer Zeile direkt in der Zeile: Menge (+/−) und Grund. Ein Wert
 * ≠ 0 braucht einen Grund (die API lehnt sonst mit `reason_required` ab),
 * 0 löscht die Korrektur. Geprüft wird hier nur, was man sofort sehen soll;
 * das letzte Wort hat der Server.
 */
export function CorrectionEditor({
  line,
  label,
  onSave,
  onCancel,
  idPrefix,
}: CorrectionEditorProps) {
  const [value, setValue] = React.useState(
    line.correction ? formatNumber(line.correction) : ''
  )
  const [reason, setReason] = React.useState(line.correctionReason ?? '')
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault()
    const raw = value.trim()
    const correction = raw === '' ? 0 : parseDecimal(raw)
    if (!Number.isFinite(correction)) {
      setError('Bitte eine Zahl eingeben, z. B. 5 oder -3.')
      return
    }
    if (isIntegerUnit(line.unit) && !Number.isInteger(correction)) {
      setError(
        `Korrekturen in ${line.unit || 'Stück'} müssen ganze Zahlen sein.`
      )
      return
    }
    if (correction !== 0 && !reason.trim()) {
      setError('Für eine Korrektur ist ein Grund nötig.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(correction, correction === 0 ? null : reason.trim())
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Die Korrektur konnte nicht gespeichert werden.'
      )
      setSaving(false)
    }
  }

  return (
    <Box
      component="form"
      onSubmit={submit}
      aria-label={`Korrektur ${label}`}
      data-testid={`${idPrefix}-correction-editor-${line.key}`}
      sx={{ py: 1 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
      >
        <TextField
          id={`${idPrefix}-correction-${line.key}`}
          label="Korrektur (+/−)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputProps={{
            inputMode: isIntegerUnit(line.unit) ? 'numeric' : 'decimal',
            'aria-label': 'Korrektur',
          }}
          helperText={
            isIntegerUnit(line.unit) ? 'ganze Zahl, 0 löscht' : '0 löscht'
          }
          sx={{ width: { xs: '100%', sm: 160 } }}
          autoFocus
        />
        <TextField
          id={`${idPrefix}-reason-${line.key}`}
          label="Grund"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          inputProps={{ maxLength: 500, 'aria-label': 'Grund' }}
          helperText="Pflicht, wenn die Korrektur nicht 0 ist"
          sx={{ flex: 1, minWidth: 0 }}
        />
        <Stack direction="row" spacing={1} sx={{ pt: { sm: 0.5 } }}>
          <Button
            type="submit"
            variant="contained"
            disabled={saving}
            sx={{ minHeight: 44 }}
          >
            Speichern
          </Button>
          <Button onClick={onCancel} disabled={saving} sx={{ minHeight: 44 }}>
            Abbrechen
          </Button>
        </Stack>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 1 }} role="alert">
          {error}
        </Alert>
      )}
    </Box>
  )
}

export default CorrectionEditor
