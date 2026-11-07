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
  deltaAfterDoneText,
  deltaBadgeText,
  formatQty,
  formatSigned,
  formatTimestamp,
  lineLabel,
  previouslyDoneText,
  type DeltaAfterDone,
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
  /**
   * Nachträge nach dem Haken (`deltaAfterDone`). Heißen sie mehr backen,
   * ist die Zeile wieder offen, auch wenn sie „gesehen“ sind (UI-Runde 1).
   */
  afterDone?: DeltaAfterDone | null
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
  afterDone = null,
  config,
  draft,
  canTick,
  pending,
  onToggle,
}: BackstubeLineProps) {
  const colors = useBackstubeColors()
  const label = lineLabel(line, config)
  const ticked = !draft && !!line.doneAt
  // Abgehakt, aber danach kam ein Nachtrag mit mehr zu backen: offen.
  const reopened = ticked && !!afterDone && afterDone.bake > 0
  const done = ticked && !reopened
  const openDelta = !!line.delta && line.delta.open > 0
  // Grundmenge offen: es stehen nur Vorbestellungen/CAP im Gesamt - aus
  // Armlänge sichtbar wie ein Nachtrag (UI-Runde 1), nicht nur grau klein.
  const baseUnset = line.baseUnset
  const warn = openDelta || reopened || baseUnset
  const tickable = !draft && canTick && line.id !== null
  const previously = draft ? null : previouslyDoneText(line)
  const badgeSx = {
    px: 1.25,
    py: 0.25,
    borderRadius: 1,
    fontWeight: 800,
    fontSize: { xs: '1rem', sm: '1.15rem' },
    bgcolor: colors.deltaBg,
    color: colors.deltaFg,
  }

  return (
    <Box
      data-testid={`bs-line-${line.key}`}
      data-done={done ? 'true' : 'false'}
      data-reopened={reopened ? 'true' : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, sm: 2 },
        px: { xs: 1.5, sm: 2 },
        py: 1.5,
        minHeight: 88,
        borderRadius: 2,
        border: '2px solid',
        borderColor: warn ? colors.deltaEdge : 'divider',
        borderStyle: draft ? 'dashed' : 'solid',
        borderLeftWidth: warn ? 8 : 2,
        bgcolor: warn
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
        {(baseUnset || (line.delta && line.delta.count > 0) || ticked) && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              mt: 0.75,
              alignItems: 'center',
            }}
          >
            {baseUnset && (
              <Box
                component="span"
                data-testid={`bs-base-unset-${line.key}`}
                sx={badgeSx}
              >
                Grundmenge offen
              </Box>
            )}
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
            {reopened && afterDone ? (
              <Box
                component="span"
                data-testid={`bs-after-done-${line.key}`}
                sx={badgeSx}
              >
                {deltaAfterDoneText(line, afterDone)}
              </Box>
            ) : ticked && afterDone ? (
              <Typography
                component="span"
                data-testid={`bs-after-done-${line.key}`}
                sx={{ fontSize: '1rem', color: 'text.secondary' }}
              >
                {deltaAfterDoneText(line, afterDone)}
              </Typography>
            ) : (
              ticked && (
                <Typography
                  component="span"
                  sx={{ fontSize: '1rem', color: 'text.secondary' }}
                >
                  erledigt {formatTimestamp(line.doneAt)}
                  {line.doneBy ? ` · ${line.doneBy.displayName}` : ''}
                </Typography>
              )
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
            color: draft || ticked ? 'text.secondary' : 'text.primary',
          }}
        >
          {formatQty(line.total, line.unit)}
        </Typography>
        {reopened && afterDone && (
          <Typography
            component="div"
            data-testid={`bs-after-done-qty-${line.key}`}
            aria-label={`noch ${formatQty(afterDone.bake, line.unit)} backen`}
            sx={{
              mt: 0.5,
              px: 1,
              borderRadius: 1,
              display: 'inline-block',
              fontSize: { xs: '1.5rem', sm: '1.9rem' },
              fontWeight: 800,
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums',
              bgcolor: colors.deltaBg,
              color: colors.deltaFg,
            }}
          >
            +{formatQty(afterDone.bake, line.unit)}
          </Typography>
        )}
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
          aria-checked={reopened ? 'mixed' : done}
          aria-label={
            reopened
              ? `${label}: Nachtrag gebacken – abhaken`
              : `${label} ${done ? 'erledigt' : 'abhaken'}`
          }
          disabled={pending}
          onClick={() => onToggle(line)}
          data-testid={`bs-tick-${line.key}`}
          sx={{
            width: 72,
            height: 72,
            flexShrink: 0,
            borderRadius: 2,
            border: '3px solid',
            borderColor: done
              ? colors.doneBg
              : reopened
              ? colors.deltaEdge
              : 'text.primary',
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
