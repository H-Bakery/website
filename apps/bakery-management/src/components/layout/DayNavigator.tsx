'use client'
import React from 'react'
import {
  Box,
  Button,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
} from '@mui/icons-material'

/**
 * Tageswechsel einer Tagesseite (Layout-Kit, README.md): Pfeil zurück,
 * Datumsfeld, Pfeil vor, optional „Heute“. Überall dieselbe Reihenfolge und
 * derselbe Platz - ganz vorne im `actions`-Slot von `PageLayout` -, damit
 * „anderen Tag ansehen“ auf jeder Seite dieselbe Handbewegung ist.
 *
 * Gerechnet wird mit Kalenderdaten `YYYY-MM-DD` (ohne Uhrzeit, ohne
 * Zeitzone). Wer Ruhetage überspringen will (Backzettel, Abholliste), gibt
 * `step` mit; `null` aus `step` sperrt den Pfeil.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** `2026-11-07` ± n Kalendertage; ungültige Eingabe → `null`. */
export function shiftIsoDate(date: string, days: number): string | null {
  const match = ISO_DATE.exec(date)
  if (!match) return null
  const [, y, m, d] = match
  const time = Date.UTC(Number(y), Number(m) - 1, Number(d))
  // Ein kalendarisch unmögliches Datum (2026-02-30) rollte sonst still weiter.
  const check = new Date(time)
  if (
    check.getUTCFullYear() !== Number(y) ||
    check.getUTCMonth() !== Number(m) - 1 ||
    check.getUTCDate() !== Number(d)
  ) {
    return null
  }
  // UTC-Mitternacht: kein Sommerzeit-Sprung verschiebt den Tag.
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10)
}

export interface DayNavigatorProps {
  /** Angezeigter Tag, `YYYY-MM-DD`. */
  value: string
  onChange: (date: string) => void
  /** Beschriftung des Datumsfelds, z. B. „Abholtag“. Standard: „Tag“. */
  label?: string
  /**
   * Nächster/voriger Tag ab `date` in Richtung `direction`. Standard: ein
   * Kalendertag. `null` = in diese Richtung geht es nicht weiter.
   */
  step?: (date: string, direction: 1 | -1) => string | null
  /** Frühester / spätester wählbarer Tag (`YYYY-MM-DD`). */
  min?: string
  max?: string
  /** Text für Pfeile (Tooltip + Screenreader). */
  prevLabel?: string
  nextLabel?: string
  /** Mit `today` erscheint „Heute“ (gesperrt, wenn der Tag schon heute ist). */
  today?: string
  todayLabel?: string
  disabled?: boolean
  /**
   * Zeigt die Seite keinen einzelnen Tag, sondern einen Monat oder ein Jahr
   * (Dienstplan), steht statt des Datumsfelds dieser Text zwischen den
   * Pfeilen, z. B. „November 2026“. `value` bleibt der erste Tag des
   * Zeitraums; gewechselt wird dann nur mit Pfeilen und „Heute“.
   */
  display?: string
  'data-testid'?: string
}

function within(date: string | null, min?: string, max?: string) {
  if (!date) return null
  if (min && date < min) return null
  if (max && date > max) return null
  return date
}

export function DayNavigator({
  value,
  onChange,
  label = 'Tag',
  step,
  min,
  max,
  prevLabel = 'Vorheriger Tag',
  nextLabel = 'Nächster Tag',
  today,
  todayLabel = 'Heute',
  disabled = false,
  display,
  'data-testid': testId = 'day-navigator',
}: DayNavigatorProps) {
  const go = (direction: 1 | -1) =>
    within(
      step ? step(value, direction) : shiftIsoDate(value, direction),
      min,
      max
    )
  const prev = disabled ? null : go(-1)
  const next = disabled ? null : go(1)

  const arrow = (
    target: string | null,
    text: string,
    icon: React.ReactNode
  ) => (
    <Tooltip title={text}>
      {/* span: ein gesperrter Knopf löst keinen Tooltip aus */}
      <span>
        <IconButton
          aria-label={text}
          disabled={!target}
          onClick={() => target && onChange(target)}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  )

  return (
    <Box
      role="group"
      aria-label={`${label} wechseln`}
      data-testid={testId}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        // am Handy eine eigene, volle Zeile im Aktionsblock
        flex: { xs: '1 1 100%', sm: '0 0 auto' },
        '@media print': { display: 'none' },
      }}
    >
      {arrow(prev, prevLabel, <PrevIcon />)}
      {display !== undefined ? (
        <Typography
          component="span"
          aria-live="polite"
          data-testid={`${testId}-value`}
          sx={{
            minWidth: 160,
            flex: { xs: 1, sm: 'none' },
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          {display}
        </Typography>
      ) : (
        <TextField
          label={label}
          type="date"
          size="small"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            if (ISO_DATE.test(event.target.value)) onChange(event.target.value)
          }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min, max }}
          sx={{ minWidth: 160, flex: { xs: 1, sm: 'none' } }}
        />
      )}
      {arrow(next, nextLabel, <NextIcon />)}
      {today && (
        <Button
          variant="text"
          disabled={disabled || value === today}
          onClick={() => onChange(today)}
        >
          {todayLabel}
        </Button>
      )}
    </Box>
  )
}

export default DayNavigator
