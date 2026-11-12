'use client'
import React from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import { ThemeProvider } from '@mui/material/styles'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import { FARBSCHEMA_CSS, digitaleBaeckereiTheme } from './theme'

/**
 * Die Seite ist ein einziges Bild in voller Höhe: kein Scrollen, kein
 * Gummiband-Effekt beim Ziehen. Dazu die Farben beider Schemata als
 * CSS-Variablen - hell/dunkel folgt dem System, nichts wird gespeichert
 * (siehe theme.ts).
 */
const globalStyles = (
  <GlobalStyles
    styles={{
      ...FARBSCHEMA_CSS,
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
      <ThemeProvider theme={digitaleBaeckereiTheme}>
        <CssBaseline />
        {globalStyles}
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}
