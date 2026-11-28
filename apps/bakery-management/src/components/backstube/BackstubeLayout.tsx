'use client'

import React from 'react'
import { Box, Stack } from '@mui/material'
import { BS_PAGE_MAX_WIDTH } from './BackstubeHeader'

/**
 * Ab dieser Breite zwei Spalten: Tablet quer (1180 px) und Desktop. Darunter
 * (Tablet hochkant, Handy) steht der Überblick über den Zeilen.
 */
export const BS_WIDE = '@media (min-width: 1080px)'
export const BS_XWIDE = '@media (min-width: 1400px)'

/** Höhe des festen Kopfes (gemessen); Abschnitte springen darunter. */
export const BS_HEADER_VAR = '--bs-header-h'

/** Sprungziele bleiben unter dem festen Kopf frei. */
export const BS_ANCHOR_SX = {
  scrollMarginTop: `calc(var(${BS_HEADER_VAR}, 140px) + 16px)`,
} as const

export interface BackstubeLayoutProps {
  /** Überblick, Nachträge, Hinweise - links bzw. oben. */
  aside?: React.ReactNode
  /** Was zu tun ist: die Zeilen. */
  children: React.ReactNode
  /** Ohne Seitenspalte (Vorbereitung, Lade-/Fehlerzustand). */
  narrow?: boolean
}

/**
 * Zwei Spalten ab 1080 px: links ein schmaler, mitlaufender Überblick
 * (eigener Bildlauf), rechts die Zeilen - die Haken bleiben am rechten Rand,
 * wo der Daumen ist, und eine Zeile wird nie breiter als ~960 px (aus
 * Armlänge rutscht das Auge sonst eine Zeile daneben, UI-Runde 1).
 */
export function BackstubeLayout({
  aside,
  children,
  narrow = false,
}: BackstubeLayoutProps) {
  const twoColumns = !narrow && !!aside
  return (
    <Box
      sx={{
        maxWidth: twoColumns ? BS_PAGE_MAX_WIDTH : 960,
        mx: 'auto',
        px: { xs: 2, sm: 3 },
        pt: { xs: 2, sm: 2.5 },
        display: 'grid',
        gap: { xs: 2, sm: 2.5 },
        gridTemplateColumns: 'minmax(0, 1fr)',
        ...(twoColumns
          ? {
              [BS_WIDE]: {
                gridTemplateColumns: '360px minmax(0, 1fr)',
                gap: 3,
                alignItems: 'start',
              },
              [BS_XWIDE]: { gridTemplateColumns: '420px minmax(0, 1fr)' },
            }
          : {}),
      }}
    >
      {twoColumns && (
        <Stack
          component="aside"
          aria-label="Überblick und Nachträge"
          data-testid="bs-aside"
          spacing={2}
          sx={{
            minWidth: 0,
            [BS_WIDE]: {
              position: 'sticky',
              top: `calc(var(${BS_HEADER_VAR}, 140px) + 20px)`,
              maxHeight: `calc(100vh - var(${BS_HEADER_VAR}, 140px) - 32px)`,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              // Platz für den Fokusring und die Bildlaufleiste
              pr: 0.5,
              pb: 2,
            },
            '@media print': {
              position: 'static',
              maxHeight: 'none',
              overflow: 'visible',
            },
          }}
        >
          {aside}
        </Stack>
      )}
      <Stack
        spacing={2}
        sx={{ minWidth: 0, maxWidth: twoColumns ? 940 : undefined }}
        data-testid="bs-main"
      >
        {children}
      </Stack>
    </Box>
  )
}

export default BackstubeLayout
