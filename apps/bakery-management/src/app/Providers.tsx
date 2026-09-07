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
  useAuth,
  useColorScheme,
} from '@bakery/shared/contexts'
import {
  clearSession,
  persistSession,
  restoreSession,
} from '../lib/authSession'

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

/**
 * Spiegelt den Anmeldezustand nach `localStorage`: ein gültiges Token bleibt
 * über ein Neuladen erhalten, nach Abmeldung oder abgelaufenem Token wird der
 * Eintrag entfernt. Sitzt *innerhalb* des AuthProviders, damit `isLoading`
 * die Prüfung beim Start (`GET /api/auth/me`) abwarten kann.
 */
function AuthSessionSync({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  React.useEffect(() => {
    if (isLoading) return
    if (isAuthenticated) persistSession()
    else clearSession()
  }, [isAuthenticated, isLoading])
  return <>{children}</>
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // Ein gespeichertes Token muss auf dem apiClient sitzen, *bevor* der
  // AuthProvider beim Mount `GET /api/auth/me` aufruft - deshalb synchron im
  // State-Initialisierer und nicht in einem Effekt (Effekte der Eltern laufen
  // nach denen der Kinder).
  React.useState(() => restoreSession())

  return (
    // Dark is the default for the admin UI; a stored preference (or the
    // "Systemeinstellung folgen" toggle) still wins over it.
    <ThemeProvider defaultMode="dark" storageKey="bakery-management-theme">
      <MuiThemeBridge>
        {/* Auth: der Mock-Server kennt seit TASK-038 /api/auth/*; ohne Token
            macht der Provider beim Start keinen Request. */}
        <AuthProvider checkAuthOnMount>
          <AuthSessionSync>
            <NotificationProvider enableRealTime={false}>
              {children}
            </NotificationProvider>
          </AuthSessionSync>
        </AuthProvider>
      </MuiThemeBridge>
    </ThemeProvider>
  )
}
