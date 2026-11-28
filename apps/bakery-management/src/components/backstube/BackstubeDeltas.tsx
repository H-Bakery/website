'use client'

import React from 'react'
import { Box, ButtonBase, Paper, Stack, Typography } from '@mui/material'
import type {
  BackzettelConfigData,
  BackzettelDeltaEntry,
} from '../../lib/backzettelApi'
import {
  DELTA_KIND_LABELS,
  deltaBadgeText,
  deltaCodeText,
  formatSignedQty,
  formatTimestamp,
  lineLabel,
} from '../../lib/backzettelFormat'
import { BS_SECTION_TITLE_SX } from './backstubeType'
import { useBackstubeColors } from './backstubeColors'
import { BS_ANCHOR_SX, BS_WIDE } from './BackstubeLayout'

/** Sprungziel des Nachtrags-Kastens (z. B. aus der Bäcker-Ansicht). */
export const DELTAS_ANCHOR = 'bs-anchor-deltas'

/** Ab hier (Tablet hochkant) steht „Gesehen“ neben dem Namen. */
const ROW_LAYOUT = '@media (min-width: 600px)'

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
  /**
   * Je Zeile, was die offenen Nachträge nach dem Aufrunden zusätzlich zu
   * backen heißen (`line.delta.bakeOpen`, W4-Verifikation Runde 5): die
   * große Zahl ist das, nicht die Viertelsumme (+6,5 Kranz = 7 backen).
   */
  bakeByKey?: Record<string, number | undefined>
  /** Z10: Datum des Zettels (Nachträge für einen anderen Backtag: „· für Di“). */
  sheetDate?: string
}

/** Große Zahl einer Gruppe: zu backen, sonst (ältere Server) die Summe. */
export function groupHeadline(
  group: Pick<BackstubeDeltaGroup, 'qty'>,
  bake: number | undefined,
  unit: BackzettelDeltaEntry['unit']
): { big: string; note: string | null } {
  if (bake === undefined || bake === null || bake === group.qty) {
    return {
      big: group.qty === 0 ? '±0' : formatSignedQty(group.qty, unit),
      note: null,
    }
  }
  return {
    big: bake === 0 ? '±0' : formatSignedQty(bake, unit),
    note: deltaBadgeText({ qty: group.qty, bake, open: 0, count: 0 }, unit),
  }
}

export function groupDetail(group: BackstubeDeltaGroup): string {
  if (group.deltas.length === 1) {
    const d = group.deltas[0]
    return [
      DELTA_KIND_LABELS[d.kind] ?? d.kind,
      deltaCodeText(d),
      formatTimestamp(d.createdAt),
    ]
      .filter(Boolean)
      .join(' · ')
  }
  const codes = Array.from(
    new Set(group.deltas.map((d) => deltaCodeText(d)).filter(Boolean))
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
  bakeByKey,
  sheetDate,
}: BackstubeDeltasProps) {
  const colors = useBackstubeColors()
  const groups = groupOpenDeltas(deltas)
  const open = groups.flatMap((g) => g.deltas)
  if (open.length === 0) return null
  const seen = deltas.length - open.length
  const busy = ackingKey !== null
  const buttonSx = (active: boolean) => ({
    minHeight: 56,
    minWidth: 128,
    px: 2.5,
    borderRadius: 2,
    fontSize: '1.2rem',
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
      id={DELTAS_ANCHOR}
      data-testid="bs-deltas"
      variant="outlined"
      sx={{
        ...BS_ANCHOR_SX,
        p: { xs: 1.5, sm: 2 },
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
          variant="h2"
          component="h2"
          sx={{
            ...BS_SECTION_TITLE_SX,
            fontSize: { xs: '1.3rem', sm: '1.5rem' },
          }}
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
      <Typography sx={{ fontSize: '1.05rem', mt: 0.5, mb: 1.5 }}>
        Nicht in den Mengen unten – zusätzlich backen bzw. weglassen, dann
        „Gesehen“.
        {seen > 0 ? ` ${seen} bereits gesehen.` : ''}
      </Typography>
      <Stack spacing={1}>
        {groups.map((g) => {
          const d = g.deltas[0]
          const label = lineLabel(
            {
              name: d.name,
              variant: d.variant,
              itemId: d.itemId,
              bakeDate: d.bakeDate,
              doughDate: sheetDate,
            },
            config
          )
          const headline = groupHeadline(g, bakeByKey?.[g.key], d.unit)
          return (
            <Box
              key={g.key}
              data-testid={`bs-delta-group-${g.key}`}
              sx={{
                // UI-Runde 2, kompakt: schmal (Handy, Seitenspalte) die Zahl
                // und „Gesehen“ oben, der Name über die ganze Breite darunter
                // - vorher stand „Gesehen“ als eigener breiter Balken unter
                // jeder Zeile und die Seitenspalte war nach zwei Nachträgen
                // voll. Hochkant ohne Seitenspalte alles in einer Reihe.
                display: 'grid',
                alignItems: 'center',
                columnGap: 1.5,
                rowGap: 0.5,
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gridTemplateAreas: '"fig btn" "name name"',
                [ROW_LAYOUT]: {
                  columnGap: 2,
                  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                  gridTemplateAreas: '"fig name btn"',
                },
                [BS_WIDE]: {
                  columnGap: 1.5,
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gridTemplateAreas: '"fig btn" "name name"',
                },
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                bgcolor: 'background.paper',
                '& > .bs-delta-ack': { gridArea: 'btn' },
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: '2rem', sm: '2.5rem' },
                  fontWeight: 800,
                  minWidth: 72,
                  gridArea: 'fig',
                  lineHeight: 1.1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {headline.big}
              </Typography>
              <Box sx={{ gridArea: 'name', minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: { xs: '1.25rem', sm: '1.4rem' },
                    fontWeight: 700,
                    lineHeight: 1.2,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {label}
                </Typography>
                {headline.note && (
                  <Typography
                    sx={{ fontSize: '1.1rem', fontWeight: 700 }}
                    data-testid={`bs-delta-bake-${g.key}`}
                  >
                    {headline.note}
                  </Typography>
                )}
                <Typography sx={{ fontSize: '1rem', color: 'text.secondary' }}>
                  {groupDetail(g)}
                </Typography>
              </Box>
              {canAck && (
                <ButtonBase
                  className="bs-delta-ack"
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
