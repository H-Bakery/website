'use client'

import React from 'react'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Typography,
} from '@mui/material'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { BS_DESK } from './BackstubeRow'
import { useBackstubeColors } from './backstubeColors'

/**
 * Zustände, die Zettel, Backliste und Vorbereitung gleich zeigen: laden,
 * Fehler beim ersten Laden, alter Stand nach gescheitertem Neuladen,
 * Ruhetag/geschlossen. Eine Stelle, damit alle drei Reiter gleich aussehen.
 */

export function BackstubeLoading({ label }: { label: string }) {
  return (
    <Box sx={{ py: 8, textAlign: 'center' }}>
      <CircularProgress aria-label={label} size={48} />
    </Box>
  )
}

export function BackstubeLoadFailed({
  text,
  onRetry,
}: {
  text: string
  onRetry: () => void
}) {
  return (
    <Alert
      severity="error"
      sx={{ fontSize: '1.15rem', alignItems: 'center' }}
      action={
        <Button
          color="inherit"
          variant="outlined"
          onClick={onRetry}
          sx={{ minHeight: 56, fontSize: '1.05rem', fontWeight: 700 }}
        >
          Erneut versuchen
        </Button>
      }
    >
      {text}
    </Alert>
  )
}

/** Neu laden gescheitert, der letzte Stand bleibt stehen. */
export function BackstubeStaleNotice({
  error,
  loadedAt,
}: {
  error: { text: string; offline: boolean }
  loadedAt: string | null
}) {
  return (
    <Alert severity="warning" sx={{ fontSize: '1.1rem' }}>
      {error.offline ? error.text : `Neu laden fehlgeschlagen: ${error.text}`}{' '}
      Angezeigt wird der Stand von {loadedAt ?? '–'}.
    </Alert>
  )
}

export function BackstubeClosedDay({
  testId,
  title,
  text,
}: {
  testId: string
  title: string
  text: string
}) {
  return (
    <Box
      data-testid={testId}
      sx={{
        py: { xs: 6, sm: 8 },
        px: 2,
        textAlign: 'center',
        borderRadius: 3,
        border: '2px dashed',
        borderColor: 'divider',
      }}
    >
      <EventBusyIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
      <Typography sx={{ fontSize: '2.25rem', fontWeight: 800, mt: 1 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: '1.25rem', color: 'text.secondary' }}>
        {text}
      </Typography>
    </Box>
  )
}

/**
 * Punktlinie vom Namen zur Menge (wie auf einer Preisliste): auf dem
 * Rechner liegen Name und Zahl weit auseinander - die Linie führt das Auge in
 * derselben Zeile hinüber. Auf dem Tablet steht die Menge vorn (UI-Runde 2),
 * dort braucht es keine Linie.
 */
export function NameLeader() {
  return (
    <Box
      component="span"
      aria-hidden
      data-print="hide"
      sx={{
        display: 'none',
        [BS_DESK]: { display: 'block' },
        flex: 1,
        minWidth: 24,
        ml: 1.5,
        alignSelf: 'flex-end',
        mb: '0.3em',
        borderBottom: '3px dotted',
        borderColor: 'divider',
      }}
    />
  )
}

/**
 * UI-Runde 2: kurzer Hinweis „3 neue Nachträge“ - die Nachträge selbst
 * stehen nur an einer Stelle (Backen: unten bei den Zeilen, mit „Gesehen“
 * und gebacken-Haken). Ein Tipp springt dorthin.
 */
export function BackstubeDeltaBanner({
  count,
  onOpen,
  testId,
}: {
  count: number
  onOpen: () => void
  testId: string
}) {
  const colors = useBackstubeColors()
  return (
    <ButtonBase
      data-testid={testId}
      data-print="hide"
      onClick={onOpen}
      sx={{
        width: '100%',
        minHeight: 64,
        px: 2,
        py: 1,
        gap: 1.5,
        justifyContent: 'flex-start',
        textAlign: 'left',
        borderRadius: 2,
        border: '3px solid',
        borderColor: colors.deltaEdge,
        bgcolor: colors.deltaRow,
        color: 'text.primary',
        '&:focus-visible': { outline: '3px solid', outlineOffset: 2 },
      }}
    >
      <Box
        component="span"
        sx={{
          minWidth: 44,
          height: 44,
          px: 1,
          borderRadius: 1.5,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: colors.deltaBg,
          color: colors.deltaFg,
          fontSize: '1.4rem',
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count}
      </Box>
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
        <Box
          component="span"
          sx={{ display: 'block', fontSize: '1.2rem', fontWeight: 800 }}
        >
          {count === 1 ? 'Neuer Nachtrag' : 'Neue Nachträge'}
        </Box>
        <Box
          component="span"
          sx={{ display: 'block', fontSize: '1rem', color: 'text.secondary' }}
        >
          Antippen zum Ansehen
        </Box>
      </Box>
      <ArrowDownwardIcon sx={{ fontSize: 28 }} />
    </ButtonBase>
  )
}

/** Überschrift einer Gruppe in der Hauptspalte (Teige heute, Backtag). */
export function BackstubeGroupHeading({
  id,
  children,
  testId,
}: {
  id?: string
  children: React.ReactNode
  testId?: string
}) {
  return (
    <Typography
      component="h2"
      id={id}
      tabIndex={-1}
      data-testid={testId}
      sx={{
        fontSize: { xs: '1.6rem', sm: '2.1rem' },
        fontWeight: 800,
        lineHeight: 1.15,
        pb: 0.75,
        borderBottom: '3px solid',
        borderColor: 'text.primary',
        outline: 'none',
      }}
    >
      {children}
    </Typography>
  )
}
