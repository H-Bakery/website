'use client'
import React from 'react'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter'
import { lightTheme } from '../../theme/theme'

// The landing page always uses the light theme
export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <MuiThemeProvider theme={lightTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </AppRouterCacheProvider>
  )
}
