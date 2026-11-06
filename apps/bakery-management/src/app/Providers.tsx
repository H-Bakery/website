'use client'

import React from 'react'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import {
  NotificationProvider,
  ThemeProvider,
  useColorScheme,
} from '@bakery/shared/contexts'
import { SessionProvider } from '../lib/session'
import RouteGuard from '../components/auth/RouteGuard'
import { isPilotMode } from '../lib/pilotMode'
import ThemeColorSync from '../components/pwa/ThemeColorSync'
import { apiClient } from '@bakery/shared/data-access'
import { resolveBrowserApiBase } from '../lib/apiBase'
import { createManagementTheme } from '../lib/muiTheme'

// F4: der Browser spricht die API über die eigene Origin an (`/api/...`) -
// Caddy auf der Box bzw. src/proxy.ts leiten weiter. Gesetzt, bevor eine
// Komponente lädt; `NEXT_PUBLIC_API_URL` überschreibt nur, wenn es gesetzt ist.
apiClient.setBaseUrl(resolveBrowserApiBase())

/**
 * Bridges the shared theme context (mode/persistence) to an actual MUI theme,
 * so the "Dunkles Design" toggle in the settings actually restyles the app.
 */
function MuiThemeBridge({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme()
  const theme = React.useMemo(
    () => createManagementTheme(colorScheme),
    [colorScheme]
  )

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <ThemeColorSync mode={colorScheme} />
      {children}
    </MuiThemeProvider>
  )
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const pilot = isPilotMode()

  return (
    // Dark is the default for the admin UI; a stored preference (or the
    // "Systemeinstellung folgen" toggle) still wins over it.
    <ThemeProvider defaultMode="dark" storageKey="bakery-management-theme">
      <MuiThemeBridge>
        {/* Anmeldung (F1): Sitzung in localStorage, Refresh bei 401,
            Leerlauf-Abmeldung. Der RouteGuard lässt /admin und /backstube
            erst mit gültiger Sitzung rendern - vorher nur einen
            Ladezustand. */}
        <SessionProvider>
          {/* Pilotbetrieb: die echte API hat kein /api/notifications - kein
                Laden beim Start, kein 30-s-Polling und keine Browser-Rückfrage
                nach Mitteilungen. Der Provider bleibt, weil das Dashboard
                useNotifications() aufruft. */}
          <NotificationProvider
            enableRealTime={false}
            pollingInterval={pilot ? 0 : undefined}
            requestPermissionOnMount={!pilot}
            loadOnMount={!pilot}
          >
            <RouteGuard>{children}</RouteGuard>
          </NotificationProvider>
        </SessionProvider>
      </MuiThemeBridge>
    </ThemeProvider>
  )
}
