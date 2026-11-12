'use client'
import React from 'react'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

export const LADE_TEXT = 'Der Laden wird geladen …'

export interface LadeanzeigeProps {
  /** 0…1 */
  fortschritt: number
}

/** Einfache Ladeanzeige mit Fortschritt. Das fertige Ladebild kommt in P1. */
export default function Ladeanzeige({ fortschritt }: LadeanzeigeProps) {
  const prozent = Math.round(Math.min(Math.max(fortschritt, 0), 1) * 100)
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        p: 2,
        pointerEvents: 'none',
      }}
    >
      <Paper
        elevation={3}
        sx={{ width: 'min(100%, 320px)', px: 2.5, py: 2, textAlign: 'center' }}
      >
        <Typography id="lade-text" component="p" sx={{ mb: 1.5 }}>
          {LADE_TEXT}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={prozent}
          aria-labelledby="lade-text"
          sx={{ height: 8, borderRadius: 4 }}
        />
        <Typography
          component="p"
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, fontVariantNumeric: 'tabular-nums' }}
          data-testid="lade-prozent"
        >
          {prozent} %
        </Typography>
      </Paper>
    </Box>
  )
}
