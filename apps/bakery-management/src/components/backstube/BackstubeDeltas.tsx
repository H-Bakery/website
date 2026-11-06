'use client'

import React from 'react'
import { Box, ButtonBase, Paper, Stack, Typography } from '@mui/material'
import type {
  BackzettelConfigData,
  BackzettelDeltaEntry,
} from '../../lib/backzettelApi'
import {
  DELTA_KIND_LABELS,
  formatSignedQty,
  formatTimestamp,
  lineLabel,
} from '../../lib/backzettelFormat'
import { useBackstubeColors } from './backstubeColors'

export interface BackstubeDeltasProps {
  deltas: BackzettelDeltaEntry[]
  config: BackzettelConfigData | null
  canAck: boolean
  ackingId: number | null
  onAck: (delta: BackzettelDeltaEntry) => void
}

/**
 * Offene Nachträge (Vorbestellungen nach der Freigabe) oben auf dem Tablet,
 * je Eintrag ein großer „Gesehen"-Knopf. Quittierte stehen nur als Zahl da -
 * an der Zeile bleibt ihr Badge „gesehen".
 */
export function BackstubeDeltas({
  deltas,
  config,
  canAck,
  ackingId,
  onAck,
}: BackstubeDeltasProps) {
  const colors = useBackstubeColors()
  const open = deltas.filter((d) => !d.acknowledgedAt)
  if (open.length === 0) return null
  const seen = deltas.length - open.length
  return (
    <Paper
      component="section"
      aria-labelledby="bs-deltas-title"
      data-testid="bs-deltas"
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 3 },
        borderWidth: 3,
        borderColor: colors.deltaEdge,
        bgcolor: colors.deltaRow,
      }}
    >
      <Typography
        id="bs-deltas-title"
        component="h2"
        sx={{ fontSize: { xs: '1.5rem', sm: '1.9rem' }, fontWeight: 800 }}
      >
        {open.length === 1
          ? '1 Nachtrag seit der Freigabe'
          : `${open.length} Nachträge seit der Freigabe`}
      </Typography>
      <Typography sx={{ fontSize: '1.1rem', mb: 2 }}>
        Nicht in den Mengen unten enthalten – zusätzlich backen bzw. weglassen,
        dann „Gesehen“ tippen.
        {seen > 0 ? ` ${seen} bereits gesehen.` : ''}
      </Typography>
      <Stack spacing={1.5}>
        {open.map((d) => (
          <Box
            key={d.id}
            data-testid={`bs-delta-${d.id}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'background.paper',
            }}
          >
            <Typography
              sx={{
                fontSize: { xs: '2rem', sm: '2.5rem' },
                fontWeight: 800,
                minWidth: 80,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatSignedQty(d.qty, d.unit)}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 180 }}>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 700 }}>
                {lineLabel(
                  { name: d.name, variant: d.variant, itemId: d.itemId },
                  config
                )}
              </Typography>
              <Typography sx={{ fontSize: '1rem', color: 'text.secondary' }}>
                {[
                  DELTA_KIND_LABELS[d.kind] ?? d.kind,
                  d.preorderCode,
                  formatTimestamp(d.createdAt),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Box>
            {canAck && (
              <ButtonBase
                onClick={() => onAck(d)}
                disabled={ackingId === d.id}
                aria-label={`Nachtrag ${lineLabel(
                  { name: d.name, variant: d.variant, itemId: d.itemId },
                  config
                )} gesehen`}
                sx={{
                  minHeight: 64,
                  minWidth: 140,
                  px: 3,
                  borderRadius: 2,
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  bgcolor: colors.deltaBg,
                  color: colors.deltaFg,
                  opacity: ackingId === d.id ? 0.7 : 1,
                  '&:focus-visible': { outline: '3px solid', outlineOffset: 2 },
                }}
              >
                Gesehen
              </ButtonBase>
            )}
          </Box>
        ))}
      </Stack>
    </Paper>
  )
}

export default BackstubeDeltas
