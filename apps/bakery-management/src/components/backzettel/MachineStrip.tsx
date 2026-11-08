'use client'

import React from 'react'
import { Box, Paper, Stack, Typography } from '@mui/material'
import type { DoughSummary, MachineBox } from '../../lib/backzettelApi'
import {
  addonText,
  batchesText,
  kgText,
  litersHint,
  litersLabel,
  litersFigure,
} from '../../lib/backzettelFormat'

export interface MachineStripProps {
  machine: MachineBox[]
  /** Teige des Zettels: Einzel-kg einer Gruppe und was einem Teig fehlt. */
  doughs?: DoughSummary[] | null
  /** Backstube-Tablet: sehr große Zahlen. */
  large?: boolean
  /** Entwurf: Zahlen grau (Tablet). */
  muted?: boolean
}

/** Was die Liter, kg oder Chargen eines Kastens offen lässt - je eine Zeile. */
export function machineHints(
  box: MachineBox,
  doughs: DoughSummary[] | null | undefined
): string[] {
  const hints: string[] = []
  const liters = litersHint(box.liters)
  if (liters) hints.push(liters)
  for (const d of doughs ?? []) {
    if (!box.doughIds.includes(d.id)) continue
    for (const m of d.missing) {
      if (!hints.includes(m.message)) hints.push(m.message)
    }
  }
  return hints
}

/**
 * Maschinen-Leiste des Teigtag-Zettels (Z10, docs/backzettel-v2.md §7.2):
 * je Teig bzw. gemeinsamer Teiggruppe ein Kasten mit der Literzahl für die
 * Knetmaschine, kg, Chargen und Zugaben. Alles kommt vom Server; was die
 * Stammdaten offen lassen, steht als „unbekannt“/„–“ mit Grund darunter -
 * nie geschätzt.
 */
export function MachineStrip({
  machine,
  doughs,
  large = false,
  muted = false,
}: MachineStripProps) {
  if (machine.length === 0) return null
  const big = large
    ? { xs: '2rem', sm: '2.6rem' }
    : { xs: '1.6rem', sm: '1.9rem' }
  const mid = large ? { xs: '1.15rem', sm: '1.35rem' } : '1rem'
  const small = large ? { xs: '1rem', sm: '1.1rem' } : '0.875rem'
  return (
    <Box
      component="section"
      aria-label="Maschine"
      data-testid="machine-strip"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: large ? 'repeat(3, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
        },
        gap: 1.5,
        mb: 2,
      }}
    >
      {machine.map((box) => {
        const members =
          box.doughIds.length > 1
            ? (doughs ?? []).filter((d) => box.doughIds.includes(d.id))
            : []
        const batches = batchesText(box)
        const hints = machineHints(box, doughs)
        const unknownLiters = box.liters.exact === null
        return (
          <Paper
            key={box.id ?? 'offen'}
            variant="outlined"
            data-testid={`machine-${box.id ?? 'offen'}`}
            data-complete={box.complete ? 'true' : 'false'}
            sx={{
              p: large ? 2 : 1.5,
              borderWidth: 2,
              borderStyle: box.complete ? 'solid' : 'dashed',
              minWidth: 0,
            }}
          >
            <Typography
              component="h3"
              sx={{ fontSize: mid, fontWeight: 700, overflowWrap: 'anywhere' }}
            >
              {box.name}
            </Typography>
            <Stack
              direction="row"
              alignItems="baseline"
              flexWrap="wrap"
              sx={{ columnGap: 1 }}
            >
              <Typography
                component="span"
                sx={{ fontSize: small, color: 'text.secondary' }}
              >
                {litersLabel(box)}
              </Typography>
              <Typography
                component="span"
                data-testid={`machine-liters-${box.id ?? 'offen'}`}
                sx={{
                  fontSize: unknownLiters ? mid : big,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  fontVariantNumeric: 'tabular-nums',
                  color:
                    muted || unknownLiters ? 'text.secondary' : 'text.primary',
                }}
              >
                {litersFigure(box.liters)}
              </Typography>
            </Stack>
            <Typography
              data-testid={`machine-kg-${box.id ?? 'offen'}`}
              sx={{
                fontSize: mid,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {kgText(box)}
            </Typography>
            {members.length > 0 && (
              <Typography sx={{ fontSize: small, color: 'text.secondary' }}>
                {members.map((m) => `${m.name} ${kgText(m)}`).join(' · ')}
              </Typography>
            )}
            <Typography sx={{ fontSize: small }}>
              {batches.text}
              {batches.hint ? (
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  {` (${batches.hint})`}
                </Box>
              ) : null}
            </Typography>
            {box.addons.map((addon) => {
              const a = addonText(addon)
              return (
                <Typography key={addon.id} sx={{ fontSize: small }}>
                  {a.text}
                  {a.hint ? (
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      {` (${a.hint})`}
                    </Box>
                  ) : null}
                </Typography>
              )
            })}
            {hints.length > 0 && (
              <Box
                component="ul"
                data-testid={`machine-hints-${box.id ?? 'offen'}`}
                sx={{
                  m: 0,
                  mt: 0.5,
                  pl: 2.5,
                  fontSize: small,
                  color: 'text.secondary',
                }}
              >
                {hints.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </Box>
            )}
          </Paper>
        )
      })}
    </Box>
  )
}

export default MachineStrip
