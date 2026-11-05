'use client'
import React from 'react'
import { Box, Button, Paper, Typography } from '@mui/material'
import { Lock as LockIcon } from '@mui/icons-material'
import Link from 'next/link'

/**
 * Ersatz für eine Seite, die die Rolle des angemeldeten Benutzers nicht
 * öffnen darf (`ROLE_ACCESS` in src/lib/roles.ts). Die API würde die Daten
 * ohnehin mit 403 verweigern - so steht wenigstens da, warum.
 */
export default function NoAccess({
  roleLabel,
  startPath,
}: {
  roleLabel: string
  startPath: string
}) {
  return (
    <Paper
      component="section"
      aria-labelledby="no-access-title"
      sx={{ p: { xs: 3, md: 4 }, maxWidth: 640 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <LockIcon color="disabled" fontSize="large" aria-hidden />
        <Typography
          id="no-access-title"
          variant="h5"
          component="h1"
          sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}
        >
          Kein Zugriff
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Diese Seite ist für die Rolle „{roleLabel}“ nicht freigegeben.
      </Typography>
      <Button variant="contained" component={Link} href={startPath}>
        Zur Startseite
      </Button>
    </Paper>
  )
}
