'use client'
import React from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Key as PasswordIcon,
  Pin as PinIcon,
  ManageAccounts as UsersIcon,
  TabletAndroid as StationIcon,
} from '@mui/icons-material'
import {
  createUser,
  fetchStations,
  fetchUsers,
  revokeStation,
  setUserPassword,
  setUserPin,
  updateUser,
  type AdminUser,
  type Station,
} from '../../../lib/authApi'
import { PILOT_ROLES, ROLE_LABELS, type PilotRole } from '../../../lib/roles'
import { useOptionalSession } from '../../../lib/session'
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '../../../components/auth/PinPad'

const PASSWORD_MIN_LENGTH = 8
const PIN_PATTERN = new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`)

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function formatDate(value: string | null): string {
  if (!value) return '–'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '–'
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type DialogState =
  | { kind: 'create' }
  | { kind: 'edit'; user: AdminUser }
  | { kind: 'password'; user: AdminUser }
  | { kind: 'pin'; user: AdminUser }
  | null

/**
 * Benutzerverwaltung (F1, B3 `/api/users`, nur `inhaber` aus einer
 * persönlichen Sitzung): anlegen, Rolle/Name/aktiv ändern, Passwort und PIN
 * setzen. Konten werden deaktiviert, nie gelöscht. Darunter die Stationen
 * (Tablets) mit „Widerrufen“.
 *
 * Die Regeln (letzter Inhaber, eigenes Konto, Längen) prüft die API; ihre
 * deutsche Meldung steht im Dialog. Hier wird nur vorab geprüft, was ein
 * Tippfehler ist (PIN-Ziffern, Passwortlänge).
 */
export default function UsersClient() {
  const session = useOptionalSession()
  const [users, setUsers] = React.useState<AdminUser[] | null>(null)
  const [stations, setStations] = React.useState<Station[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [dialog, setDialog] = React.useState<DialogState>(null)

  const reload = React.useCallback(async () => {
    setError(null)
    try {
      const [userList, stationList] = await Promise.all([
        fetchUsers(),
        fetchStations(),
      ])
      setUsers(userList)
      setStations(stationList)
    } catch (err) {
      setError(messageOf(err, 'Die Benutzer konnten nicht geladen werden.'))
      setUsers((prev) => prev ?? [])
      setStations((prev) => prev ?? [])
    }
  }, [])

  React.useEffect(() => {
    void reload()
  }, [reload])

  const done = (message: string) => {
    setDialog(null)
    setSuccess(message)
    void reload()
  }

  const handleRevoke = async (station: Station) => {
    if (
      !window.confirm(
        `Station „${station.name}“ widerrufen? Wer dort angemeldet ist, wird abgemeldet; das Gerät muss neu eingerichtet werden.`
      )
    ) {
      return
    }
    try {
      await revokeStation(station.id)
      setSuccess(`Station „${station.name}“ widerrufen.`)
      void reload()
    } catch (err) {
      setError(messageOf(err, 'Die Station konnte nicht widerrufen werden.'))
    }
  }

  const ownId = session?.user?.id

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            <UsersIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Benutzer
          </Typography>
          <Typography color="text.secondary">
            Konten, Rollen, Passwörter und PINs für die Stationen
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialog({ kind: 'create' })}
        >
          Neuer Benutzer
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      {users === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="Benutzer werden geladen" />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ mb: 4, overflowX: 'auto' }}>
          <Table size="small" aria-label="Benutzer">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Rolle</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>PIN</TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>Noch keine Benutzer.</TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow
                    key={user.id}
                    data-testid={`user-row-${user.username}`}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {user.displayName}
                        {user.id === ownId ? ' (Sie)' : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.username}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={ROLE_LABELS[user.role] ?? user.role}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={user.active ? 'success' : 'default'}
                        variant={user.active ? 'filled' : 'outlined'}
                        label={user.active ? 'aktiv' : 'deaktiviert'}
                      />
                    </TableCell>
                    <TableCell>{user.hasPin ? 'gesetzt' : '–'}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Bearbeiten">
                        <IconButton
                          aria-label={`${user.displayName} bearbeiten`}
                          onClick={() => setDialog({ kind: 'edit', user })}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Passwort setzen">
                        <IconButton
                          aria-label={`Passwort für ${user.displayName} setzen`}
                          onClick={() => setDialog({ kind: 'password', user })}
                        >
                          <PasswordIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="PIN setzen">
                        <IconButton
                          aria-label={`PIN für ${user.displayName} setzen`}
                          onClick={() => setDialog({ kind: 'pin', user })}
                        >
                          <PinIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
        <StationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Stationen
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Ein Tablet wird unter <strong>/station</strong> eingerichtet (als
        Inhaber mit Passwort angemeldet).
      </Typography>
      {stations !== null && (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label="Stationen">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Eingerichtet</TableCell>
                <TableCell>Zuletzt benutzt</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Aktion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>Noch keine Station.</TableCell>
                </TableRow>
              ) : (
                stations.map((station) => (
                  <TableRow key={station.id}>
                    <TableCell>{station.name}</TableCell>
                    <TableCell>{formatDate(station.createdAt)}</TableCell>
                    <TableCell>{formatDate(station.lastUsedAt)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={station.revokedAt ? 'default' : 'success'}
                        variant={station.revokedAt ? 'outlined' : 'filled'}
                        label={station.revokedAt ? 'widerrufen' : 'aktiv'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {!station.revokedAt && (
                        <Button
                          color="error"
                          size="small"
                          onClick={() => handleRevoke(station)}
                        >
                          Widerrufen
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {dialog?.kind === 'create' && (
        <CreateUserDialog
          onClose={() => setDialog(null)}
          onDone={(user) => done(`${user.displayName} angelegt.`)}
        />
      )}
      {dialog?.kind === 'edit' && (
        <EditUserDialog
          user={dialog.user}
          onClose={() => setDialog(null)}
          onDone={(user) => done(`${user.displayName} gespeichert.`)}
        />
      )}
      {dialog?.kind === 'password' && (
        <PasswordDialog
          user={dialog.user}
          onClose={() => setDialog(null)}
          onDone={(user) => done(`Neues Passwort für ${user.displayName}.`)}
        />
      )}
      {dialog?.kind === 'pin' && (
        <PinDialog
          user={dialog.user}
          onClose={() => setDialog(null)}
          onDone={(user, removed) =>
            done(
              removed
                ? `PIN von ${user.displayName} entfernt.`
                : `Neue PIN für ${user.displayName}.`
            )
          }
        />
      )}
    </Box>
  )
}

/** Rolle als Auswahlfeld. */
function RoleSelect({
  value,
  onChange,
}: {
  value: PilotRole
  onChange: (role: PilotRole) => void
}) {
  return (
    <TextField
      select
      label="Rolle"
      value={value}
      onChange={(e) => onChange(e.target.value as PilotRole)}
      fullWidth
    >
      {PILOT_ROLES.map((role) => (
        <MenuItem key={role} value={role}>
          {ROLE_LABELS[role]}
        </MenuItem>
      ))}
    </TextField>
  )
}

function useSubmit<T>(action: () => Promise<T>, onDone: (result: T) => void) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onDone(await action())
    } catch (err) {
      setError(messageOf(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, submit }
}

function pinProblem(pin: string): string | null {
  return pin && !PIN_PATTERN.test(pin)
    ? `Die PIN muss aus ${PIN_MIN_LENGTH} bis ${PIN_MAX_LENGTH} Ziffern bestehen.`
    : null
}

function passwordProblem(password: string): string | null {
  return password && password.length < PASSWORD_MIN_LENGTH
    ? `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`
    : null
}

function CreateUserDialog({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: (user: AdminUser) => void
}) {
  const [username, setUsername] = React.useState('')
  const [displayName, setDisplayName] = React.useState('')
  const [role, setRole] = React.useState<PilotRole>('verkauf')
  const [password, setPassword] = React.useState('')
  const [pin, setPin] = React.useState('')
  const { busy, error, submit } = useSubmit(
    () =>
      createUser({
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        role,
        password,
        ...(pin ? { pin } : {}),
      }),
    onDone
  )
  const invalid =
    !username.trim() ||
    !displayName.trim() ||
    password.length < PASSWORD_MIN_LENGTH ||
    pinProblem(pin) !== null

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit} noValidate>
        <DialogTitle>Neuer Benutzer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Benutzername"
              helperText="Kleinbuchstaben, Ziffern, Punkt, Binde- oder Unterstrich"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoComplete="off"
              required
              autoFocus
            />
            <TextField
              label="Anzeigename"
              helperText="So steht der Name auf der Station"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <RoleSelect value={role} onChange={setRole} />
            <TextField
              label="Passwort"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              error={passwordProblem(password) !== null}
              helperText={
                passwordProblem(password) ??
                `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`
              }
              required
            />
            <TextField
              label="PIN (optional)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              inputProps={{ inputMode: 'numeric', maxLength: PIN_MAX_LENGTH }}
              autoComplete="off"
              error={pinProblem(pin) !== null}
              helperText={
                pinProblem(pin) ??
                `${PIN_MIN_LENGTH} bis ${PIN_MAX_LENGTH} Ziffern, für die Anmeldung an der Station`
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="contained" disabled={busy || invalid}>
            Anlegen
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

function EditUserDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser
  onClose: () => void
  onDone: (user: AdminUser) => void
}) {
  const [displayName, setDisplayName] = React.useState(user.displayName)
  const [role, setRole] = React.useState<PilotRole>(user.role)
  const [active, setActive] = React.useState(user.active)
  const changes = {
    ...(displayName.trim() !== user.displayName
      ? { displayName: displayName.trim() }
      : {}),
    ...(role !== user.role ? { role } : {}),
    ...(active !== user.active ? { active } : {}),
  }
  const { busy, error, submit } = useSubmit(
    () => updateUser(user.id, changes),
    onDone
  )

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit} noValidate>
        <DialogTitle>{user.displayName} bearbeiten</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Benutzername" value={user.username} disabled />
            <TextField
              label="Anzeigename"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <RoleSelect value={role} onChange={setRole} />
            <FormControlLabel
              control={
                <Switch
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
              }
              label={
                active
                  ? 'Aktiv'
                  : 'Deaktiviert - kann sich nicht anmelden, alle Sitzungen enden'
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              busy || !displayName.trim() || Object.keys(changes).length === 0
            }
          >
            Speichern
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

function PasswordDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser
  onClose: () => void
  onDone: (user: AdminUser) => void
}) {
  const [password, setPassword] = React.useState('')
  const { busy, error, submit } = useSubmit(
    () => setUserPassword(user.id, password),
    onDone
  )
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit} noValidate>
        <DialogTitle>Passwort für {user.displayName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Neues Passwort"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              error={passwordProblem(password) !== null}
              helperText={
                passwordProblem(password) ??
                'Andere Geräte dieses Benutzers werden abgemeldet.'
              }
              autoFocus
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || password.length < PASSWORD_MIN_LENGTH}
          >
            Passwort setzen
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

function PinDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser
  onClose: () => void
  onDone: (user: AdminUser, removed: boolean) => void
}) {
  const [pin, setPin] = React.useState('')
  const save = useSubmit(
    () => setUserPin(user.id, pin),
    (updated) => onDone(updated, false)
  )
  const remove = useSubmit(
    () => setUserPin(user.id, null),
    (updated) => onDone(updated, true)
  )
  const busy = save.busy || remove.busy
  const error = save.error ?? remove.error
  const submit = save.submit

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit} noValidate>
        <DialogTitle>PIN für {user.displayName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Neue PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              inputProps={{ inputMode: 'numeric', maxLength: PIN_MAX_LENGTH }}
              autoComplete="off"
              error={pinProblem(pin) !== null}
              helperText={
                pinProblem(pin) ??
                `${PIN_MIN_LENGTH} bis ${PIN_MAX_LENGTH} Ziffern. Laufende Stationssitzungen enden.`
              }
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          {user.hasPin && (
            <Button
              color="error"
              onClick={() => void remove.submit()}
              disabled={busy}
              sx={{ mr: 'auto' }}
            >
              PIN entfernen
            </Button>
          )}
          <Button onClick={onClose}>Abbrechen</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !PIN_PATTERN.test(pin)}
          >
            PIN setzen
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
