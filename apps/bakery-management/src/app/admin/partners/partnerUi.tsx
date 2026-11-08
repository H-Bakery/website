'use client'

import React, { useEffect } from 'react'
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
 * andere mit Besuchen heißt „vorläufig“ (docs/domains/verkaufspartner.md).
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

/**
 * Ungespeicherte Eingaben nicht still verlieren: solange `active`, fragt ein
 * Klick auf einen internen Link (Rücklink, Seitenleiste, Brotkrumen) nach,
 * und Neuladen/Schließen zeigt die Browser-Rückfrage.
 *
 * `beforeunload` allein reicht nicht - Links des App-Routers wechseln die
 * Seite ohne Neuladen. Der Klick wird deshalb im Capture-Schritt am
 * `document` abgefangen, bevor Next.js ihn bekommt.
 */
export function useConfirmLeave(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return undefined
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      const target = event.target as Element | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (
        !anchor ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      ) {
        return
      }
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return
      }
      if (!window.confirm(message)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [active, message])
}
