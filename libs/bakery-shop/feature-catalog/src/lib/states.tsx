'use client'

/**
 * @fileoverview Lade-, Fehler- und Leerzustände des Shops.
 *
 * Alle drei sagen, was los ist, und bieten den nächsten Schritt an – kein
 * Achselzucken, keine Entschuldigung.
 *
 * Zum Laden: **Skelett statt Spinner.** Ein Spinner sagt „warte", ein Skelett
 * sagt „hier kommt eine Liste mit Bild, Titel und Preis" – und weil es dieselben
 * Maße hat wie der echte Inhalt, springt beim Eintreffen der Daten nichts.
 */

import * as React from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchOffIcon from '@mui/icons-material/SearchOff'

/* -------------------------------------------------------------------------- */
/* Skelett-Bausteine                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Sichtbare Skelett-Töne.
 *
 * MUIs Voreinstellung im Shop-Theme ist `grey.100` (#F5EDE4) – auf weißem
 * Papier sind das 1,13:1, also praktisch nichts. Diese beiden Werte sind der
 * verbindliche Ersatz: `BLOCK` (`grey.200`, 1,40:1) für große Flächen wie
 * Bildbahnen, `BAR` (`grey.300`, 1,70:1) für Text- und Bedienbalken.
 * Beide bleiben ruhig genug, um nicht wie Inhalt auszusehen.
 */
export const SHOP_SKELETON_BLOCK = 'grey.200'
export const SHOP_SKELETON_BAR = 'grey.300'

export interface ShopSkeletonProps {
  width?: number | string
  height?: number | string
  /** Große Fläche (Bild, Karte) statt schmalem Balken. */
  block?: boolean
  variant?: 'rounded' | 'rectangular' | 'circular'
  sx?: SxProps<Theme>
}

/**
 * Ein Skelettbalken im Shop-Ton. Überall statt `CircularProgress` benutzen –
 * das Token ist die einzige Stelle, an der die Farbe steht.
 *
 * ```tsx
 * import { ShopSkeleton, ShopSkeletonText } from '@bakery/shop/feature-catalog'
 *
 * <ShopSkeleton block variant="rectangular" sx={{ aspectRatio: '1 / 1' }} />
 * <ShopSkeletonText lines={3} />
 * ```
 */
export function ShopSkeleton({
  width,
  height,
  block = false,
  variant = 'rounded',
  sx,
}: ShopSkeletonProps) {
  return (
    <Skeleton
      variant={variant}
      animation="wave"
      width={width}
      height={height}
      sx={[
        { bgcolor: block ? SHOP_SKELETON_BLOCK : SHOP_SKELETON_BAR },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  )
}

export interface ShopSkeletonTextProps {
  /** Anzahl der Zeilen. Die letzte ist bewusst kürzer. */
  lines?: number
  height?: number
  sx?: SxProps<Theme>
}

/** Ein Absatz als Skelett – letzte Zeile kurz, wie echter Fließtext. */
export function ShopSkeletonText({
  lines = 3,
  height = 12,
  sx,
}: ShopSkeletonTextProps) {
  return (
    <Box
      aria-hidden="true"
      sx={[
        { display: 'flex', flexDirection: 'column', gap: 1 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {Array.from({ length: lines }, (_, index) => (
        <ShopSkeleton
          key={index}
          height={height}
          width={index === lines - 1 ? '62%' : '100%'}
        />
      ))}
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Fehler                                                                      */
/* -------------------------------------------------------------------------- */

export interface LoadErrorStateProps {
  message: string
  onRetry: () => void
  title?: string
}

export function LoadErrorState({
  message,
  onRetry,
  title = 'Wir kommen gerade nicht an unsere Produkte',
}: LoadErrorStateProps) {
  return (
    <Alert
      severity="error"
      action={
        <Button
          color="inherit"
          size="small"
          startIcon={<RefreshIcon fontSize="small" />}
          onClick={onRetry}
          sx={{ minHeight: 44 }}
        >
          Erneut versuchen
        </Button>
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {message}
    </Alert>
  )
}

/* -------------------------------------------------------------------------- */
/* Leer                                                                        */
/* -------------------------------------------------------------------------- */

export interface EmptyStateProps {
  testId?: string
  headline: string
  hint: string
  action?: React.ReactNode
}

export function EmptyState({
  testId,
  headline,
  hint,
  action,
}: EmptyStateProps) {
  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        textAlign: 'center',
        py: { xs: 6, md: 8 },
        px: 2,
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'grey.50',
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 64,
          height: 64,
          borderRadius: '50%',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          color: 'grey.400',
        }}
      >
        <SearchOffIcon sx={{ fontSize: 32 }} />
      </Box>
      <Typography variant="h5" component="p" sx={{ color: 'text.primary' }}>
        {headline}
      </Typography>
      <Typography
        variant="body2"
        // Der Hinweis zitiert den Suchbegriff; ein langes Wort ohne Leerzeichen
        // darf die Seite am Telefon nicht breiter machen als den Bildschirm.
        sx={{ color: 'grey.500', maxWidth: 420, overflowWrap: 'anywhere' }}
      >
        {hint}
      </Typography>
      {action}
    </Box>
  )
}
