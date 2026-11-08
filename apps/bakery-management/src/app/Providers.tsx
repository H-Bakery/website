'use client'

import React from 'react'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import {
  NotificationProvider,
  ThemeProvider,
  useColorScheme,
} from '@bakery/shared/contexts'
import { SessionProvider, useOptionalSession } from '../lib/session'
import RouteGuard from '../components/auth/RouteGuard'
import { isPilotMode } from '../lib/pilotMode'
import ThemeColorSync from '../components/pwa/ThemeColorSync'
import { apiClient } from '@bakery/shared/data-access'
import { resolveBrowserApiBase } from '../lib/apiBase'
import { createManagementTheme } from '../lib/muiTheme'
import { useIsPrinting } from '../lib/printMode'

// F4: der Browser spricht die API über die eigene Origin an (`/api/...`) -
// Caddy auf der Box bzw. src/proxy.ts leiten weiter. Gesetzt, bevor eine
// Komponente lädt; `NEXT_PUBLIC_API_URL` überschreibt nur, wenn es gesetzt ist.
apiClient.setBaseUrl(resolveBrowserApiBase())

/**
 * Bridges the shared theme context (mode/persistence) to an actual MUI theme,
 * so the "Dunkles Design" toggle in the settings actually restyles the app.
 *
 * `enableColorScheme` setzt `color-scheme` am Dokument: native Bedienelemente
 * (Datumsfelder samt Kalender-Symbol, Bildlaufleisten) folgen dann dem
 * Modus der App statt hell im Dunkelmodus zu stehen.
 */
export function MuiThemeBridge({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme()
  // Gedruckt wird immer hell (Review r2): sonst kam jede Seite ohne eigene
  // Druckansicht aus dem Dunkelmodus hellgrau auf Weiß bzw. schwarz aufs
  // Blatt. Statusleiste und gespeicherte Wahl folgen weiter `colorScheme`.
  const printing = useIsPrinting()
  const mode = printing ? 'light' : colorScheme
  const theme = React.useMemo(() => createManagementTheme(mode), [mode])

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <ThemeColorSync mode={colorScheme} />
      {children}
    </MuiThemeProvider>
  )
}

/**
 * Benachrichtigungen erst mit Sitzung (Abschluss-Verifikation next): vorher
 * hatte der `ApiClient` noch kein Token, `/api/notifications` antwortete 401
 * und landete als console.error im Log. Im Pilotbetrieb gar nicht - die echte
 * API hat kein /api/notifications: kein Laden, kein 30-s-Polling. Die
 * Browser-Rückfrage nach Mitteilungen kommt nie ungefragt beim Start. Der
 * Provider bleibt, weil Dashboard und Einstellungen useNotifications()
 * aufrufen; ein 404 setzt `available: false` (W4).
 */
export function SessionNotifications({
  pilot,
  children,
}: {
  pilot: boolean
  children: React.ReactNode
}) {
  const signedIn = useOptionalSession()?.status === 'authenticated'
  const active = !pilot && signedIn
  return (
    <NotificationProvider
      enableRealTime={false}
      pollingInterval={active ? undefined : 0}
      requestPermissionOnMount={false}
      loadOnMount={active}
    >
      {children}
    </NotificationProvider>
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
          <SessionNotifications pilot={pilot}>
            <RouteGuard>{children}</RouteGuard>
          </SessionNotifications>
        </SessionProvider>
      </MuiThemeBridge>
    </ThemeProvider>
  )
}
