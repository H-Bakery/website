'use client'

import React from 'react'
import { Alert, AlertTitle, Box, Typography } from '@mui/material'
import type { DeltaExtras } from '../../lib/backzettelApi'
import {
  deltaExtrasHighlights,
  deltaExtrasLines,
} from '../../lib/backzettelFormat'

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
      {/* Tablet: die Mengen zum Abwiegen groß und fett, aus Armlänge lesbar
          - sonst las man darunter die alten, großen Summen (W4-verify r4). */}
      {large &&
        deltaExtrasHighlights(extras).map((group) => (
          <Box
            key={group.key}
            data-testid={`delta-extras-${group.key}`}
            sx={{ mb: 1 }}
          >
            <Typography
              component="span"
              sx={{ fontSize: 'inherit', fontWeight: 700, mr: 1 }}
            >
              {group.label}:
            </Typography>
            {group.amounts.map((amount) => (
              <Typography
                key={amount}
                component="span"
                sx={{
                  fontSize: { xs: '1.6rem', sm: '2.2rem' },
                  fontWeight: 800,
                  lineHeight: 1.2,
                  mr: 2,
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                }}
              >
                {amount}
              </Typography>
            ))}
          </Box>
        ))}
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {lines.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </Box>
    </Alert>
  )
}

export default DeltaExtrasNote
