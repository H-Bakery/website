import React from 'react'
import { Box, Container, Grid, Typography } from '@mui/material'
import Link from 'next/link'
import { getFooterHours } from '../utils/openingHours'
import { LEGAL } from '../config/legal'
import Socials from './Socials'

/**
 * Colours of the footer. Every text colour reaches at least 4.5:1 (WCAG AA)
 * on the background - checked in `theme/theme.spec.ts`. No alpha on text:
 * a transparent cream on brown is what made the old footer unreadable.
 */
export const FOOTER_COLORS = {
  /** dark-brown (`primary.main`) */
  background: '#5A2E2A',
  text: {
    /** cream - column titles, phone numbers */
    strong: '#FFF3E6',
    /** beige - addresses, links, opening hours */
    regular: '#E6D8C3',
    /** warm sand - "Seit 1933", copyright */
    muted: '#D4C4B0',
  },
  divider: 'rgba(255, 243, 230, 0.2)',
} as const

/**
 * The crest as a static file, with the cream fill baked in. Inline it was
 * 55 KB of path data in every page's HTML; as an `<img>` it is loaded once,
 * lazily, and cached.
 */
export const FOOTER_WAPPEN_SRC = '/assets/images/brand/wappen.svg'
const WAPPEN_WIDTH = 450
const WAPPEN_HEIGHT = Math.round((WAPPEN_WIDTH * 308) / 407)

/** Every link in the footer is a tap target of at least 44 px height. */
const linkSx = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 44,
  color: FOOTER_COLORS.text.regular,
  fontSize: '1rem',
  lineHeight: 1.7,
  textDecoration: 'none',
  '&:hover, &:focus-visible': {
    color: FOOTER_COLORS.text.strong,
    textDecoration: 'underline',
  },
} as const

const listSx = {
  listStyle: 'none',
  m: 0,
  p: 0,
  '& a': linkSx,
} as const

/** Column title: looks like an h6, but adds no heading to every page. */
const ColumnTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="h6"
    component="p"
    gutterBottom
    sx={{
      fontWeight: 700,
      color: FOOTER_COLORS.text.strong,
      fontFamily: '"Cinzel", serif',
    }}
  >
    {children}
  </Typography>
)

const NAVIGATION = [
  { label: 'Sortiment', path: '/products' },
  { label: 'Neuigkeiten', path: '/news' },
  { label: 'Über uns', path: '/about' },
  { label: 'Kontakt', path: '/contact' },
]

const LEGAL_LINKS = [
  { label: 'Impressum', path: '/imprint' },
  { label: 'Datenschutz', path: '/datenschutz' },
]

export const LocalFooter: React.FC = () => {
  const hours = getFooterHours()

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: FOOTER_COLORS.background,
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
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, decorative */}
        <img
          src={FOOTER_WAPPEN_SRC}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          width={WAPPEN_WIDTH}
          height={WAPPEN_HEIGHT}
          style={{ display: 'block' }}
        />
      </Box>
      <Container sx={{ position: 'relative', zIndex: 1 }}>
        <Grid container spacing={4}>
          <Grid item xs={12} sm={6} md={3}>
            <ColumnTitle>Bäckerei Heusser</ColumnTitle>
            <Typography
              variant="body2"
              sx={{
                mb: 2,
                color: FOOTER_COLORS.text.regular,
                fontSize: '1rem',
              }}
            >
              Wir backen mit Herz, nach Tradition und nur für Sie.
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: FOOTER_COLORS.text.muted, fontSize: '1rem' }}
            >
              Seit 1933
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <ColumnTitle>Navigation</ColumnTitle>
            {/* -8 px: the first link's text lines up with the other columns. */}
            <Box component="ul" sx={{ ...listSx, mt: -1 }}>
              {NAVIGATION.map((item) => (
                <li key={item.path}>
                  <Link href={item.path}>{item.label}</Link>
                </li>
              ))}
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <ColumnTitle>Kontakt</ColumnTitle>
            <Typography
              variant="body2"
              sx={{
                mb: 1,
                color: FOOTER_COLORS.text.regular,
                fontSize: '1rem',
              }}
            >
              Eckstraße 3
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mb: 1,
                color: FOOTER_COLORS.text.regular,
                fontSize: '1rem',
              }}
            >
              66424 Homburg/Kirrberg
            </Typography>
            <Box
              component="ul"
              sx={{
                ...listSx,
                mt: -1,
                mb: 1,
                '& a.footer-strong': {
                  color: FOOTER_COLORS.text.strong,
                  fontWeight: 700,
                },
              }}
            >
              <li>
                <a className="footer-strong" href={LEGAL.phoneHref}>
                  Tel: {LEGAL.phone}
                </a>
              </li>
              <li>
                <a className="footer-strong" href={LEGAL.mobileHref}>
                  Mobil / WhatsApp: {LEGAL.mobile}
                </a>
              </li>
              <li>
                <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
              </li>
            </Box>
            <Box
              sx={{
                // 44 px tap targets; the icon stays flush with the text above.
                ml: '-10px',
                '&& a': {
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 44,
                  minHeight: 44,
                  color: FOOTER_COLORS.text.regular,
                },
                '&& a:hover, && a:focus-visible': {
                  color: FOOTER_COLORS.text.strong,
                },
                '&& svg': { mr: 0 },
              }}
            >
              <Socials />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <ColumnTitle>Öffnungszeiten</ColumnTitle>
            {hours.map((item, index) => (
              <Typography
                key={item.label}
                variant="body2"
                sx={{
                  mb: index < hours.length - 1 ? 1 : 0,
                  color: FOOTER_COLORS.text.regular,
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
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            columnGap: 2,
            pt: 3,
            mt: 4,
            borderTop: 1,
            borderColor: FOOTER_COLORS.divider,
          }}
        >
          <Typography variant="body2" sx={{ color: FOOTER_COLORS.text.muted }}>
            &copy; {new Date().getFullYear()} Bäckerei Heusser
          </Typography>
          <Box
            component="ul"
            sx={{
              ...listSx,
              display: 'flex',
              gap: 2,
            }}
          >
            {LEGAL_LINKS.map((item) => (
              <li key={item.path}>
                <Link href={item.path}>{item.label}</Link>
              </li>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
