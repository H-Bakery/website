'use client'

import React from 'react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter'

import { shopTheme } from './theme'

/**
 * Emotion-Cache + MUI-Theme für den Shop.
 *
 * Muss im Root-Layout um den kompletten Baum liegen — ohne den ThemeProvider
 * rendert MUI in seinen Standardfarben (Blau/Lila) statt in den Markenfarben.
 * Der Shop kennt bewusst nur den hellen, warmen Look.
 *
 * `<CssBaseline />` ist hier keine Kosmetik: es trägt den Fokusring für alles,
 * was kein MUI-Bedienelement ist, und die `prefers-reduced-motion`-Regel. Beide
 * müssen aus dem Theme kommen, nicht aus `global.css` — Emotion hängt seine
 * `<style>`-Tags hinter das Next-Stylesheet, und MUIs eigenes `outline: 0`
 * (ButtonBase) hat dieselbe Spezifität wie ein globales `:focus-visible`.
 * Bei Gleichstand gewinnt das Spätere. Ein Fokusring in `global.css` ist
 * deshalb auf jedem Button wirkungslos; siehe Kommentar in `theme.ts`.
 */
export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <ThemeProvider theme={shopTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}
