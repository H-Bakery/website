'use client'
import React from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'

/**
 * Ladezustand, solange die Anmeldung geprüft wird oder eine Weiterleitung
 * läuft. Steht anstelle der geschützten Seite - deren Inhalt wird erst mit
 * gültiger Sitzung gerendert.
 */
export default function SessionLoading({
  label = 'Anmeldung wird geprüft …',
}: {
  label?: string
}) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        bgcolor: 'background.default',
      }}
    >
      <CircularProgress aria-hidden />
      <Typography color="text.secondary">{label}</Typography>
    </Box>
  )
}
