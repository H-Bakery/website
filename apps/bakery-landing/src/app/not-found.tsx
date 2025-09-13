import React from 'react'
import { Box, Container, Typography, Button, Paper } from '@mui/material'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import HomeIcon from '@mui/icons-material/Home'
import Link from 'next/link'

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
            component={Link}
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
        </Box>

        <Box
          sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Typography variant="body2" color="text.secondary">
            Haben Sie Fragen?{' '}
            <Link
              href="tel:068412229"
              style={{
                color: 'inherit',
                textDecoration: 'underline',
                fontWeight: 'bold',
              }}
            >
              Rufen Sie uns an: 06841 2229
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  )
}
