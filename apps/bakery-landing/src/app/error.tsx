'use client'

import React from 'react'
import { Box, Typography, Button, Container, Paper } from '@mui/material'
import { ErrorOutline as ErrorIcon } from '@mui/icons-material'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error('Error boundary caught:', error)

    // Auto-recover from stale webpack chunk cache in dev mode.
    // When the browser serves a cached page.js with outdated module factories,
    // hydration fails with "Cannot read properties of undefined (reading 'call')".
    // Fix: re-fetch all chunk scripts with cache:'reload' to bust the HTTP cache,
    // then reload the page. sessionStorage guard prevents infinite reload loops.
    if (
      process.env.NODE_ENV === 'development' &&
      error?.message?.includes("reading 'call'")
    ) {
      const key = '__webpack_cache_reload'
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        const scripts = document.querySelectorAll(
          'script[src*="/_next/static/chunks/"]'
        )
        Promise.all(
          [...scripts].map((s) => fetch(s.src, { cache: 'reload' }))
        ).then(() => window.location.reload())
      }
    }
  }, [error])

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          textAlign: 'center',
          borderRadius: 2,
        }}
      >
        <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />

        <Typography variant="h4" component="h1" gutterBottom>
          Etwas ist schiefgelaufen
        </Typography>

        <Typography variant="body1" color="text.secondary" paragraph>
          Es tut uns leid, aber es ist ein unerwarteter Fehler aufgetreten.
          Bitte versuchen Sie es später erneut oder kontaktieren Sie uns.
        </Typography>

        {process.env.NODE_ENV === 'development' && error.message && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              {error.message}
            </Typography>
          </Box>
        )}

        <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            onClick={() => reset()}
            sx={{ minWidth: 120 }}
          >
            Erneut versuchen
          </Button>

          <Button variant="outlined" href="/" sx={{ minWidth: 120 }}>
            Zur Startseite
          </Button>
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 3, display: 'block' }}
        >
          Bei anhaltenden Problemen kontaktieren Sie uns bitte unter: 06841 2229
        </Typography>
      </Paper>
    </Container>
  )
}
