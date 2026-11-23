'use client'
import React, { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { Backspace as BackspaceIcon } from '@mui/icons-material'
import {
  parsePadInput,
  type RestLine,
  type RestCountRow,
} from '../../lib/restApi'

export interface PadTarget {
  line: RestLine
  row: RestCountRow
  value: number | null
}

const PAD_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', '⌫']

export default function NumberPad({
  target,
  onClose,
  onApply,
  halfSteps = false,
}: {
  target: PadTarget | null
  onClose: () => void
  onApply: (value: number | null) => void
  halfSteps?: boolean
}) {
  const [text, setText] = useState('')
  const [fresh, setFresh] = useState(true)
  useEffect(() => {
    if (target) {
      setText(
        target.value === null ? '' : String(target.value).replace('.', ',')
      )
      setFresh(true)
    }
  }, [target])
  if (!target) return null
  const integer = target.row.integer
  const parsed = parsePadInput(text, integer)
  const invalid =
    Number.isNaN(parsed) ||
    (halfSteps && parsed !== null && !Number.isInteger(parsed * 2))
  const press = (key: string) => {
    if (key === '⌫') {
      setFresh(false)
      setText((t) => (fresh ? '' : t.slice(0, -1)))
      return
    }
    if (key === ',' && integer) return
    setText((t) => {
      const base = fresh ? '' : t
      if (key === ',' && base.includes(',')) return base
      const next = `${base}${key}`
      return next.length > 7 ? base : next
    })
    setFresh(false)
  }
  const apply = () => {
    if (!invalid) onApply(parsed as number | null)
  }
  const title = target.line.variantLabel
    ? `${target.line.name} · ${target.line.variantLabel}`
    : target.line.name
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="rest-pad-title"
      onKeyDown={(e) => {
        if (/^[0-9]$/.test(e.key)) press(e.key)
        else if (e.key === ',' || e.key === '.') press(',')
        else if (e.key === 'Backspace') press('⌫')
        else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement))
          apply()
      }}
    >
      <DialogTitle id="rest-pad-title" sx={{ pb: 1 }}>
        {title}
        {target.row.label !== target.line.name && (
          <Typography variant="body2" color="text.secondary">
            {target.row.label}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Box
          role="status"
          aria-live="polite"
          data-testid="pad-display"
          sx={{
            border: 1,
            borderColor: invalid ? 'error.main' : 'divider',
            borderRadius: 1,
            px: 2,
            py: 1,
            mb: 2,
            textAlign: 'right',
            fontSize: '2.25rem',
            fontVariantNumeric: 'tabular-nums',
            minHeight: 64,
          }}
        >
          {text === '' ? (
            <Typography component="span" color="text.secondary" fontSize="1rem">
              nicht gezählt
            </Typography>
          ) : (
            <>
              {text}{' '}
              <Typography
                component="span"
                color="text.secondary"
                fontSize="1rem"
              >
                {target.row.unit}
              </Typography>
            </>
          )}
        </Box>
        {invalid && (
          <Typography color="error" variant="body2" sx={{ mb: 1 }}>
            {integer
              ? 'Bitte eine ganze Zahl bis 10000.'
              : halfSteps
              ? 'Bitte eine Zahl bis 10000 in halben Schritten.'
              : 'Bitte eine Zahl bis 10000 mit höchstens zwei Nachkommastellen.'}
          </Typography>
        )}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
          }}
        >
          {PAD_KEYS.map((key) => (
            <Button
              key={key}
              variant="outlined"
              onClick={() => press(key)}
              disabled={key === ',' && integer}
              aria-label={key === '⌫' ? 'Löschen' : key === ',' ? 'Komma' : key}
              sx={{ minHeight: 64, fontSize: '1.5rem' }}
            >
              {key === '⌫' ? <BackspaceIcon /> : key}
            </Button>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
        <Button
          onClick={() => onApply(null)}
          sx={{ minHeight: 48, mr: 'auto' }}
          color="inherit"
        >
          Nicht gezählt
        </Button>
        <Button onClick={onClose} sx={{ minHeight: 48 }}>
          Abbrechen
        </Button>
        <Button
          variant="contained"
          onClick={apply}
          disabled={invalid}
          sx={{ minHeight: 48 }}
        >
          Übernehmen
        </Button>
      </DialogActions>
    </Dialog>
  )
}
