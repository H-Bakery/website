'use client'

import React from 'react'
import {
  Box,
  Button,
  Chip,
  Collapse,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
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

function DeltaRow({
  delta: d,
  config,
  canAck,
  acking,
  onAck,
  sheetDate,
}: {
  delta: BackzettelDeltaEntry
  config: BackzettelConfigData | null
  canAck: boolean
  acking: boolean
  onAck: (delta: BackzettelDeltaEntry) => void
  sheetDate?: string
}) {
  const isOpen = !d.acknowledgedAt
  return (
    <Box
      component="li"
      data-testid={`delta-${d.id}`}
      sx={{
        listStyle: 'none',
        // Handy: Menge, Name und „Gesehen“ in einer Zeile, die Herkunft
        // darunter über die ganze Breite - sonst brach der Name mitten im
        // Wort um („Mustercroissa-nt“).
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        alignItems: 'center',
        columnGap: { xs: 1.5, sm: 2 },
        rowGap: 0.25,
        px: 1.5,
        py: 1,
        borderRadius: 1,
        bgcolor: isOpen
          ? (t: Theme) => alpha(t.palette.warning.main, 0.14)
          : 'action.hover',
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: { xs: '1.125rem', md: '1.25rem' },
          fontWeight: 700,
          minWidth: { xs: 44, sm: 56 },
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          gridRow: { xs: 1, sm: '1 / span 2' },
        }}
      >
        {formatSignedQty(d.qty, d.unit)}
      </Typography>
      <Typography fontWeight={600} sx={{ gridColumn: 2, gridRow: 1 }}>
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
      <Typography
        variant="caption"
        color="text.secondary"
        component="div"
        sx={{
          gridColumn: { xs: '1 / -1', sm: 2 },
          gridRow: 2,
          overflowWrap: 'anywhere',
        }}
      >
        {[
          DELTA_KIND_LABELS[d.kind] ?? d.kind,
          d.preorderCode ? `Vorbestellung ${deltaCodeText(d)}` : null,
          `bemerkt ${formatTimestamp(d.createdAt)}`,
          d.acknowledgedAt
            ? `gesehen ${formatTimestamp(d.acknowledgedAt)}${
                d.acknowledgedBy ? ` von ${d.acknowledgedBy.displayName}` : ''
              }`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Typography>
      {isOpen && canAck && (
        <Button
          variant="contained"
          color="warning"
          onClick={() => onAck(d)}
          disabled={acking}
          sx={{
            minHeight: 44,
            gridColumn: 3,
            gridRow: { xs: 1, sm: '1 / span 2' },
          }}
        >
          Gesehen
        </Button>
      )}
    </Box>
  )
}

/**
 * Nachträge nach der Freigabe: je Vorbestellung und Änderung eine Zeile,
 * offene hervorgehoben. Sie stehen nie still in den Zeilen - die Backstube
 * quittiert sie einzeln. Quittierte stehen zugeklappt darunter (Layout-Kit:
 * Erledigtes nicht in voller Länge über dem Zettel).
 */
export function DeltasCard({
  deltas,
  config,
  canAck,
  ackingId,
  onAck,
  sheetDate,
}: DeltasCardProps) {
  const [showDone, setShowDone] = React.useState(false)
  const headingId = React.useId()
  if (deltas.length === 0) return null
  const openList = deltas.filter((d) => !d.acknowledgedAt)
  const doneList = deltas.filter((d) => d.acknowledgedAt)
  const open = openList.length
  const row = (d: BackzettelDeltaEntry) => (
    <DeltaRow
      key={d.id}
      delta={d}
      config={config}
      canAck={canAck}
      acking={ackingId === d.id}
      onAck={onAck}
      sheetDate={sheetDate}
    />
  )
  const listSx = { m: 0, p: 0, display: 'grid', gap: 1 }
  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      data-testid="deltas-card"
    >
      <Paper
        sx={{
          p: { xs: 2, md: 3 },
          border: open > 0 ? 2 : 0,
          borderColor: 'warning.main',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography id={headingId} variant="h2" component="h2">
            Nachträge seit der Freigabe
          </Typography>
          {open > 0 && (
            <Chip color="warning" size="small" label={`${open} offen`} />
          )}
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, mb: 2 }}
        >
          {open > 0
            ? 'Nicht in den Mengen unten enthalten – zusätzlich backen bzw. weglassen und mit „Gesehen“ bestätigen.'
            : 'Alle Nachträge sind gesehen.'}
        </Typography>
        {open > 0 && (
          <Box component="ul" sx={listSx}>
            {openList.map(row)}
          </Box>
        )}
        {doneList.length > 0 && (
          <Box sx={{ mt: open > 0 ? 1.5 : 0 }}>
            <Button
              size="small"
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
              endIcon={
                <ExpandMoreIcon
                  sx={{
                    transition: 'transform 0.2s',
                    transform: showDone ? 'rotate(180deg)' : 'none',
                  }}
                />
              }
              sx={{ ml: -1 }}
            >
              {doneList.length === 1
                ? '1 gesehener Nachtrag'
                : `${doneList.length} gesehene Nachträge`}
            </Button>
            <Collapse in={showDone}>
              <Box component="ul" sx={{ ...listSx, mt: 1 }}>
                {doneList.map(row)}
              </Box>
            </Collapse>
          </Box>
        )}
      </Paper>
    </Box>
  )
}

export default DeltasCard
