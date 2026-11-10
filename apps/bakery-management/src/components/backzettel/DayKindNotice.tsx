'use client'

import React from 'react'
import { Alert, AlertTitle } from '@mui/material'

import type { CalendarHint, DayKind } from '../../lib/backzettelApi'

export interface DayKindNoticeProps {
  dayKind?: DayKind | null
  calendarHint?: CalendarHint | null
  /** Tablet (`/backstube`): größere Schrift. */
  large?: boolean
}

/**
 * U9: Tagestyp aus dem Kalender über dem Zettel - „Samstags-Satz“, „Vor
 * Feiertag“, „Wie Sonntag“, „Nur Teig“ - mit Notiz und den geschlossenen
 * Tagen danach; darunter, falls der Kalender fehlt oder ungültig ist, der
 * Hinweis dazu. Am normalen Tag mit gültigem Kalender: nichts.
 */
export function DayKindNotice({
  dayKind,
  calendarHint,
  large = false,
}: DayKindNoticeProps) {
  const label = dayKind?.label ?? null
  if (!label && !calendarHint) return null
  const sx = large ? { fontSize: '1.05rem' } : undefined
  const titleSx = large ? { fontSize: '1.2rem', fontWeight: 700 } : undefined
  return (
    <>
      {label && (
        <Alert
          severity={dayKind?.before ? 'warning' : 'info'}
          data-testid="day-kind"
          sx={sx}
        >
          <AlertTitle sx={titleSx}>{label}</AlertTitle>
          {dayKind?.detail}
        </Alert>
      )}
      {calendarHint && (
        <Alert severity="info" data-testid="calendar-hint" sx={sx}>
          {calendarHint.message}
        </Alert>
      )}
    </>
  )
}

export default DayKindNotice
