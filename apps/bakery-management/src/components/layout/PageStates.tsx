'use client'
import React from 'react'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Typography,
} from '@mui/material'
import { OFFLINE_TEXT } from '../../lib/backstubeErrors'

/**
 * Lade-, Leer- und Fehlerzustand einer Seite oder eines Abschnitts
 * (Layout-Kit, README.md) - überall gleich, damit niemand rätselt, ob eine
 * leere Fläche „lädt“, „nichts da“ oder „kaputt“ heißt.
 */

export interface LoadingStateProps {
  /** Sichtbar und für Screenreader, z. B. „Benutzer werden geladen …“. */
  label?: string
  /** Kompakt (in einer Karte/Zeile) statt mit viel Luft. */
  dense?: boolean
}

export function LoadingState({
  label = 'Wird geladen …',
  dense = false,
}: LoadingStateProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        py: dense ? 2 : 6,
        color: 'text.secondary',
      }}
    >
      <CircularProgress size={dense ? 20 : 28} aria-label={label} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  )
}

export interface EmptyStateProps {
  /** Was fehlt, in einem Satz: „Noch keine Vorbestellungen für diesen Tag.“ */
  title: React.ReactNode
  /** Was man tun kann - eine Zeile. */
  description?: React.ReactNode
  /** Optional genau eine Aktion (z. B. „Vorbestellung erfassen“). */
  action?: React.ReactNode
  icon?: React.ReactNode
  'data-testid'?: string
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  'data-testid': testId,
}: EmptyStateProps) {
  return (
    <Box
      data-testid={testId}
      sx={{
        textAlign: 'center',
        px: 2,
        py: { xs: 4, md: 5 },
        border: 1,
        borderStyle: 'dashed',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      {icon && (
        <Box
          aria-hidden
          sx={{
            color: 'text.secondary',
            mb: 1,
            '& svg': { fontSize: 40 },
          }}
        >
          {icon}
        </Box>
      )}
      <Typography variant="subtitle1" component="p" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  )
}

/** Was Browser und Proxy statt einer Antwort melden - nie so anzeigen. */
const RAW_NETWORK_MESSAGE =
  /^(TypeError: )?(Failed to fetch|fetch failed|Load failed|NetworkError( when attempting to fetch resource)?\.?|Network request failed|Request timeout|HTTP 50[234]\b.*)$/i

/**
 * Sicherheitsnetz für `ErrorState`: eine rohe Browser-/Proxy-Meldung
 * („Failed to fetch“, „HTTP 502: Bad Gateway“) wird zum deutschen Satz des
 * Backstube-Tablets. Seiten sollten ihre Fehler selbst übersetzen
 * (`describeBackstubeError`, `backzettelErrorText`, `errorText`,
 * `describeAuthError`); was durchrutscht, landet nicht englisch beim Personal.
 */
export function displayErrorMessage(message: React.ReactNode): React.ReactNode {
  if (typeof message === 'string' && RAW_NETWORK_MESSAGE.test(message.trim())) {
    return OFFLINE_TEXT
  }
  return message
}

export interface ErrorStateProps {
  /** Deutsche Meldung (bei API-Fehlern deren `message`). */
  message: React.ReactNode
  title?: React.ReactNode
  onRetry?: () => void
  retryLabel?: string
  'data-testid'?: string
}

/**
 * Fehler, der die Seite/den Abschnitt am Arbeiten hindert. Mit `onRetry`
 * steht „Erneut versuchen“ in der Meldung. Hinweise, die nur informieren,
 * sind kein Fehler - dafür `Alert severity="info"` (siehe README).
 */
export function ErrorState({
  message,
  title,
  onRetry,
  retryLabel = 'Erneut versuchen',
  'data-testid': testId,
}: ErrorStateProps) {
  return (
    <Alert
      severity="error"
      data-testid={testId}
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined
      }
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {displayErrorMessage(message)}
    </Alert>
  )
}
