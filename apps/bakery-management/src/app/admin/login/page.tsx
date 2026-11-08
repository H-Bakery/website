'use client'
import React, { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  Logout as LogoutIcon,
  TabletAndroid as StationIcon,
} from '@mui/icons-material'
import { useSession } from '../../../lib/session'
import { loadStation } from '../../../lib/authSession'
import { readLostActions, type LostAction } from '../../../lib/lostActions'
import { ROLE_LABELS, resolvePostLoginPath } from '../../../lib/roles'
import { describeAuthError } from '../../../components/auth/authErrors'

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
  // Was beim Ablauf der Sitzung nicht gespeichert wurde (W4-Verifikation
  // Runde 2) - hier nur anzeigen; weggeklickt wird es auf der Abholliste.
  const [lostActions, setLostActions] = useState<LostAction[]>([])
  React.useEffect(() => setLostActions(readLostActions()), [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    clearEndReason()
    try {
      const loggedIn = await login(username.trim(), password)
      router.replace(resolvePostLoginPath(loggedIn.role, next))
    } catch (err) {
      setError(describeAuthError(err, 'Anmeldung fehlgeschlagen.'))
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
    <Paper
      component="section"
      aria-labelledby="login-title"
      sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4 } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box
          component="img"
          src="/icons/icon-192.png"
          alt=""
          width={44}
          height={44}
          sx={{ borderRadius: 1, flexShrink: 0 }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h1" id="login-title">
            Anmeldung
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Bäckerei Heusser · Verwaltung
          </Typography>
        </Box>
      </Box>

      {isAuthenticated && user ? (
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
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <Stack spacing={2}>
            {lostActions.length > 0 && (
              <Alert severity="error" data-testid="lost-actions">
                <AlertTitle>Nicht gespeichert</AlertTitle>
                {lostActions.map((a) => (
                  <Box
                    key={a.at + a.text}
                    component="span"
                    sx={{ display: 'block' }}
                  >
                    {a.text}
                  </Box>
                ))}
              </Alert>
            )}
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
      )}
    </Paper>
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
