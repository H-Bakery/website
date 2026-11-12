'use client'

import React from 'react'
import { Box, Button, Paper, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import type {
  BackzettelConfigData,
  BackzettelLine,
  BackzettelSection,
} from '../../lib/backzettelApi'
import { lineLabel } from '../../lib/backzettelFormat'
import { CorrectionEditor } from './CorrectionEditor'

export interface AddLineCardProps {
  /** Posten ohne jede Menge je Abschnitt (`day.addable`, nur Entwurf). */
  addable: BackzettelSection[] | null | undefined
  config: BackzettelConfigData | null
  /** Speichert die Korrektur der Zeile; wirft bei Fehlern (wie am Zettel). */
  onSave: (
    line: BackzettelLine,
    correction: number,
    reason: string | null
  ) => Promise<void>
}

/**
 * „Weiteren Posten aufnehmen“: Posten, die heute keine Menge haben
 * (Grundmenge 0, nichts vorbestellt), stehen nicht auf dem Zettel - hier
 * lassen sie sich mit Menge und Grund dazunehmen (2 Marmorkuchen, 1
 * Nusskranz, eine Partybrezel). Gespeichert wird eine gewöhnliche Korrektur;
 * die Zeile steht danach im Zettel und zählt in Teig und Liter.
 */
export function AddLineCard({ addable, config, onSave }: AddLineCardProps) {
  const [open, setOpen] = React.useState(false)
  const [key, setKey] = React.useState('')
  const sections = (addable ?? []).filter((s) => s.lines.length > 0)
  const lines = sections.flatMap((s) => s.lines)
  if (lines.length === 0) return null
  const line = lines.find((l) => l.key === key) ?? null
  const close = () => {
    setOpen(false)
    setKey('')
  }
  return (
    <Paper variant="outlined" data-testid="add-line" sx={{ mb: 2, p: 2 }}>
      {!open ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
            sx={{ minHeight: 44 }}
          >
            Weiteren Posten aufnehmen
          </Button>
          <Typography variant="body2" color="text.secondary">
            {lines.length === 1
              ? '1 Posten hat heute keine Menge und steht deshalb nicht auf dem Zettel.'
              : `${lines.length} Posten haben heute keine Menge und stehen deshalb nicht auf dem Zettel.`}
          </Typography>
        </Box>
      ) : (
        <Box>
          <TextField
            select
            label="Posten"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'aria-label': 'Posten aufnehmen' }}
            helperText="Die Menge kommt als Korrektur mit Grund dazu."
            sx={{ width: { xs: '100%', sm: 420 } }}
          >
            <option value="">Bitte wählen …</option>
            {sections.map((s) => (
              <optgroup key={s.id} label={s.label}>
                {s.lines.map((l) => (
                  <option key={l.key} value={l.key}>
                    {lineLabel(l, config)}
                    {l.unit && l.unit !== 'Stück' ? ` (${l.unit})` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </TextField>
          {line ? (
            <CorrectionEditor
              key={line.key}
              idPrefix="add"
              line={line}
              label={lineLabel(line, config)}
              // aufnehmbare Posten haben eine Grundmenge (0) - „Heute keine“
              // gibt es hier nicht
              onSave={async (correction, reason) => {
                await onSave(line, correction, reason)
                close()
              }}
              onCancel={close}
            />
          ) : (
            <Box sx={{ mt: 1 }}>
              <Button onClick={close} sx={{ minHeight: 44 }}>
                Abbrechen
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  )
}

export default AddLineCard
