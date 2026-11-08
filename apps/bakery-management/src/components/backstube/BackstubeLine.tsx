'use client'

import React from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import type {
  BackzettelConfigData,
  BackzettelLine,
} from '../../lib/backzettelApi'
import {
  formatNumber,
  deltaBadgeText,
  formatQty,
  formatSigned,
  formatTimestamp,
  lineLabel,
  previouslyDoneText,
} from '../../lib/backzettelFormat'
import { useBackstubeColors } from './backstubeColors'

/** Zusammensetzung in Kurzform, nur Bestandteile ≠ 0: „Basis 60 · CAP 10 · Korr. −5“. */
export function lineBreakdown(line: BackzettelLine): string {
  const parts: string[] = []
  parts.push(
    line.baseUnset ? 'Basis offen' : `Basis ${formatNumber(line.base)}`
  )
  if (line.seasonal) parts.push(`Saison ${formatSigned(line.seasonal)}`)
  if (line.preorders) parts.push(`Vorb. ${formatNumber(line.preorders)}`)
  if (line.cap) parts.push(`CAP ${formatNumber(line.cap)}`)
  if (line.correction) {
    parts.push(
      `Korr. ${formatSigned(line.correction)}${
        line.correctionReason ? ` (${line.correctionReason})` : ''
      }`
    )
  }
  return parts.join(' · ')
}

export interface BackstubeLineProps {
  line: BackzettelLine
  config: BackzettelConfigData | null
  /** Entwurf: Zahlen ausgegraut, kein Haken. */
  draft: boolean
  /** Abhaken erlaubt (freigegeben + Rolle). */
  canTick: boolean
  /** Ein Abhaken dieser Zeile läuft gerade. */
  pending: boolean
  onToggle: (line: BackzettelLine) => void
}

/**
 * Eine Zeile des Backzettels auf dem Tablet: Name groß, Gesamt sehr groß,
 * ein großer Haken (72 px) rechts. Nachträge stehen als Badge an der Zeile
 * und sind **nicht** im Gesamt - die Karte oben sagt das.
 */
export function BackstubeLine({
  line,
  config,
  draft,
  canTick,
  pending,
  onToggle,
}: BackstubeLineProps) {
  const colors = useBackstubeColors()
  const label = lineLabel(line, config)
  const done = !draft && !!line.doneAt
  const openDelta = !!line.delta && line.delta.open > 0
  const tickable = !draft && canTick && line.id !== null
  const previously = draft ? null : previouslyDoneText(line)

  return (
    <Box
      data-testid={`bs-line-${line.key}`}
      data-done={done ? 'true' : 'false'}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, sm: 2 },
        px: { xs: 1.5, sm: 2 },
        py: 1.5,
        minHeight: 88,
        borderRadius: 2,
        border: '2px solid',
        borderColor: openDelta ? colors.deltaEdge : 'divider',
        borderStyle: draft ? 'dashed' : 'solid',
        borderLeftWidth: openDelta ? 8 : 2,
        bgcolor: openDelta
          ? colors.deltaRow
          : done
          ? colors.doneRow
          : 'background.paper',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          component="div"
          sx={{
            fontSize: { xs: '1.25rem', sm: '1.6rem' },
            fontWeight: 700,
            lineHeight: 1.2,
            color: draft ? 'text.secondary' : 'text.primary',
            overflowWrap: 'anywhere',
          }}
        >
          {label}
        </Typography>
        <Typography
          component="div"
          sx={{
            fontSize: { xs: '0.95rem', sm: '1.1rem' },
            color: 'text.secondary',
            mt: 0.5,
          }}
        >
          {[line.tray, lineBreakdown(line)].filter(Boolean).join(' · ')}
        </Typography>
        {previously && (
          <Typography
            component="div"
            data-testid={`bs-previously-done-${line.key}`}
            sx={{
              fontSize: { xs: '1rem', sm: '1.15rem' },
              fontWeight: 700,
              color: 'text.primary',
              mt: 0.5,
            }}
          >
            {previously}
          </Typography>
        )}
        {(openDelta || (line.delta && line.delta.count > 0) || done) && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              mt: 0.75,
              alignItems: 'center',
            }}
          >
            {line.delta && line.delta.count > 0 && (
              <Box
                component="span"
                data-testid={`bs-delta-badge-${line.key}`}
                data-open={openDelta ? 'true' : 'false'}
                sx={{
                  px: 1.25,
                  py: 0.25,
                  borderRadius: 1,
                  fontWeight: 800,
                  fontSize: { xs: '1rem', sm: '1.15rem' },
                  ...(openDelta
                    ? { bgcolor: colors.deltaBg, color: colors.deltaFg }
                    : {
                        border: '1px solid',
                        borderColor: 'divider',
                        color: 'text.secondary',
                      }),
                }}
              >
                {deltaBadgeText(line.delta, line.unit)}
                {openDelta ? '' : ' · gesehen'}
              </Box>
            )}
            {done && (
              <Typography
                component="span"
                sx={{ fontSize: '1rem', color: 'text.secondary' }}
              >
                erledigt {formatTimestamp(line.doneAt)}
                {line.doneBy ? ` · ${line.doneBy.displayName}` : ''}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography
          component="div"
          data-testid={`bs-total-${line.key}`}
          sx={{
            fontSize: { xs: '2rem', sm: '2.75rem' },
            fontWeight: 800,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: draft || done ? 'text.secondary' : 'text.primary',
          }}
        >
          {formatQty(line.total, line.unit)}
        </Typography>
        {line.loavesEstimate !== undefined && (
          <Typography
            component="div"
            sx={{ fontSize: '1rem', color: 'text.secondary' }}
          >
            ≈ {formatNumber(line.loavesEstimate)} Laibe
          </Typography>
        )}
      </Box>

      {tickable && (
        <ButtonBase
          role="checkbox"
          aria-checked={done}
          aria-label={`${label} ${done ? 'erledigt' : 'abhaken'}`}
          disabled={pending}
          onClick={() => onToggle(line)}
          data-testid={`bs-tick-${line.key}`}
          sx={{
            width: 72,
            height: 72,
            flexShrink: 0,
            borderRadius: 2,
            border: '3px solid',
            borderColor: done ? colors.doneBg : 'text.primary',
            bgcolor: done ? colors.doneBg : 'transparent',
            color: done ? colors.doneFg : 'text.primary',
            opacity: pending ? 0.7 : 1,
            '&:focus-visible': { outline: '3px solid', outlineOffset: 2 },
          }}
        >
          {done && <CheckIcon sx={{ fontSize: 52 }} />}
        </ButtonBase>
      )}
    </Box>
  )
}

export default BackstubeLine
