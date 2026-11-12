'use client'
import React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

const SEITENFEHLER_TITEL = 'Da ist etwas schiefgegangen'
const SEITENFEHLER_TEXT =
  'Die Digitale Bäckerei konnte gerade nicht angezeigt werden. Versuch es noch einmal.'
const SEITENFEHLER_KNOPF = 'Noch einmal versuchen'

/**
 * Letztes Netz für unerwartete Fehler beim Rendern: eine deutsche Meldung mit
 * einem zweiten Versuch statt der englischen Fehlerseite von Next. Erwartbare
 * Fehler (Modell oder 3D-Code lädt nicht, kein WebGL) fängt die App selbst.
 */
export default function Fehlerseite({ reset }: { reset: () => void }) {
  return (
    <Box
      component="main"
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        p: 2,
        bgcolor: 'background.default',
        color: 'text.primary',
      }}
    >
      <Paper
        role="alert"
        elevation={3}
        sx={{ width: 'min(100%, 360px)', p: 2.5, textAlign: 'center' }}
      >
        <Typography component="h1" variant="h1" sx={{ mb: 1 }}>
          {SEITENFEHLER_TITEL}
        </Typography>
        <Typography component="p">{SEITENFEHLER_TEXT}</Typography>
        <Button variant="contained" onClick={reset} sx={{ mt: 2 }}>
          {SEITENFEHLER_KNOPF}
        </Button>
      </Paper>
    </Box>
  )
}
