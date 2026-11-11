'use client'

import React from 'react'
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  Stack,
  TextField,
} from '@mui/material'
import type { BackzettelLine } from '../../lib/backzettelApi'
import {
  formatNumber,
  isIntegerUnit,
  parseDecimal,
  toggleSign,
} from '../../lib/backzettelFormat'

export interface CorrectionSaveOptions {
  noneToday?: boolean
}

/** Vorbelegter Grund für die Menge des Tages bei offener Grundmenge. */
export const DAY_AMOUNT_REASON = 'Menge für heute'

export interface CorrectionEditorProps {
  line: BackzettelLine
  label: string
  /**
   * Speichert; wirft bei Fehlern (deutsche `message` der API).
   * `options.noneToday`: „Heute keine“ an einer Zeile mit offener Grundmenge.
   */
  onSave: (
    correction: number,
    reason: string | null,
    options?: CorrectionSaveOptions
  ) => Promise<void>
  onCancel: () => void
  /** Eindeutiger Präfix, weil Tabelle und Kartenliste beide gerendert sind. */
  idPrefix: string
  /**
   * Vorbelegung statt der gespeicherten Korrektur (Z10: „+1 Bruch“ trägt
   * die Korrektur + ein Bruch ein; der Grund bleibt Pflicht).
   */
  initialCorrection?: number
}

/**
 * Korrektur einer Zeile direkt in der Zeile: Menge (+/−) und Grund. Ein Wert
 * ≠ 0 braucht einen Grund (die API lehnt sonst mit `reason_required` ab),
 * 0 löscht die Korrektur. Geprüft wird hier nur, was man sofort sehen soll;
 * das letzte Wort hat der Server.
 *
 * Grundmenge offen (`line.baseUnset`): das Feld ist die **Menge für heute**
 * (kein +/−), der Grund ist vorbelegt, und „Heute keine“ - der Knopf oder
 * eine eingetippte 0 - trägt die Tagesentscheidung „keine“ ein. Ein leeres
 * Feld bzw. „Wieder offen“ nimmt die Entscheidung zurück. Die Grundmenge
 * selbst bleibt offen; gepflegt wird sie unter „Grundmengen“.
 */
export function CorrectionEditor({
  line,
  label,
  onSave,
  onCancel,
  idPrefix,
  initialCorrection,
}: CorrectionEditorProps) {
  const [value, setValue] = React.useState(() => {
    const start =
      initialCorrection !== undefined ? initialCorrection : line.correction
    if (start) return formatNumber(start).replace(/\./g, '')
    // „Heute keine“ steht als 0 im Feld - Speichern behält die Entscheidung
    return line.baseUnset && line.dayDecision === 'none' ? '0' : ''
  })
  const openBase = line.baseUnset === true
  const [reason, setReason] = React.useState(
    line.correctionReason ?? (openBase ? DAY_AMOUNT_REASON : '')
  )
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const run = async (
    correction: number,
    saveReason: string | null,
    options?: CorrectionSaveOptions
  ) => {
    setSaving(true)
    setError(null)
    try {
      if (options) await onSave(correction, saveReason, options)
      else await onSave(correction, saveReason)
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Die Korrektur konnte nicht gespeichert werden.'
      )
      setSaving(false)
    }
  }

  /** „Heute keine“: Grund freiwillig - der vorbelegte zählt nicht. */
  const saveNone = () => {
    const r = reason.trim()
    return run(0, r && r !== DAY_AMOUNT_REASON ? r : null, { noneToday: true })
  }

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault()
    const raw = value.trim()
    const correction = raw === '' ? 0 : parseDecimal(raw)
    if (!Number.isFinite(correction)) {
      setError(
        openBase
          ? 'Bitte eine Zahl eingeben, z. B. 30.'
          : 'Bitte eine Zahl eingeben, z. B. 5 oder -3.'
      )
      return
    }
    // Grundmenge offen: eine eingetippte 0 ist die Entscheidung „heute
    // keine“ - nur ein leeres Feld lässt die Zeile offen.
    if (openBase && raw !== '' && correction === 0) {
      await saveNone()
      return
    }
    if (openBase && correction < 0) {
      setError(
        'Die Grundmenge ist offen - bitte die Menge für heute eintragen (0 = heute keine).'
      )
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
    await run(correction, correction === 0 ? null : reason.trim())
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
          label={openBase ? 'Menge für heute' : 'Korrektur (+/−)'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputRef={inputRef}
          inputProps={{
            inputMode: isIntegerUnit(line.unit) ? 'numeric' : 'decimal',
            'aria-label': openBase ? 'Menge für heute' : 'Korrektur',
          }}
          InputProps={
            openBase
              ? undefined
              : {
                  // Die Ziffernblöcke von iOS (numeric/decimal) haben kein Minus -
                  // ohne diesen Knopf ließe sich am iPhone nichts abziehen.
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 0.5 }}>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setValue((v) => toggleSign(v))
                          inputRef.current?.focus()
                        }}
                        aria-label="Vorzeichen wechseln (plus/minus)"
                        data-testid={`${idPrefix}-sign-${line.key}`}
                        sx={{
                          minWidth: 44,
                          minHeight: 44,
                          px: 0,
                          ml: -0.75,
                          fontSize: '1.2rem',
                          fontWeight: 700,
                        }}
                      >
                        ±
                      </Button>
                    </InputAdornment>
                  ),
                }
          }
          helperText={
            openBase
              ? 'Grundmenge offen · 0 = heute keine · leer = wieder offen'
              : isIntegerUnit(line.unit)
              ? 'ganze Zahl, 0 löscht'
              : '0 löscht'
          }
          sx={{ width: { xs: '100%', sm: 190 } }}
          autoFocus
        />
        <TextField
          id={`${idPrefix}-reason-${line.key}`}
          label="Grund"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          inputProps={{ maxLength: 500, 'aria-label': 'Grund' }}
          helperText={
            openBase
              ? 'Pflicht bei einer Menge, bei „Heute keine“ freiwillig'
              : 'Pflicht, wenn die Korrektur nicht 0 ist'
          }
          sx={{ flex: 1, minWidth: 0 }}
        />
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ pt: { sm: 0.5 } }}
        >
          <Button
            type="submit"
            variant="contained"
            disabled={saving}
            sx={{ minHeight: 44 }}
          >
            Speichern
          </Button>
          {openBase && (
            <Button
              variant="outlined"
              onClick={() => void saveNone()}
              disabled={saving || line.dayDecision === 'none'}
              data-testid={`${idPrefix}-none-today-${line.key}`}
              sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
            >
              Heute keine
            </Button>
          )}
          {openBase && line.dayDecision && (
            <Button
              onClick={() => void run(0, null)}
              disabled={saving}
              data-testid={`${idPrefix}-reopen-base-${line.key}`}
              sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
            >
              Wieder offen
            </Button>
          )}
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
