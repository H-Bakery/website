'use client'

import React from 'react'
import { Chip, type ChipProps } from '@mui/material'
import { WEEKDAY_SHORT, type SettlementModel } from '../../../lib/partnerTypes'

/**
 * Gemeinsame Bausteine der Backschrank-Seiten (Übersicht, Partner, Report,
 * Vorlagen, Erfassung): Bezeichnungen und der Tagesstatus, damit dieselbe
 * Lage überall gleich heißt.
 */

export const SETTLEMENT_LABELS: Record<SettlementModel, string> = {
  commission: 'Kommission',
  firm_sale: 'Festkauf',
}

export const SETTLEMENT_DESCRIPTIONS: Record<SettlementModel, string> = {
  commission:
    'Abgerechnet wird nur, was verkauft wurde - die Reste kommen zurück.',
  firm_sale: 'Die gelieferte Ware wird fest abgerechnet.',
}

/**
 * Liefertage kurz: aufeinanderfolgende Tage als Spanne („Di–Sa“), sonst
 * einzeln („Di, Do, Sa“). Leer: „keine Liefertage“.
 */
export function deliveryDaysText(days: number[] | null | undefined): string {
  const sorted = Array.from(
    new Set((days ?? []).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))
  ).sort((a, b) => a - b)
  if (sorted.length === 0) return 'keine Liefertage'
  const runs: number[][] = []
  for (const day of sorted) {
    const run = runs[runs.length - 1]
    if (run && day === run[run.length - 1] + 1) run.push(day)
    else runs.push([day])
  }
  return runs
    .map((run) =>
      run.length >= 3
        ? `${WEEKDAY_SHORT[run[0]]}–${WEEKDAY_SHORT[run[run.length - 1]]}`
        : run.map((d) => WEEKDAY_SHORT[d]).join(', ')
    )
    .join(', ')
}

/**
 * Lage eines Geschäftstags am Backschrank. Nur `closed` ist endgültig; jede
 * andere mit Besuchen heißt „vorläufig“ (CLAUDE.md, Verkaufspartner).
 */
export type DayState =
  | 'no-delivery'
  | 'no-visit'
  | 'open'
  | 'incomplete'
  | 'closed'

export function dayStateOf({
  visitCount,
  isOpen,
  isComplete,
  isDeliveryDay,
}: {
  visitCount: number
  isOpen: boolean
  isComplete: boolean
  isDeliveryDay: boolean
}): DayState {
  if (visitCount === 0) return isDeliveryDay ? 'no-visit' : 'no-delivery'
  if (isOpen) return 'open'
  if (!isComplete) return 'incomplete'
  return 'closed'
}

export const DAY_STATE_LABELS: Record<DayState, string> = {
  'no-delivery': 'Kein Liefertag',
  'no-visit': 'Noch kein Besuch',
  open: 'Abholung fehlt',
  incomplete: 'Abholung unvollständig',
  closed: 'Abgeschlossen',
}

const DAY_STATE_COLORS: Record<DayState, ChipProps['color']> = {
  'no-delivery': 'default',
  'no-visit': 'warning',
  open: 'warning',
  incomplete: 'warning',
  closed: 'success',
}

/** Zahlen des Tages sind vorläufig (es gab Besuche, aber keinen Abschluss). */
export function isProvisionalState(state: DayState): boolean {
  return state === 'open' || state === 'incomplete'
}

/**
 * Status-Chip des Tages - umrandet: Schrift in `*.main` auf dem Seitengrund
 * statt dunkler Schrift auf getönter Fläche (Kontrast im Dunkelmodus).
 */
export function DayStateChip({
  state,
  label,
}: {
  state: DayState
  /** Anderer Text für dieselbe Lage (z. B. „Tag abgeschlossen“). */
  label?: string
}) {
  return (
    <Chip
      size="small"
      variant="outlined"
      color={DAY_STATE_COLORS[state]}
      label={label ?? DAY_STATE_LABELS[state]}
      data-testid="day-state"
      data-state={state}
    />
  )
}

/** Kleiner Marker „vorläufig“ an einer Kennzahl (`KeyFigures` `badge`). */
export function ProvisionalBadge() {
  return (
    <Chip
      size="small"
      variant="outlined"
      color="warning"
      label="vorläufig"
      sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 12 } }}
    />
  )
}
