'use client'

import React from 'react'
import { Box, Typography } from '@mui/material'
import type { BackzettelUnit } from '../../lib/backzettelApi'
import { splitQtyText } from '../../lib/backzettelFormat'

/**
 * Ab hier „Rechner“: Name links, Punktlinie, Menge rechts (wie eine
 * Preisliste). Darunter - Tablet quer und hochkant, Handy - steht die Menge
 * zuerst und am größten: aus 1-2 m liest man in der Backstube die Zahl, der
 * Name steht daneben (UI-Runde 2, nach Screenshots entschieden).
 */
export const BS_DESK = '@media (min-width: 1300px)'

/**
 * Raster einer Zeile (Zettel und Backen gleich): `qty main tick` auf dem
 * Tablet, `main qty tick` auf dem Rechner. Die Reihenfolge im DOM bleibt
 * Name, Menge, Haken - Vorlesen und Druck lesen den Namen zuerst.
 */
export function rowGridSx(hasTick: boolean) {
  return {
    display: 'grid',
    alignItems: 'center',
    columnGap: { xs: 1.5, sm: 2.5 },
    gridTemplateColumns: hasTick
      ? 'auto minmax(0, 1fr) auto'
      : 'auto minmax(0, 1fr)',
    gridTemplateAreas: hasTick ? '"qty main tick"' : '"qty main"',
    [BS_DESK]: {
      columnGap: 2,
      gridTemplateColumns: hasTick
        ? 'minmax(0, 1fr) auto auto'
        : 'minmax(0, 1fr) auto',
      gridTemplateAreas: hasTick ? '"main qty tick"' : '"main qty"',
    },
    '@media print': {
      gridTemplateColumns: hasTick
        ? 'minmax(0, 1fr) auto auto'
        : 'minmax(0, 1fr) auto',
      gridTemplateAreas: hasTick ? '"main qty tick"' : '"main qty"',
    },
  } as const
}

/** Spalte der Menge: auf dem Tablet links, feste Mindestbreite (Namen fluchten). */
export const QTY_CELL_SX = {
  gridArea: 'qty',
  minWidth: { xs: '2.75rem', sm: '6rem' },
  textAlign: 'right',
  [BS_DESK]: { minWidth: 0 },
} as const

export const MAIN_CELL_SX = { gridArea: 'main', minWidth: 0 } as const
export const TICK_CELL_SX = { gridArea: 'tick' } as const

/**
 * Die große Menge einer Zeile: Zahl sehr groß, die Einheit („L“, „Bl.“)
 * kleiner daneben - sonst bricht „2 Bl.“ in schmalen Spalten um und die
 * Einheit wirkt wie eine zweite Zahl.
 */
export function QtyFigure({
  text,
  unit,
  muted,
  testId,
}: {
  text: string
  unit: BackzettelUnit | null
  muted: boolean
  testId: string
}) {
  const parts = splitQtyText(text, unit)
  return (
    <Typography
      component="div"
      data-testid={testId}
      sx={{
        fontSize: { xs: '2.25rem', sm: '3.25rem' },
        [BS_DESK]: { fontSize: '2.75rem' },
        fontWeight: 800,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.01em',
        color: muted ? 'text.secondary' : 'text.primary',
      }}
    >
      {parts.figure}
      {parts.unit && (
        // Das Leerzeichen gehört in den Text („2 L“ beim Vorlesen und Kopieren).
        <Box component="span" sx={{ fontSize: '0.6em', fontWeight: 800 }}>
          {` ${parts.unit}`}
        </Box>
      )}
    </Typography>
  )
}
