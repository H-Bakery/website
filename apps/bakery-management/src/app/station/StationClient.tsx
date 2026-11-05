'use client'
import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  TabletAndroid as StationIcon,
} from '@mui/icons-material'
import { useSession } from '../../lib/session'
import {
  clearStation,
  loadStation,
  saveStation,
  type StoredStation,
} from '../../lib/authSession'
import {
  fetchStationUsers,
  registerStation,
  type StationUser,
} from '../../lib/authApi'
import { ROLE_LABELS, startPathForRole } from '../../lib/roles'
import PinPad from '../../components/auth/PinPad'
import LogoutButton from '../../components/auth/LogoutButton'

/** Ohne Tippen fällt die PIN-Eingabe nach so vielen ms zurück auf die Kacheln. */
export const PIN_IDLE_MS = 60 * 1000

const REVOKED_MESSAGE =
  'Diese Station wurde widerrufen oder ist unbekannt. Ein Inhaber muss das Gerät neu einrichten.'

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function isStationRejected(error: unknown): boolean {
  const e = error as { status?: number; code?: string } | null
  return e?.status === 403 && e.code === 'station_required'
}

/**
 * Station = gemeinsam genutztes Tablet (Laden, Backstube), roadmap D5.
 *
 * - Ohne Stations-Token auf diesem Gerät: ein mit Passwort angemeldeter
 *   Inhaber richtet es ein (`POST /api/auth/stations`); das Token kommt genau
 *   einmal zurück und bleibt in `localStorage`. Seine persönliche Sitzung
 *   wird danach beendet - auf dem Tablet bleibt niemand als Inhaber angemeldet.
 * - Mit Token: große Namenskacheln (`GET /api/auth/station/users`, alle
 *   aktiven Konten mit PIN) → Ziffernblock → `POST /api/auth/pin` → Startseite
 *   der Rolle. Abmelden (oder 10 min ohne Bedienung) führt hierher zurück.
 */
export default function StationClient() {
  const router = useRouter()
  const session = useSession()
  const [mounted, setMounted] = React.useState(false)
  const [station, setStation] = React.useState<StoredStation | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  React.useEffect(() => {
    setStation(loadStation())
    setMounted(true)
  }, [])

  const handleRevoked = React.useCallback(() => {
    clearStation()
    setStation(null)
    setNotice(REVOKED_MESSAGE)
  }, [])

  if (!mounted || session.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress aria-label="Wird geladen" />
      </Box>
    )
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        p: { xs: 2, sm: 3, md: 4 },
      }}
    >
      {station ? (
        <StationLogin
          station={station}
          onRevoked={handleRevoked}
          notice={notice}
          onDone={(path) => router.replace(path)}
        />
      ) : (
        <StationSetup
          notice={notice}
          onRegistered={(next, message) => {
            setStation(next)
            setNotice(message)
          }}
        />
      )}
    </Box>
  )
}

