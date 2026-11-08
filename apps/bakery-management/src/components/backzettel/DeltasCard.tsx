'use client'

import React from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import type {
  BackzettelConfigData,
  BackzettelDeltaEntry,
} from '../../lib/backzettelApi'
import {
  DELTA_KIND_LABELS,
  deltaCodeText,
  formatSignedQty,
  formatTimestamp,
  lineLabel,
} from '../../lib/backzettelFormat'

export interface DeltasCardProps {
  deltas: BackzettelDeltaEntry[]
  config: BackzettelConfigData | null
  /** Quittieren erlaubt (inhaber/backstube). */
  canAck: boolean
  ackingId: number | null
  onAck: (delta: BackzettelDeltaEntry) => void
  /**
   * Z10: Datum des Zettels - Nachträge für einen anderen Backtag (Brötchen
   * für Dienstag auf dem Samstags-Zettel) heißen dann „· für Di 01.12.“.
   */
  sheetDate?: string
}

/**
 * Nachträge nach der Freigabe: je Vorbestellung und Änderung eine Zeile,
 * offene hervorgehoben. Sie stehen nie still in den Zeilen - die Backstube
 * quittiert sie einzeln.
 */
export function DeltasCard({
  deltas,
  config,
  canAck,
  ackingId,
  onAck,
  sheetDate,
}: DeltasCardProps) {
  if (deltas.length === 0) return null
  const open = deltas.filter((d) => !d.acknowledgedAt).length
  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        borderColor: open > 0 ? 'warning.main' : 'divider',
        borderWidth: open > 0 ? 2 : 1,
      }}
      data-testid="deltas-card"
    >
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6" component="h2">
            Nachträge seit der Freigabe
          </Typography>
          {open > 0 && (
            <Chip color="warning" size="small" label={`${open} offen`} />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Vorbestellungen, die nach der Freigabe dazukamen oder sich geändert
          haben. Sie sind nicht in den Mengen oben enthalten – bitte zusätzlich
          backen bzw. weglassen und quittieren.
        </Typography>
        <Stack spacing={1}>
          {deltas.map((d) => {
            const isOpen = !d.acknowledgedAt
            return (
              <Box
                key={d.id}
                data-testid={`delta-${d.id}`}
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: isOpen
                    ? (t: Theme) => alpha(t.palette.warning.main, 0.14)
                    : 'action.hover',
                }}
              >
                <Typography
                  variant="h6"
                  component="span"
                  fontWeight={700}
                  sx={{ minWidth: 56 }}
                >
                  {formatSignedQty(d.qty, d.unit)}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <Typography fontWeight={600}>
                    {lineLabel(
                      {
                        name: d.name,
                        variant: d.variant,
                        itemId: d.itemId,
                        bakeDate: d.bakeDate,
                        doughDate: sheetDate,
                      },
                      config
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[
                      DELTA_KIND_LABELS[d.kind] ?? d.kind,
                      d.preorderCode
                        ? `Vorbestellung ${deltaCodeText(d)}`
                        : null,
                      `bemerkt ${formatTimestamp(d.createdAt)}`,
                      d.acknowledgedAt
                        ? `quittiert ${formatTimestamp(d.acknowledgedAt)}${
                            d.acknowledgedBy
                              ? ` von ${d.acknowledgedBy.displayName}`
                              : ''
                          }`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                </Box>
                {isOpen && canAck && (
                  <Button
                    variant="contained"
                    color="warning"
                    onClick={() => onAck(d)}
                    disabled={ackingId === d.id}
                    sx={{ minHeight: 44 }}
                  >
                    Gesehen
                  </Button>
                )}
              </Box>
            )
          })}
        </Stack>
      </CardContent>
    </Card>
  )
}

export default DeltasCard
