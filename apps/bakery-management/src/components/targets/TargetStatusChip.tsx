'use client'
import React from 'react'
import { Box, Chip, useTheme } from '@mui/material'
import type { TargetEvaluation, TargetStatus } from '../../lib/targetsTypes'

/**
 * Ampelfarben, je Modus gewählt und auf ≥ 4,5:1 gegen `background.paper`
 * bzw. `background.default` geprüft (Playwright + getComputedStyle, siehe
 * Task-039). Der Text im Chip trägt diese Farbe; ohne Kontrast wäre die
 * Ampel für die Hälfte der Nutzer unlesbar.
 *
 *   Light: Papier #fff        Dark: Papier #1e1e1e / Grund #121212
 */
export function useTargetStatusColors(): Record<TargetStatus, string> {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'
  return dark
    ? {
        green: '#6fcf8f',
        amber: '#f2b64d',
        red: '#ff8a80',
        open: '#b0b8c0',
      }
    : {
        green: '#1e7a3c',
        amber: '#9a5b00',
        red: '#c62828',
        open: '#5c6670',
      }
}

const percent = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 0,
})

/** `0.934` → `93 %`; ohne Verhältnis leer. */
export function formatRatio(ratio: number | null | undefined): string {
  return ratio === null || ratio === undefined ? '' : percent.format(ratio)
}

interface Props {
  evaluation: TargetEvaluation
  /** `small` in Tabellen, `medium` in Kacheln. */
  size?: 'small' | 'medium'
  /** Verhältnis Ist/Ziel mit anzeigen (Vorgabe: ja). */
  withRatio?: boolean
}

/**
 * Ampel als Chip: farbiger Punkt + Textlabel + Verhältnis. Die Farbe ist nie
 * der einzige Träger - Label und Zahl stehen immer dabei. `data-status`
 * trägt den Zustand für Tests und die Kontrastprüfung.
 */
export default function TargetStatusChip({
  evaluation,
  size = 'small',
  withRatio = true,
}: Props) {
  const colors = useTargetStatusColors()
  const color = colors[evaluation.status]
  const ratio = withRatio ? formatRatio(evaluation.ratio) : ''
  const text = ratio ? `${evaluation.label} · ${ratio}` : evaluation.label
  return (
    <Chip
      size={size}
      variant="outlined"
      data-status={evaluation.status}
      icon={
        <Box
          component="span"
          aria-hidden
          sx={{
            width: size === 'small' ? 10 : 12,
            height: size === 'small' ? 10 : 12,
            borderRadius: '50%',
            bgcolor: color,
            ml: 1,
            flexShrink: 0,
          }}
        />
      }
      label={text}
      sx={{
        color,
        borderColor: color,
        fontWeight: 600,
        '& .MuiChip-label': { color },
      }}
    />
  )
}
