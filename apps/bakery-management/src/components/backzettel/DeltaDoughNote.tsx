'use client'

import React from 'react'
import { Alert, AlertTitle, Box } from '@mui/material'
import type { BackzettelDay } from '../../lib/backzettelApi'
import { deltaDoughLines } from '../../lib/backzettelFormat'

export interface DeltaDoughNoteProps {
  day: Pick<BackzettelDay, 'date' | 'deltaBruch' | 'deltaMachine'>
  /** Schriftgröße für das Backstube-Tablet. */
  large?: boolean
}

/**
 * Review Z10 Runde 1: was die Nachträge eines freigegebenen Teigtag-Zettels
 * für Teilmaschine und Teige heißen - „1 Bruch mehr“, „passt in die freien
 * Stücke“, kg und Liter je Kasten. Die Maschinen-Leiste darüber bleibt der
 * freigegebene Stand; die Zahlen kommen vom Server (`deltaBruch`,
 * `deltaMachine`).
 */
export function DeltaDoughNote({ day, large }: DeltaDoughNoteProps) {
  const lines = deltaDoughLines(day)
  if (lines.length === 0) return null
  return (
    <Alert
      severity="warning"
      data-testid="delta-dough"
      sx={{
        mb: 2,
        ...(large ? { fontSize: { xs: '1.05rem', sm: '1.2rem' } } : {}),
      }}
    >
      <AlertTitle sx={large ? { fontSize: 'inherit', fontWeight: 800 } : {}}>
        Nachträge: was sie für Teig und Teilmaschine heißen
      </AlertTitle>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {lines.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </Box>
    </Alert>
  )
}

export default DeltaDoughNote
