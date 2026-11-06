'use client'
import React from 'react'
import { Box, Button } from '@mui/material'
import { Backspace as BackspaceIcon } from '@mui/icons-material'
import { MAX_QTY_PER_ITEM } from '../../lib/preordersTypes'

/**
 * Nächster Mengen-Text nach einer Taste - wie am Taschenrechner: ist die
 * Anzeige „frisch“ (gerade vorbelegt), ersetzt die erste Ziffer sie. Führende
 * Nullen fallen weg, mehr als `max` nimmt die Anzeige nicht an.
 *
 * @param key `'0'`-`'9'`, `'Backspace'` oder `'Clear'`
 */
export function nextQuantity(
  current: string,
  key: string,
  fresh: boolean,
  max: number = MAX_QTY_PER_ITEM
): string {
  if (key === 'Clear') return ''
  if (key === 'Backspace') return fresh ? '' : current.slice(0, -1)
  if (!/^[0-9]$/.test(key)) return current
  const raw = (fresh ? '' : current) + key
  const next = raw.replace(/^0+(?=\d)/, '')
  return Number(next) > max ? current : next
}

interface QuantityPadProps {
  /** Wird mit `'0'`-`'9'`, `'Backspace'` oder `'Clear'` aufgerufen. */
  onKey: (key: string) => void
  disabled?: boolean
}

const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0']

/**
 * Großer Ziffernblock für die Menge (Laden-Tablet, Handy). Tasten mindestens
 * 56 px hoch. Die Tastatur am PC bedient das Mengenfeld der Maske direkt -
 * die Tasten hier nehmen deshalb keinen Fokus (`tabIndex -1`, kein
 * Fokuswechsel beim Klick), sonst landete Enter auf der zuletzt getippten
 * Taste statt auf „Hinzufügen“.
 */
export default function QuantityPad({
  onKey,
  disabled = false,
}: QuantityPadProps) {
  const keySx = {
    minHeight: { xs: 56, sm: 60 },
    fontSize: { xs: '1.5rem', sm: '1.65rem' },
    fontWeight: 600,
    minWidth: 0,
  }
  const keep = (event: React.MouseEvent) => event.preventDefault()
  return (
    <Box
      role="group"
      aria-label="Ziffernblock Menge"
      sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}
    >
      {PAD_KEYS.map((key) => (
        <Button
          key={key}
          variant="outlined"
          sx={key === 'Clear' ? { ...keySx, fontSize: '1.1rem' } : keySx}
          disabled={disabled}
          onClick={() => onKey(key)}
          onMouseDown={keep}
          tabIndex={-1}
          aria-label={key === 'Clear' ? 'Menge leeren' : undefined}
        >
          {key === 'Clear' ? 'C' : key}
        </Button>
      ))}
      <Button
        variant="outlined"
        sx={keySx}
        disabled={disabled}
        onClick={() => onKey('Backspace')}
        onMouseDown={keep}
        tabIndex={-1}
        aria-label="Letzte Ziffer löschen"
      >
        <BackspaceIcon />
      </Button>
    </Box>
  )
}
