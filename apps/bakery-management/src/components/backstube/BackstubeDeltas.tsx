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

/** Schlüssel für „Alle gesehen“ (`ackingKey`). */
export const ACK_ALL_KEY = '*'

/** So viele Abholcodes stehen je Zeile, der Rest als „+n“. */
const MAX_CODES = 4

export interface BackstubeDeltaGroup {
  key: string
  deltas: BackzettelDeltaEntry[]
  qty: number
}

/**
 * Offene Nachträge je Backzettel-Zeile (W4-Verifikation Runde 4): am vollen
 * Samstag waren es 42 Einzelkarten mit je einem „Gesehen“, die erste Backzeile
 * stand fünf Bildschirme tiefer. Reihenfolge: wie die erste Änderung kam.
 */
export function groupOpenDeltas(
  deltas: BackzettelDeltaEntry[]
): BackstubeDeltaGroup[] {
  const groups = new Map<string, BackstubeDeltaGroup>()
  for (const d of deltas) {
    if (d.acknowledgedAt) continue
    const g = groups.get(d.key) ?? { key: d.key, deltas: [], qty: 0 }
    g.deltas.push(d)
    g.qty = Math.round((g.qty + (Number(d.qty) || 0)) * 100) / 100
    groups.set(d.key, g)
  }
  return Array.from(groups.values())
}

export interface BackstubeDeltasProps {
  deltas: BackzettelDeltaEntry[]
  config: BackzettelConfigData | null
  canAck: boolean
  /** Gruppe (Zeilen-Schlüssel) bzw. `ACK_ALL_KEY`, die gerade quittiert wird. */
  ackingKey: string | null
  onAck: (deltas: BackzettelDeltaEntry[], key: string) => void
}

function groupDetail(group: BackstubeDeltaGroup): string {
  if (group.deltas.length === 1) {
    const d = group.deltas[0]
    return [
      DELTA_KIND_LABELS[d.kind] ?? d.kind,
      d.preorderCode,
      formatTimestamp(d.createdAt),
    ]
      .filter(Boolean)
      .join(' · ')
  }
  const codes = Array.from(
    new Set(group.deltas.map((d) => d.preorderCode).filter(Boolean))
  ) as string[]
  const shownCodes =
    codes.length > MAX_CODES
      ? `${codes.slice(0, MAX_CODES).join(', ')} +${codes.length - MAX_CODES}`
      : codes.join(', ')
  const last = group.deltas.reduce<string | null>(
    (latest, d) => (!latest || d.createdAt > latest ? d.createdAt : latest),
    null
  )
  return [
    `${group.deltas.length} Änderungen`,
    shownCodes,
    last ? `zuletzt ${formatTimestamp(last)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Offene Nachträge (Vorbestellungen nach der Freigabe) oben auf dem Tablet,
 * zusammengefasst je Zeile mit einem großen „Gesehen“-Knopf, dazu „Alle
 * gesehen“. Quittierte stehen nur als Zahl da - an der Zeile bleibt ihr Badge
 * „gesehen“.
 */
export function BackstubeDeltas({
  deltas,
  config,
  canAck,
  ackingKey,
  onAck,
}: BackstubeDeltasProps) {
  const colors = useBackstubeColors()
  const groups = groupOpenDeltas(deltas)
  const open = groups.flatMap((g) => g.deltas)
  if (open.length === 0) return null
  const seen = deltas.length - open.length
  const busy = ackingKey !== null
  const buttonSx = (active: boolean) => ({
    minHeight: 64,
    minWidth: 140,
    px: 3,
    borderRadius: 2,
    fontSize: '1.3rem',
    fontWeight: 800,
    bgcolor: colors.deltaBg,
    color: colors.deltaFg,
    opacity: active ? 0.7 : 1,
    '&:focus-visible': { outline: '3px solid', outlineOffset: 2 },
  })
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
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
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
          {groups.length < open.length
            ? ` · ${
                groups.length === 1 ? '1 Zeile' : `${groups.length} Zeilen`
              }`
            : ''}
        </Typography>
        {canAck && groups.length > 1 && (
          <ButtonBase
            onClick={() => onAck(open, ACK_ALL_KEY)}
            disabled={busy}
            data-testid="bs-deltas-ack-all"
            aria-label={`Alle ${open.length} Nachträge gesehen`}
            sx={buttonSx(ackingKey === ACK_ALL_KEY)}
          >
            Alle gesehen
          </ButtonBase>
        )}
      </Box>
      <Typography sx={{ fontSize: '1.1rem', mb: 2 }}>
        Nicht in den Mengen unten enthalten – zusätzlich backen bzw. weglassen,
        dann „Gesehen“ tippen.
        {seen > 0 ? ` ${seen} bereits gesehen.` : ''}
      </Typography>
      <Stack spacing={1.5}>
        {groups.map((g) => {
          const d = g.deltas[0]
          const label = lineLabel(
            { name: d.name, variant: d.variant, itemId: d.itemId },
            config
          )
          return (
            <Box
              key={g.key}
              data-testid={`bs-delta-group-${g.key}`}
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
                {g.qty === 0 ? '±0' : formatSignedQty(g.qty, d.unit)}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 180 }}>
                <Typography sx={{ fontSize: '1.4rem', fontWeight: 700 }}>
                  {label}
                </Typography>
                <Typography sx={{ fontSize: '1rem', color: 'text.secondary' }}>
                  {groupDetail(g)}
                </Typography>
              </Box>
              {canAck && (
                <ButtonBase
                  onClick={() => onAck(g.deltas, g.key)}
                  disabled={busy}
                  aria-label={
                    g.deltas.length === 1
                      ? `Nachtrag ${label} gesehen`
                      : `${g.deltas.length} Nachträge ${label} gesehen`
                  }
                  sx={buttonSx(ackingKey === g.key)}
                >
                  Gesehen
                </ButtonBase>
              )}
            </Box>
          )
        })}
      </Stack>
    </Paper>
  )
}

export default BackstubeDeltas
