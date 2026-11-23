'use client'

import React, { useState } from 'react'
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Add, Close, Remove } from '@mui/icons-material'
import {
  formatQtyUnit,
  rowKey,
  shownQty,
  stepQty,
  type RestDay,
  type RestDraft,
  type RestLine,
  type RestCountRow,
} from '../../lib/restApi'
import type { VoiceResult } from '../../lib/spracheApi'
import NumberPad from './NumberPad'

interface RowChoice {
  key: string
  line: RestLine
  row: RestCountRow
  name: string
}

export interface VoiceEntry {
  key: string
  qty: number
}

interface Edit {
  key: string
  qty: number | null
  reviewed?: boolean
}

export default function VoiceSheet({
  open,
  day,
  draft,
  results,
  onApply,
  onRepeat,
  onDiscard,
  canRepeat,
  feedback,
  onCheckConnection,
}: {
  open: boolean
  day: RestDay
  draft: RestDraft
  results: VoiceResult[]
  onApply: (rows: VoiceEntry[]) => void
  onRepeat: () => void
  onDiscard: () => void
  canRepeat: boolean
  feedback: string | null
  onCheckConnection?: () => void
}) {
  const [edits, setEdits] = useState<Record<string, Edit | null>>({})
  const [pad, setPad] = useState<string | null>(null)
  const choices: RowChoice[] = day.lines.flatMap((line) =>
    line.rows
      .filter((row) => !row.stale)
      .map((row) => ({
        key: rowKey(line, row),
        row,
        line,
        name: [row.label, line.name, line.variantLabel]
          .filter((name, i, all) => name && all.indexOf(name) === i)
          .join(' · '),
      }))
  )
  const byKey = new Map(choices.map((choice) => [choice.key, choice]))
  const rows = results
    .flatMap(({ proposal, unmatched }, clip) => [
      ...proposal.map((row, i) => ({
        id: `${clip}:v:${i}`,
        heard: row.heard,
        reason: row.reason,
        initial: { key: row.key, qty: row.menge },
        candidates: [] as string[],
        unsicher: row.unsicher,
      })),
      ...unmatched.map((row, i) => ({
        id: `${clip}:u:${i}`,
        heard: row.heard,
        reason: 'Nicht zugeordnet',
        initial: { key: '', qty: null },
        candidates: row.candidates ?? [],
        unsicher: true,
      })),
    ])
    .flatMap((row) => {
      const edit: Edit | null = row.id in edits ? edits[row.id] : row.initial
      return edit ? [{ ...row, edit, choice: byKey.get(edit.key) }] : []
    })
  const occurrences = new Map<string, number>()
  for (const { choice } of rows) {
    if (choice)
      occurrences.set(choice.key, (occurrences.get(choice.key) ?? 0) + 1)
  }

  const accepted: VoiceEntry[] = []
  for (const { choice, edit, unsicher } of rows) {
    if (
      choice &&
      edit.qty !== null &&
      occurrences.get(choice.key) === 1 &&
      (!unsicher || edit.reviewed)
    ) {
      accepted.push({ key: choice.key, qty: edit.qty })
    }
  }
  const update = (id: string, edit: Edit | null) =>
    setEdits((prev) => ({ ...prev, [id]: edit }))
  const notices = Array.from(
    new Set(
      [feedback, ...results.map(({ hint }) => hint)].filter(
        (message): message is string => Boolean(message)
      )
    )
  )
  const activePad = rows.find(({ id }) => id === pad)
  return (
    <>
      <Dialog
        open={open}
        onClose={onDiscard}
        maxWidth="sm"
        fullWidth
        aria-labelledby="voice-sheet-title"
      >
        <DialogTitle id="voice-sheet-title">Sprachvorschlag prüfen</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Stack spacing={1} role="status" aria-live="polite">
              {notices.map((text) => (
                <Alert key={text} severity="info" role="presentation">
                  {text}
                </Alert>
              ))}
            </Stack>
            <Typography sx={{ overflowWrap: 'anywhere' }}>
              Gehört:{' '}
              {results.map(({ transcript }) => `„${transcript}“`).join(' · ')}
            </Typography>
            {rows.map(
              ({ id, heard, unsicher, reason, choice, edit, candidates }) => {
                const duplicate =
                  !!choice && (occurrences.get(choice.key) ?? 0) > 1
                const review = duplicate || (unsicher && !edit.reviewed)
                const label = choice?.name ?? heard
                return (
                  <Paper key={id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography
                          fontWeight={600}
                          sx={{ flex: 1, overflowWrap: 'anywhere' }}
                        >
                          {choice?.name ?? 'Nicht zugeordnet'}
                        </Typography>
                        <IconButton
                          aria-label={`${label} aus dem Vorschlag entfernen`}
                          onClick={() => update(id, null)}
                        >
                          <Close />
                        </IconButton>
                      </Stack>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        „{heard}“
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        useFlexGap
                        flexWrap="wrap"
                      >
                        <Chip
                          size="small"
                          label={review ? 'Bitte prüfen' : 'Sicher'}
                          color={review ? 'warning' : 'success'}
                        />
                        {review && (
                          <Typography variant="body2">
                            {duplicate
                              ? 'Zeile mehrfach gehört. Bitte einen Vorschlag entfernen.'
                              : reason}
                          </Typography>
                        )}
                      </Stack>
                      {choice ? (
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                        >
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {formatQtyUnit(
                              shownQty(draft, choice.line, choice.row),
                              choice.row.unit
                            )}
                            {' → '}
                            {formatQtyUnit(edit.qty, choice.row.unit)}
                          </Typography>
                          <IconButton
                            aria-label={`${label} verringern`}
                            onClick={() =>
                              update(id, {
                                ...edit,
                                qty: stepQty(edit.qty, choice.row.step, -1),
                              })
                            }
                          >
                            <Remove />
                          </IconButton>
                          <Button
                            onClick={() => setPad(id)}
                            aria-label={`Menge für ${label} eingeben`}
                          >
                            {formatQtyUnit(edit.qty, choice.row.unit)}
                          </Button>
                          <IconButton
                            aria-label={`${label} erhöhen`}
                            onClick={() =>
                              update(id, {
                                ...edit,
                                qty: stepQty(edit.qty, choice.row.step, 1),
                              })
                            }
                          >
                            <Add />
                          </IconButton>
                          {review && !duplicate && edit.qty !== null && (
                            <Button
                              onClick={() =>
                                update(id, { ...edit, reviewed: true })
                              }
                            >
                              Zeile bestätigen
                            </Button>
                          )}
                        </Stack>
                      ) : (
                        <>
                          {candidates.length > 0 && (
                            <Stack direction="row" gap={1} flexWrap="wrap">
                              {candidates.map((key) => {
                                const match = byKey.get(key)
                                return (
                                  match && (
                                    <Chip
                                      key={key}
                                      label={match.name}
                                      onClick={() =>
                                        update(id, { key, qty: null })
                                      }
                                    />
                                  )
                                )
                              })}
                            </Stack>
                          )}
                          <Autocomplete
                            options={choices}
                            getOptionLabel={(option) => option.name}
                            getOptionKey={(option) => option.key}
                            onChange={(_, option) =>
                              option &&
                              update(id, { key: option.key, qty: null })
                            }
                            renderInput={(params) => (
                              <TextField {...params} label="Produkt suchen" />
                            )}
                          />
                        </>
                      )}
                    </Stack>
                  </Paper>
                )
              }
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap' }}>
          <Button onClick={onDiscard} color="inherit">
            Verwerfen
          </Button>
          {onCheckConnection && (
            <Button onClick={onCheckConnection}>Verbindung prüfen</Button>
          )}
          <Button onClick={onRepeat} disabled={!canRepeat}>
            Nochmal sprechen
          </Button>
          <Button
            variant="contained"
            disabled={!accepted.length}
            onClick={() => onApply(accepted)}
          >
            Übernehmen ({accepted.length})
          </Button>
        </DialogActions>
      </Dialog>
      {activePad?.choice && (
        <NumberPad
          target={{
            line: activePad.choice.line,
            row: activePad.choice.row,
            value: activePad.edit.qty,
          }}
          halfSteps={['Liter', 'kg'].includes(activePad.choice.row.unit)}
          onClose={() => setPad(null)}
          onApply={(qty) => {
            update(activePad.id, { ...activePad.edit, qty })
            setPad(null)
          }}
        />
      )}
    </>
  )
}
