'use client'

import React from 'react'
import NextLink from 'next/link'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import { OPENING_HOURS_ROWS } from '@bakery/shop/feature-cart'

/**
 * Auftritt der Bäckerei im Netz. Rechtstexte und Markengeschichte leben dort,
 * nicht im Shop.
 */
const WEBSITE_URL =
  process.env.NEXT_PUBLIC_LANDING_URL || 'https://xn--bckerei-heusser-0kb.de'

const LEGAL_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'Impressum', href: `${WEBSITE_URL}/imprint` },
  { label: 'Datenschutz', href: `${WEBSITE_URL}/datenschutz` },
  { label: 'Zur Website', href: WEBSITE_URL },
]

const columnSx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0.5,
} as const

const labelSx = {
  fontFamily: 'Cinzel, serif',
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'warning.main',
  mb: 0.5,
} as const

const linkSx = {
  color: 'grey.200',
  textDecoration: 'none',
  fontSize: '0.875rem',
  width: 'fit-content',
  '&:hover': { color: 'common.white', textDecoration: 'underline' },
} as const

/**
 * Schmale Ladenfußzeile.
 *
 * Bewusst *nicht* der geteilte Marketing-Footer: keine Menüs, keine
 * Social-Kacheln, keine Newsletter-Box. Nur was man im Laden braucht —
 * wo, wann, wie erreichbar — plus die Pflichtlinks auf die Website.
 */
export function ShopFooter() {
  return (
    <Box
      component="footer"
      data-testid="shop-footer"
      sx={{
        mt: 'auto',
        bgcolor: 'grey.900',
        color: 'grey.100',
        borderTop: 4,
        borderColor: 'primary.main',
      }}
    >
      <Container sx={{ py: { xs: 3, md: 3.5 } }}>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2.5, md: 4 },
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
          }}
        >
          <Box sx={columnSx}>
            <Typography component="h2" sx={labelSx}>
              Bäckerei Heusser
            </Typography>
            <Typography sx={{ fontSize: '0.875rem' }}>Eckstraße 3</Typography>
            <Typography sx={{ fontSize: '0.875rem' }}>66424 Homburg</Typography>
            <Box component="a" href="tel:+4968412229" sx={linkSx}>
              06841 2229
            </Box>
          </Box>

          <Box sx={columnSx}>
            <Typography component="h2" sx={labelSx}>
              Öffnungszeiten
            </Typography>
            {OPENING_HOURS_ROWS.map((entry) => (
              <Box
                key={entry.days}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 2,
                  maxWidth: 260,
                  fontSize: '0.875rem',
                }}
              >
                <Box component="span" sx={{ color: 'grey.300' }}>
                  {entry.days}
                </Box>
                <Box component="span">{entry.time}</Box>
              </Box>
            ))}
          </Box>

          <Box sx={columnSx}>
            <Typography component="h2" sx={labelSx}>
              Service
            </Typography>
            <Box component={NextLink} href="/products" sx={linkSx}>
              Alle Produkte
            </Box>
            {LEGAL_LINKS.map((link) => (
              <Box key={link.label} component="a" href={link.href} sx={linkSx}>
                {link.label}
              </Box>
            ))}
          </Box>
        </Box>

        <Typography
          sx={{
            mt: { xs: 2.5, md: 3 },
            pt: 2,
            borderTop: 1,
            borderColor: 'grey.700',
            fontSize: '0.75rem',
            color: 'grey.300',
          }}
        >
          {/* Server (UTC) und Browser (Berlin) liegen in der Silvesternacht
              eine Stunde auseinander – das Jahr darf dann nicht die Hydration
              der ganzen Seite brechen. */}
          © <span suppressHydrationWarning>{new Date().getFullYear()}</span>{' '}
          Bäckerei Heusser · Alle Preise inkl. MwSt. · Abholung im Laden
        </Typography>
      </Container>
    </Box>
  )
}

export default ShopFooter
