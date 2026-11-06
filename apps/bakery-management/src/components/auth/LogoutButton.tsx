'use client'
import React from 'react'
import { Button, type ButtonProps } from '@mui/material'
import { Logout as LogoutIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { useSession } from '../../lib/session'

/**
 * „Abmelden“ für Kopfzeilen und Tablet-Ansichten. Beendet die Sitzung an
 * der API und führt auf einer Station zurück zu den Namenskacheln, sonst
 * zur Anmeldung.
 */
export default function LogoutButton(props: ButtonProps) {
  const router = useRouter()
  const { logout } = useSession()
  const [busy, setBusy] = React.useState(false)

  const handleClick = async () => {
    setBusy(true)
    try {
      const target = await logout()
      router.replace(target)
    } finally {
      setBusy(false)
    }
  }

  return (
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
  )
}
