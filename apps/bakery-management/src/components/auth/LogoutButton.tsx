'use client'
import React from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  type ButtonProps,
} from '@mui/material'
import { Logout as LogoutIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { useSession } from '../../lib/session'
import { listDraftDates, formatDayShort } from '../../lib/restApi'

/**
 * „Abmelden“ für Kopfzeilen und Tablet-Ansichten. Beendet die Sitzung an
 * der API und führt auf einer Station zurück zu den Namenskacheln, sonst
 * zur Anmeldung.
 */
export default function LogoutButton(props: ButtonProps) {
  const router = useRouter()
  const { logout, user } = useSession()
  const [busy, setBusy] = React.useState(false)
  // Ungespeicherte Zählung „Rest am Abend“: vor dem Abmelden fragen
  // (Abschluss-Verifikation next). Der Entwurf bleibt je Person auf diesem
  // Gerät liegen - gespeichert ist er aber nicht.
  const [draftDates, setDraftDates] = React.useState<string[] | null>(null)

  const handleClick = () => {
    const dates = user ? listDraftDates(user.id) : []
    if (dates.length > 0) {
      setDraftDates(dates)
      return
    }
    void doLogout()
  }

  const doLogout = async () => {
    setDraftDates(null)
    setBusy(true)
    try {
      const target = await logout()
      router.replace(target)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        startIcon={<LogoutIcon />}
        onClick={handleClick}
        disabled={busy}
        {...props}
        // Touch-Ziel mindestens 44 px (W4-Verifikation: 37/42 px in der AppBar).
        sx={[
          { minHeight: 44 },
          ...(props.sx === undefined
            ? []
            : Array.isArray(props.sx)
            ? props.sx
            : [props.sx]),
        ]}
      >
        Abmelden
      </Button>
      <Dialog
        open={draftDates !== null}
        onClose={() => setDraftDates(null)}
        aria-labelledby="logout-drafts-title"
      >
        <DialogTitle id="logout-drafts-title">
          Zählung nicht gespeichert
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            „Rest am Abend“ hat ungespeicherte Eingaben (
            {(draftDates ?? []).map((d) => formatDayShort(d)).join(', ')}). Sie
            bleiben auf diesem Gerät für dich aufgehoben, gespeichert sind sie
            nicht.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraftDates(null)} sx={{ minHeight: 44 }}>
            Angemeldet bleiben
          </Button>
          <Button
            color="warning"
            onClick={() => void doLogout()}
            sx={{ minHeight: 44 }}
          >
            Trotzdem abmelden
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
