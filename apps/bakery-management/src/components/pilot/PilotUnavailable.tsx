'use client'
import React from 'react'
import { Box, Button, Paper, Typography } from '@mui/material'
import { Block as BlockIcon } from '@mui/icons-material'
import Link from 'next/link'

/**
 * Ersatzseite für Routen, die im Pilotbetrieb gesperrt sind
 * (`NEXT_PUBLIC_PILOT_MODE=1`, siehe src/lib/pilotMode.ts). Wird von
 * admin/layout.tsx anstelle der eigentlichen Seite gezeigt.
 */
export default function PilotUnavailable() {
  return (
    <Paper
      component="section"
      aria-labelledby="pilot-unavailable-title"
      sx={{ p: { xs: 3, md: 4 }, maxWidth: 640 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <BlockIcon color="disabled" fontSize="large" aria-hidden />
        <Typography
          id="pilot-unavailable-title"
          variant="h5"
          component="h1"
          sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}
        >
          Im Pilotbetrieb nicht verfügbar
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Diese Seite ist während des Pilotbetriebs noch nicht freigegeben.
      </Typography>
      <Button variant="contained" component={Link} href="/admin">
        Zum Dashboard
      </Button>
    </Paper>
  )
}
