'use client'

import React from 'react'
import { Box, Container, Grid, Typography } from '@mui/material'
import Link from 'next/link'
import { getFooterHours } from '../utils/openingHours'
import { Wappen } from './icons/brand/Wappen'

export const LocalFooter: React.FC = () => {
  return (
    <Box
      sx={{
        bgcolor: '#928168',
        py: 6,
        mt: 'auto',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          right: { xs: '-5%', md: '5%' },
          top: '50%',
          transform: 'translateY(-50%)',
          opacity: 0.06,
          color: '#FFF3E6',
          pointerEvents: 'none',
          zIndex: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Wappen size={450} />
      </Box>
      <Container sx={{ position: 'relative', zIndex: 1 }}>
        <Grid container spacing={4}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography
              variant="h6"
              component="div"
              gutterBottom
              sx={{
                fontWeight: 700,
                color: '#FFF3E6',
                fontFamily: '"Cinzel", serif',
              }}
            >
              Bäckerei Heusser
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mb: 2,
                color: 'rgba(255, 243, 230, 0.8)',
                fontSize: '1rem',
              }}
            >
              Wir backen mit Herz, nach Tradition und nur für euch.
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'rgba(255, 243, 230, 0.7)', fontSize: '1rem' }}
            >
              Seit 1933
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                color: '#FFF3E6',
                fontFamily: '"Cinzel", serif',
                fontWeight: 700,
              }}
            >
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
                      color: 'rgba(255, 243, 230, 0.8)',
                      fontSize: '1rem',
                      transition: 'color 0.2s ease',
                      '&:hover': {
                        color: '#d038ba',
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
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                color: '#FFF3E6',
                fontFamily: '"Cinzel", serif',
                fontWeight: 700,
              }}
            >
              Kontakt
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mb: 1,
                color: 'rgba(255, 243, 230, 0.8)',
                fontSize: '1rem',
              }}
            >
              Eckstraße 3
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mb: 1,
                color: 'rgba(255, 243, 230, 0.8)',
                fontSize: '1rem',
              }}
            >
              66424 Homburg/Kirrberg
            </Typography>
            <Typography
              component="a"
              href="tel:068412229"
              variant="body2"
              sx={{
                mb: 1,
                display: 'block',
                color: '#FFF3E6',
                fontSize: '1rem',
                fontWeight: 700,
                textDecoration: 'none',
                '&:hover': { color: '#d038ba' },
              }}
            >
              Tel: 06841 2229
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'rgba(255, 243, 230, 0.8)', fontSize: '1rem' }}
            >
              info@baeckerei-heusser.de
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                color: '#FFF3E6',
                fontFamily: '"Cinzel", serif',
                fontWeight: 700,
              }}
            >
              Öffnungszeiten
            </Typography>
            {getFooterHours().map((item, index) => (
              <Typography
                key={index}
                variant="body2"
                sx={{
                  mb: index < getFooterHours().length - 1 ? 1 : 0,
                  color: 'rgba(255, 243, 230, 0.8)',
                  fontSize: '1rem',
                }}
              >
                {item.label}: {item.value}
              </Typography>
            ))}
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
            borderColor: 'rgba(255, 243, 230, 0.2)',
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: 'rgba(255, 243, 230, 0.5)' }}
          >
            &copy; Bäckerei Heusser 2025
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Link href="/imprint" style={{ textDecoration: 'none' }}>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255, 243, 230, 0.7)',
                  transition: 'color 0.2s ease',
                  '&:hover': {
                    color: '#d038ba',
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
