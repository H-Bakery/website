'use client'
import React, { useEffect, useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { PageSection } from '../layout'
import type { RangePreset } from './dateRange'

/**
 * Zeitraum-Filter der Zahlen-Seiten (Kassenberichte, Analysen,
 * Rest-Auswertung, Tagesverlauf des Tagesziels) - überall gleich: Von/Bis,
 * „Anzeigen“ und darunter die üblichen Zeiträume als Schnellwahl.
 *
 * Geladen wird erst mit „Anzeigen“ oder einer Schnellwahl, nicht bei jedem
 * Tastendruck im Datumsfeld (das löste vorher je Ziffer eine Anfrage aus).
 * Ein Anfang nach dem Ende wird angesagt und nicht geschickt.
 */
export interface DateRangeFilterProps {
  /** Angewendeter Zeitraum (`YYYY-MM-DD`). */
  from: string
  to: string
  onApply: (from: string, to: string) => void
  presets?: RangePreset[]
  /** Während einer Anfrage: Knöpfe gesperrt. */
  busy?: boolean
  min?: string
  max?: string
  /** Eine Zeile unter den Feldern (z. B. „Archiv 12.09.2026 – 06.11.2026“). */
  note?: React.ReactNode
  /**
   * Längster erlaubter Zeitraum in Tagen. Die API lehnt längere mit
   * `range_too_large` ab - die Analysen meldeten das als „API liefert keine
   * Daten“; hier wird es vorher gesagt.
   */
  maxDays?: number
  /** Ohne eigene Karte (z. B. innerhalb eines Abschnitts). */
  bare?: boolean
  'data-testid'?: string
}

export const RANGE_ORDER_MESSAGE = 'Der Anfang muss vor dem Ende liegen.'

export function rangeTooLongMessage(maxDays: number): string {
  return `Höchstens ${maxDays.toLocaleString('de-DE')} Tage auf einmal.`
}

/** Kalendertage von `from` bis `to`, beide eingeschlossen. */
export function rangeDays(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`)
  const b = Date.parse(`${to}T12:00:00Z`)
  return Math.round((b - a) / 86400000) + 1
}

export function DateRangeFilter({
  from,
  to,
  onApply,
  presets = [],
  busy = false,
  min,
  max,
  note,
  maxDays,
  bare = false,
  'data-testid': testId,
}: DateRangeFilterProps) {
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)

  // Ein neuer angewendeter Zeitraum (Schnellwahl, Server-Kürzung) ersetzt
  // die Felder.
  useEffect(() => {
    setDraftFrom(from)
    setDraftTo(to)
  }, [from, to])

  const filled = Boolean(draftFrom && draftTo)
  const ordered = !filled || draftFrom <= draftTo
  const tooLong =
    filled && ordered && maxDays !== undefined
      ? rangeDays(draftFrom, draftTo) > maxDays
      : false
  const valid = filled && ordered && !tooLong
  const changed = draftFrom !== from || draftTo !== to

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    onApply(draftFrom, draftTo)
  }

  const form = (
    <Box
      component="form"
      onSubmit={submit}
      data-testid={testId}
      aria-label="Zeitraum"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 1.5,
        }}
      >
        <TextField
          label="Von"
          type="date"
          size="small"
          value={draftFrom}
          onChange={(e) => setDraftFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'aria-label': 'Von', min, max: draftTo || max }}
          sx={{ flex: '1 1 9.5rem', minWidth: 0, maxWidth: { sm: 200 } }}
        />
        <TextField
          label="Bis"
          type="date"
          size="small"
          value={draftTo}
          onChange={(e) => setDraftTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'aria-label': 'Bis', min: draftFrom || min, max }}
          sx={{ flex: '1 1 9.5rem', minWidth: 0, maxWidth: { sm: 200 } }}
        />
        <Button
          type="submit"
          variant="outlined"
          color={changed ? 'primary' : 'inherit'}
          disabled={busy || !valid}
          sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' }, minHeight: 40 }}
        >
          Anzeigen
        </Button>
      </Box>
      {(!ordered || tooLong) && (
        <Typography color="error" variant="body2" role="alert">
          {!ordered
            ? RANGE_ORDER_MESSAGE
            : rangeTooLongMessage(maxDays as number)}
        </Typography>
      )}
      {presets.length > 0 && (
        <Box
          role="group"
          aria-label="Schnellwahl Zeitraum"
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
        >
          {presets.map((p) => {
            const active = p.from === from && p.to === to
            return (
              <Button
                key={p.label}
                size="small"
                variant="outlined"
                color={active ? 'primary' : 'inherit'}
                aria-pressed={active}
                disabled={busy}
                onClick={() => onApply(p.from, p.to)}
                sx={{
                  whiteSpace: 'nowrap',
                  borderColor: active ? undefined : 'divider',
                  bgcolor: active ? 'action.selected' : undefined,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {p.label}
              </Button>
            )
          })}
        </Box>
      )}
      {note && (
        <Typography variant="body2" color="text.secondary">
          {note}
        </Typography>
      )}
    </Box>
  )

  return bare ? form : <PageSection>{form}</PageSection>
}

export default DateRangeFilter
