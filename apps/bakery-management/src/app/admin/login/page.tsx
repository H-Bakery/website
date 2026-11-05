'use client'
import React, { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  Login as LoginIcon,
  Logout as LogoutIcon,
  TabletAndroid as StationIcon,
} from '@mui/icons-material'
import { useSession } from '../../../lib/session'
import { loadStation } from '../../../lib/authSession'
import { ROLE_LABELS, resolvePostLoginPath } from '../../../lib/roles'

/**
 * Anmeldung mit Benutzername und Passwort (F1, B3-Vertrag
 * `POST /api/auth/login`). Danach geht es zu `?next=` - wenn die Rolle die
 * Seite öffnen darf - sonst zur Startseite der Rolle (`ROLE_ACCESS`).
 * Auf einem als Station eingerichteten Gerät führt ein Link zur PIN-Anmeldung.
 */
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const {
    login,
    logout,
    user,
    isAuthenticated,
    isLoading,
    endReason,
    clearEndReason,
  } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Erst nach dem Mount lesen: localStorage gibt es beim Server-Rendern nicht.
  const [isStation, setIsStation] = useState(false)
  React.useEffect(() => setIsStation(loadStation() !== null), [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    clearEndReason()
    try {
      const loggedIn = await login(username.trim(), password)
      router.replace(resolvePostLoginPath(loggedIn.role, next))
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Anmeldung fehlgeschlagen.'
      )
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    setPassword('')
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 440 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          <LoginIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Anmeldung
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Bäckerei Heusser · Verwaltung
        </Typography>
      </Box>

      {isAuthenticated && user ? (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography>
              Angemeldet als <strong>{user.displayName}</strong> (
              {ROLE_LABELS[user.role]})
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Button
                component={Link}
                href={resolvePostLoginPath(user.role, next)}
                variant="contained"
              >
                Weiter
              </Button>
              <Button
                variant="outlined"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                disabled={isLoading}
              >
                Abmelden
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : (
        <Paper elevation={2} sx={{ p: 3 }}>
          <form onSubmit={handleSubmit} noValidate>
            <Stack spacing={2}>
              {endReason && !error && (
                <Alert severity="info" onClose={clearEndReason}>
                  {endReason}
                </Alert>
              )}
              {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
              <TextField
                label="Benutzername"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                required
                fullWidth
              />
              <TextField
                label="Passwort"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                fullWidth
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<LoginIcon />}
                disabled={submitting || !username.trim() || !password}
              >
                {submitting ? 'Anmelden …' : 'Anmelden'}
              </Button>
              {isStation && (
                <Button
                  component={Link}
                  href="/station"
                  variant="outlined"
                  startIcon={<StationIcon />}
                >
                  Mit PIN an der Station anmelden
                </Button>
              )}
              <Typography variant="body2" color="text.secondary">
                Zugang vergessen? Der Inhaber setzt Passwort und PIN unter
                „Benutzer“ neu.
              </Typography>
            </Stack>
          </form>
        </Paper>
      )}
    </Box>
  )
}

export default function LoginPage() {
  // useSearchParams braucht beim statischen Rendern eine Suspense-Grenze.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