function StationSetup({
  notice,
  onRegistered,
}: {
  notice: string | null
  onRegistered: (station: StoredStation, message: string) => void
}) {
  const { user, sessionKind, logout } = useSession()
  const [name, setName] = React.useState('Laden-Tablet')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const canRegister = user?.role === 'inhaber' && sessionKind === 'personal'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await registerStation(name.trim())
      const next: StoredStation = {
        token: result.token,
        name: result.station.name,
        id: result.station.id,
      }
      saveStation(next)
      await logout()
      onRegistered(
        next,
        `Station „${next.name}“ ist eingerichtet. Ihre persönliche Anmeldung auf diesem Gerät wurde beendet.`
      )
    } catch (err) {
      setError(messageOf(err, 'Die Station konnte nicht eingerichtet werden.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Paper sx={{ p: { xs: 3, md: 4 }, maxWidth: 560, mx: 'auto' }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          <StationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Station einrichten
        </Typography>
        {notice && <Alert severity="warning">{notice}</Alert>}
        <Typography color="text.secondary">
          Dieses Gerät ist noch keine Station. An einer Station melden sich alle
          mit ihrem Namen und ihrer PIN an - gedacht für das Tablet im Laden und
          in der Backstube.
        </Typography>
        {canRegister ? (
          <form onSubmit={handleSubmit} noValidate>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Name der Station"
                helperText="z. B. Laden-Tablet oder Backstube"
                value={name}
                onChange={(e) => setName(e.target.value)}
                inputProps={{ maxLength: 80 }}
                required
                fullWidth
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={busy || !name.trim()}
              >
                {busy ? 'Wird eingerichtet …' : 'Gerät als Station einrichten'}
              </Button>
            </Stack>
          </form>
        ) : (
          <>
            <Alert severity="info">
              {user
                ? 'Nur ein Inhaber, der mit Benutzername und Passwort angemeldet ist, kann ein Gerät als Station einrichten.'
                : 'Ein Inhaber muss sich zuerst mit Benutzername und Passwort anmelden.'}
            </Alert>
            <Button
              component={Link}
              href="/admin/login?next=/station"
              variant="contained"
              size="large"
            >
              Als Inhaber anmelden
            </Button>
          </>
        )}
      </Stack>
    </Paper>
  )
}

function StationLogin({
  station,
  notice,
  onRevoked,
  onDone,
}: {
  station: StoredStation
  notice: string | null
  onRevoked: () => void
  onDone: (path: string) => void
}) {
  const session = useSession()
  const [users, setUsers] = React.useState<StationUser[] | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [attempt, setAttempt] = React.useState(0)
  const [selected, setSelected] = React.useState<StationUser | null>(null)
  const [pin, setPin] = React.useState('')
  const [pinError, setPinError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setLoadError(null)
    fetchStationUsers(station.token)
      .then((list) => {
        if (!cancelled) setUsers(list)
      })
      .catch((error) => {
        if (cancelled) return
        if (isStationRejected(error)) onRevoked()
        else
          setLoadError(
            messageOf(error, 'Die Namen konnten nicht geladen werden.')
          )
      })
    return () => {
      cancelled = true
    }
  }, [station.token, attempt, onRevoked])

  // PIN-Eingabe ohne Bedienung: zurück zu den Kacheln.
  React.useEffect(() => {
    if (!selected) return
    const timer = window.setTimeout(() => {
      setSelected(null)
      setPin('')
      setPinError(null)
    }, PIN_IDLE_MS)
    return () => window.clearTimeout(timer)
  }, [selected, pin])

  const choose = (user: StationUser) => {
    setSelected(user)
    setPin('')
    setPinError(null)
  }

  const submitPin = async () => {
    if (!selected || busy) return
    setBusy(true)
    setPinError(null)
    try {
      const user = await session.pinLogin(station.token, selected.id, pin)
      onDone(startPathForRole(user.role))
    } catch (error) {
      if (isStationRejected(error)) {
        onRevoked()
        return
      }
      setPinError(messageOf(error, 'Anmeldung fehlgeschlagen.'))
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  const active = session.isAuthenticated ? session.user : null

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            {selected ? `PIN für ${selected.displayName}` : 'Wer bist du?'}
          </Typography>
          <Typography color="text.secondary">
            <StationIcon
              fontSize="small"
              sx={{ mr: 0.5, verticalAlign: 'text-bottom' }}
            />
            Station: {station.name}
          </Typography>
        </Box>
        {active && (
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Typography>
              Angemeldet: <strong>{active.displayName}</strong>
            </Typography>
            <Button
              variant="contained"
              onClick={() => onDone(startPathForRole(active.role))}
            >
              Weiter
            </Button>
            <LogoutButton variant="outlined" color="primary" size="large" />
          </Paper>
        )}
      </Box>

      {notice && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {notice}
        </Alert>
      )}
      {session.endReason && !selected && (
        <Alert severity="info" sx={{ mb: 3 }} onClose={session.clearEndReason}>
          {session.endReason}
        </Alert>
      )}

      {selected ? (
        <Paper sx={{ p: { xs: 2, sm: 4 }, maxWidth: 480, mx: 'auto' }}>
          {pinError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {pinError}
            </Alert>
          )}
          <PinPad
            value={pin}
            onChange={(value) => {
              setPin(value)
              setPinError(null)
            }}
            onSubmit={submitPin}
            disabled={busy}
          />
          <Button
            startIcon={<BackIcon />}
            onClick={() => setSelected(null)}
            sx={{ mt: 3 }}
            fullWidth
            size="large"
          >
            Andere Person
          </Button>
        </Paper>
      ) : loadError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => setAttempt((n) => n + 1)}>
              Erneut versuchen
            </Button>
          }
        >
          {loadError}
        </Alert>
      ) : users === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="Namen werden geladen" />
        </Box>
      ) : users.length === 0 ? (
        <Alert severity="info">
          Noch hat niemand eine PIN. Der Inhaber setzt PINs unter Verwaltung ›
          Benutzer.
        </Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(3, 1fr)',
              md: 'repeat(4, 1fr)',
            },
            gap: 2,
          }}
        >
          {users.map((user) => (
            <Paper
              key={user.id}
              component={ButtonBase}
              onClick={() => choose(user)}
              sx={{
                minHeight: { xs: 110, sm: 140 },
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                '&:hover': { bgcolor: 'action.hover' },
                '&:focus-visible': { bgcolor: 'action.selected' },
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontSize: { xs: '1.3rem', sm: '1.6rem' },
                  fontWeight: 600,
                }}
              >
                {user.displayName}
              </Typography>
              <Typography component="span" color="text.secondary">
                {ROLE_LABELS[user.role] ?? user.role}
              </Typography>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  )
}
