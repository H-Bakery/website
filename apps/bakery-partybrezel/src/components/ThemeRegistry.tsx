'use client'
import React from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import { Experimental_CssVarsProvider as CssVarsProvider } from '@mui/material/styles'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import { partybrezelTheme } from './theme'

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <CssVarsProvider theme={partybrezelTheme} defaultMode="system">
        <CssBaseline enableColorScheme />
        {children}
      </CssVarsProvider>
    </AppRouterCacheProvider>
  )
}
