import React from 'react'
import type { Metadata } from 'next'
import { Box, Container, Typography, Button, Paper } from '@mui/material'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import HomeIcon from '@mui/icons-material/Home'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { LEGAL } from '../config/legal'

/**
 * Next 16 liest `metadata` auch aus `not-found.tsx` (als letzte Ebene nach
 * dem Layout) - für unbekannte Adressen und den statischen Export (404.html).
 *
 * - `title` ersetzt den Startseiten-Titel des Layouts.
 * - `robots: null` streicht das `index, follow` des Layouts. Das `noindex`
 *   schreibt Next für jede 404-Antwort selbst in den Kopf
 *   (`<meta name="robots" content="noindex">`); ein eigenes käme doppelt.
 *   Die E2E-Suite prüft das am Export (`landing-smoke.spec.ts`).
 */
export const metadata: Metadata = {
  title: 'Seite nicht gefunden – Bäckerei Heusser',
  robots: null,
}

export default function NotFound() {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper
        elevation={3}
        sx={{
          p: 6,
          textAlign: 'center',
          borderRadius: 3,
        }}
      >
        <Box sx={{ mb: 3 }}>
          <SearchOffIcon
            sx={{
              fontSize: 80,
              color: 'text.secondary',
              opacity: 0.7,
            }}
          />
        </Box>

        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ fontWeight: 'bold', color: 'text.primary' }}
        >
          Seite nicht gefunden
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 4, lineHeight: 1.6 }}
        >
          Die gesuchte Seite existiert nicht oder wurde verschoben. Entdecken
          Sie stattdessen unser gesamtes Sortiment oder kehren Sie zur
          Startseite zurück.
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            justifyContent: 'center',
            mt: 4,
          }}
        >
          <Button
            href="/"
            variant="contained"
            color="primary"
            size="large"
            startIcon={<HomeIcon />}
            sx={{
              px: 4,
              py: 1.5,
              fontWeight: 'bold',
            }}
          >
            Zur Startseite
          </Button>
          <Button
            href="/products"
            variant="outlined"
            color="primary"
            size="large"
            startIcon={<StorefrontIcon />}
            sx={{
              px: 4,
              py: 1.5,
              fontWeight: 'bold',
            }}
          >
            Zum Sortiment
          </Button>
        </Box>

        <Box
          sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Typography variant="body2" color="text.secondary">
            Haben Sie Fragen?{' '}
            <a
              href={LEGAL.phoneHref}
              style={{
                color: 'inherit',
                textDecoration: 'underline',
                fontWeight: 'bold',
              }}
            >
              Rufen Sie uns an: {LEGAL.phone}
            </a>
          </Typography>
        </Box>
      </Paper>
    </Container>
  )
}
