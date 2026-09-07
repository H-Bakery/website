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
import { Login as LoginIcon, Logout as LogoutIcon } from '@mui/icons-material'
import { useAuth } from '@bakery/shared/contexts'
import { safeNextPath } from '../../../lib/authSession'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Inhaber/Admin',
  manager: 'Leitung',
  staff: 'Mitarbeiter',
  customer: 'Kunde',
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = safeNextPath(searchParams.get('next'))
  const { login, logout, user, isAuthenticated, isLoading, error, clearError } =
    useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await login({ username: username.trim(), password })
      router.push(nextPath)
    } catch {
      // Der Provider hält die Meldung in `error`; das Formular bleibt offen.
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    setPassword('')
  }

  return (
    <Box sx={{ maxWidth: 480 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          <LoginIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Anmeldung
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Für geschützte Bereiche wie die Finanzen ist eine Anmeldung nötig.
        </Typography>
      </Box>

      {isAuthenticated && user ? (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography>
              Angemeldet als <strong>{user.email}</strong>
              {user.role && (
                <> ({ROLE_LABELS[String(user.role)] ?? String(user.role)})</>
              )}
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Button
                component={Link}
                href={nextPath === '/admin/login' ? '/admin' : nextPath}
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
              {error && (
                <Alert severity="error" onClose={clearError}>
                  {error}
                </Alert>
              )}
              <TextField
                label="Benutzername"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
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
                startIcon={<LoginIcon />}
                disabled={submitting || !username.trim() || !password}
              >
                {submitting ? 'Anmelden …' : 'Anmelden'}
              </Button>
              <Typography variant="body2" color="text.secondary">
                Die Zugangsdaten setzt der API-Server (Umgebungsvariablen
                MOCK_ADMIN_USER / MOCK_ADMIN_PASSWORD).
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
