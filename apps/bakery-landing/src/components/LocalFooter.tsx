'use client'

import React from 'react'
import { Box, Container, Grid, Typography } from '@mui/material'
import Link from 'next/link'

export const LocalFooter: React.FC = () => {
  return (
    <Box
      sx={{
        bgcolor: 'grey.50',
        borderTop: 1,
        borderColor: 'divider',
        py: 6,
        mt: 'auto',
      }}
    >
      <Container>
        <Grid container spacing={4}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography
              variant="h6"
              component="div"
              gutterBottom
              sx={{
                fontWeight: 'bold',
                color: 'primary.main',
                fontFamily: 'Playfair Display',
              }}
            >
              Bäckerei Heusser
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Wir backen mit Herz, nach Tradition und nur für euch.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Seit 1933
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="h6" gutterBottom color="primary.main">
              Navigation
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                { label: 'Sortiment', path: '/products' },
                { label: 'Neuigkeiten', path: '/news' },
                { label: 'Über uns', path: '/about' },
                { label: 'Kontakt', path: '/contact' },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.path}
                  style={{ textDecoration: 'none' }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'primary.main',
                      },
                    }}
                  >
                    {item.label}
                  </Typography>
                </Link>
              ))}
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="h6" gutterBottom color="primary.main">
              Kontakt
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Eckstraße 3
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              66424 Homburg/Kirrberg
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Tel: 06841 2229
            </Typography>
            <Typography variant="body2" color="text.secondary">
              E-Mail: info@baeckerei-heusser.de
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="h6" gutterBottom color="primary.main">
              Öffnungszeiten
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Mo-Fr: 06:00 - 12:30 Uhr
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Sa: 06:00 - 12:00 Uhr
            </Typography>
            <Typography variant="body2" color="text.secondary">
              So: Geschlossen
            </Typography>
          </Grid>
        </Grid>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pt: 4,
            mt: 4,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" color="text.disabled">
            © Bäckerei Heusser 2025
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Link href="/imprint" style={{ textDecoration: 'none' }}>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                Impressum
              </Typography>
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
