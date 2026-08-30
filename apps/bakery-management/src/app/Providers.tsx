'use client'

import React from 'react'
import {
  ThemeProvider as MuiThemeProvider,
  createTheme,
} from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import {
  AuthProvider,
  NotificationProvider,
  ThemeProvider,
  useColorScheme,
} from '@bakery/shared/contexts'

/**
 * Bridges the shared theme context (mode/persistence) to an actual MUI theme,
 * so the "Dunkles Design" toggle in the settings actually restyles the app.
 */
function MuiThemeBridge({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme()
  const theme = React.useMemo(
    () =>
      createTheme({
        palette: { mode: colorScheme },
      }),
    [colorScheme]
  )

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  )
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    // Dark is the default for the admin UI; a stored preference (or the
    // "Systemeinstellung folgen" toggle) still wins over it.
    <ThemeProvider defaultMode="dark" storageKey="bakery-management-theme">
      <MuiThemeBridge>
        {/* Auth: no session check on mount – the mock API has no auth endpoints */}
        <AuthProvider checkAuthOnMount={false}>
          <NotificationProvider enableRealTime={false}>
            {children}
          </NotificationProvider>
        </AuthProvider>
      </MuiThemeBridge>
    </ThemeProvider>
  )
}
