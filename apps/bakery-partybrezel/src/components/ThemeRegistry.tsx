'use client'
import React from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import { Experimental_CssVarsProvider as CssVarsProvider } from '@mui/material/styles'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import { partybrezelTheme } from './theme'

/**
 * - scroll-padding: der Hinweis oben klebt (sticky), die Schritt-Leiste unten
 *   ist fest. Ohne Abstand scrollt der Browser ein per Tab fokussiertes
 *   Element nur bis an den Rand - und damit unter die Leiste (WCAG 2.4.11).
 *   Unter `sm` bricht der Hinweis auf zwei Zeilen und die Leiste auf zwei
 *   Reihen um, daher dort mehr.
 * - --partybrezel-crust: Rand der Brezel-Vorschau, je Modus ≥ 3:1 gegen das
 *   Papier (hell #7a4a1d auf #fff ≈ 7,4:1, dunkel #c8955e auf #221b14 ≈ 6,5:1).
 */
const globalStyles = (
  <GlobalStyles
    styles={{
      html: {
        scrollPaddingTop: '7rem',
        scrollPaddingBottom: '8.5rem',
        '@media (min-width: 600px)': {
          scrollPaddingTop: '4rem',
          scrollPaddingBottom: '5.5rem',
        },
      },
      ':root': { '--partybrezel-crust': '#7a4a1d' },
      '[data-mui-color-scheme="dark"]': { '--partybrezel-crust': '#c8955e' },
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
      <CssVarsProvider theme={partybrezelTheme} defaultMode="system">
        <CssBaseline enableColorScheme />
        {globalStyles}
        {children}
      </CssVarsProvider>
    </AppRouterCacheProvider>
  )
}
