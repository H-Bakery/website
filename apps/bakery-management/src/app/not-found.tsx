'use client'
import React from 'react'
import { Box, Button, Paper, Typography } from '@mui/material'
import { SearchOff as SearchOffIcon } from '@mui/icons-material'
import Link from 'next/link'

/**
 * Deutsche 404-Seite statt der englischen Vorgabe von Next.js („This page
 * could not be found“). Sie steht im Root-Layout - eine unbekannte URL gehört
 * zu keinem Segment, also auch nicht zum Admin-Layout - und führt mit einem
 * Knopf zurück zur Startseite; die Wache leitet von dort je Rolle weiter.
 */
export default function NotFound() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Paper
        component="section"
        aria-labelledby="not-found-title"
        sx={{ p: { xs: 3, md: 4 }, maxWidth: 560, width: '100%' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <SearchOffIcon color="disabled" fontSize="large" aria-hidden />
          <Typography
            id="not-found-title"
            variant="h5"
            component="h1"
            sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}
          >
            Seite nicht gefunden
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Diese Adresse gibt es nicht. Vielleicht ist der Link veraltet oder
          vertippt.
        </Typography>
        <Button
          variant="contained"
          component={Link}
          href="/admin"
          sx={{ minHeight: 44 }}
        >
          Zur Startseite
        </Button>
      </Paper>
    </Box>
  )
}
