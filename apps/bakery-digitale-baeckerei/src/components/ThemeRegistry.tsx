'use client'
import React from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import { Experimental_CssVarsProvider as CssVarsProvider } from '@mui/material/styles'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import { digitaleBaeckereiTheme } from './theme'

/**
 * Die Seite ist ein einziges Bild in voller Höhe: kein Scrollen, kein
 * Gummiband-Effekt beim Ziehen (wichtig, sobald das Kamera-Rig in P1 auf
 * Ziehen reagiert).
 */
const globalStyles = (
  <GlobalStyles
    styles={{
      'html, body': {
        height: '100%',
        margin: 0,
        overflow: 'hidden',
        overscrollBehavior: 'none',
      },
    }}
  />
)

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <CssVarsProvider theme={digitaleBaeckereiTheme} defaultMode="system">
        <CssBaseline enableColorScheme />
        {globalStyles}
        {children}
      </CssVarsProvider>
    </AppRouterCacheProvider>
  )
}
