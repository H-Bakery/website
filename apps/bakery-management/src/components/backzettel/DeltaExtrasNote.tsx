'use client'

import React from 'react'
import { Alert, AlertTitle, Box } from '@mui/material'
import type { DeltaExtras } from '../../lib/backzettelApi'
import { deltaExtrasLines } from '../../lib/backzettelFormat'

export interface DeltaExtrasNoteProps {
  extras: DeltaExtras | null | undefined
  /** Schriftgröße für das Backstube-Tablet. */
  large?: boolean
}

/**
 * W4-Verifikation: Hefeteig und Füllungen zeigen den freigegebenen Stand -
 * was die Nachträge seitdem zusätzlich brauchen, steht hier daneben, statt
 * still zu fehlen (sonst macht, wer nach der Abwiegeliste arbeitet, zu wenig
 * Teig und Füllung).
 */
export function DeltaExtrasNote({ extras, large }: DeltaExtrasNoteProps) {
  const lines = deltaExtrasLines(extras)
  if (lines.length === 0) return null
  return (
    <Alert
      severity="warning"
      data-testid="delta-extras"
      sx={large ? { fontSize: { xs: '1.05rem', sm: '1.2rem' } } : undefined}
    >
      <AlertTitle sx={large ? { fontSize: 'inherit', fontWeight: 800 } : {}}>
        Nachträge seit der Freigabe - zusätzlich zu den Mengen unten
      </AlertTitle>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {lines.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </Box>
    </Alert>
  )
}

export default DeltaExtrasNote
