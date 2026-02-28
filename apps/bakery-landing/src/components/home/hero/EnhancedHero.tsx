'use client'
import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Container,
  Button,
  Chip,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import PhoneIcon from '@mui/icons-material/Phone'
import PlaceIcon from '@mui/icons-material/Place'
import {
  isCurrentlyOpen,
  getTodayHours,
  opensLaterToday,
  getTodayOpeningTime,
} from '../../../utils/openingHours'

// Hero image with warm gradient fallback
const heroImage = '/assets/images/bakery/fresh-bread-hero.jpg'
const warmGradient =
  'linear-gradient(135deg, #3B2B28 0%, #5A2E2A 25%, #7A4A3A 50%, #928168 75%, #E6D8C3 100%)'

interface OpenStatus {
  open: boolean
  todayHours: string
  opensLater: boolean
  openingTime: string | null
}

const EnhancedHero: React.FC = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [imageLoadError, setImageLoadError] = useState(false)
  const [openStatus, setOpenStatus] = useState<OpenStatus | null>(null)

  useEffect(() => {
    setOpenStatus({
      open: isCurrentlyOpen(),
      todayHours: getTodayHours(),
      opensLater: opensLaterToday(),
      openingTime: getTodayOpeningTime(),
    })
  }, [])

  return (
    <Box sx={styles.hero}>
      {/* Background */}
      <Box sx={styles.backgroundContainer}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: warmGradient,
          }}
        />
        {!imageLoadError && (
          <Box
            component="img"
            src={heroImage}
            alt="Bäckerei Heusser - Frische Backwaren"
            onError={() => setImageLoadError(true)}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.85,
            }}
          />
        )}
        <Box sx={styles.overlay} />
      </Box>

      {/* Content */}
      <Container maxWidth="lg" sx={styles.contentContainer}>
        <Box sx={styles.content}>
          {/* Opening Status Badge */}
          {openStatus && (
            <Chip
              label={
                openStatus.open
                  ? `Jetzt geöffnet — ${openStatus.todayHours}`
                  : openStatus.opensLater && openStatus.openingTime
                  ? `Öffnet um ${openStatus.openingTime} Uhr`
                  : `Heute geschlossen`
              }
              sx={{
                ...styles.statusBadge,
                backgroundColor: openStatus.open
                  ? 'rgba(122, 155, 107, 0.9)'
                  : openStatus.opensLater
                  ? 'rgba(180, 140, 60, 0.9)'
                  : 'rgba(180, 60, 60, 0.85)',
              }}
            />
          )}

          {/* Bakery Name */}
          <Typography variant="h1" component="h1" sx={styles.headline}>
            Bäckerei Heusser
          </Typography>

          {/* Tagline */}
          <Typography variant="h5" sx={styles.tagline}>
            Täglich frisch aus der Backstube — seit 1933
          </Typography>

          {/* Phone Number */}
          <Typography
            component="a"
            href="tel:068412229"
            sx={styles.phoneNumber}
          >
            <PhoneIcon sx={{ fontSize: '1.2em', mr: 1 }} />
            06841 2229
          </Typography>

          {/* CTA Buttons */}
          <Box sx={styles.ctaContainer}>
            <Button
              variant="contained"
              size="large"
              href="tel:068412229"
              sx={styles.primaryCta}
            >
              Jetzt bestellen
            </Button>
            <Button
              variant="outlined"
              size="large"
              href="#location-hours"
              startIcon={<PlaceIcon />}
              sx={styles.secondaryCta}
            >
              So finden Sie uns
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}

const styles = {
  hero: {
    position: 'relative' as const,
    height: { xs: '85svh', md: '90vh' },
    minHeight: { xs: '500px', md: '550px' },
    maxHeight: { xs: '750px', md: 'none' },
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundContainer: {
    position: 'absolute' as const,
    inset: 0,
  },
  overlay: {
    position: 'absolute' as const,
    inset: 0,
    background:
      'linear-gradient(to bottom, rgba(59, 43, 40, 0.55) 0%, rgba(59, 43, 40, 0.7) 100%)',
  },
  contentContainer: {
    position: 'relative' as const,
    zIndex: 2,
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
  },
  content: {
    textAlign: 'center' as const,
    color: 'white',
    py: { xs: 3, md: 4 },
    px: { xs: 2, sm: 2 },
  },
  statusBadge: {
    color: '#FFFFFF',
    fontSize: { xs: '0.95rem', md: '1.05rem' },
    fontWeight: 700,
    fontFamily: '"Merriweather", serif',
    py: 1,
    px: 2.5,
    mb: 3,
    height: 'auto',
    borderRadius: '24px',
    '& .MuiChip-label': {
      px: 1,
    },
  },
  headline: {
    mb: 2,
    fontWeight: 900,
    fontFamily: '"Cinzel", serif',
    fontSize: { xs: '2.2rem', sm: '3rem', md: '3.8rem', lg: '4.2rem' },
    textShadow: '2px 4px 8px rgba(0,0,0,0.4)',
    lineHeight: { xs: 1.2, md: 1.15 },
  },
  tagline: {
    mb: 3,
    fontFamily: '"Merriweather", serif',
    fontSize: { xs: '1.05rem', sm: '1.2rem', md: '1.35rem' },
    fontWeight: 400,
    maxWidth: { xs: '100%', md: '700px' },
    mx: 'auto',
    textShadow: '1px 2px 4px rgba(0,0,0,0.4)',
    lineHeight: 1.6,
  },
  phoneNumber: {
    display: 'inline-flex',
    alignItems: 'center',
    color: '#FFFFFF',
    fontSize: { xs: '1.3rem', md: '1.5rem' },
    fontWeight: 700,
    fontFamily: '"Merriweather", serif',
    textDecoration: 'none',
    mb: 4,
    py: 1,
    px: 2,
    borderRadius: '8px',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
  },
  ctaContainer: {
    display: 'flex',
    gap: { xs: 1.5, md: 2 },
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
    flexDirection: { xs: 'column', sm: 'row' } as any,
    alignItems: 'center',
    px: { xs: 2, md: 0 },
  },
  primaryCta: {
    px: { xs: 4, md: 5 },
    py: { xs: 1.5, md: 1.8 },
    fontSize: { xs: '1.05rem', md: '1.15rem' },
    fontWeight: 700,
    backgroundColor: '#d038ba',
    color: 'white',
    boxShadow: '0 4px 20px rgba(208, 56, 186, 0.35)',
    transition: 'all 0.3s ease',
    minWidth: { xs: '240px', sm: 'auto' },
    width: { xs: '100%', sm: 'auto' },
    maxWidth: { xs: '300px', sm: 'none' },
    borderRadius: '8px',
    '&:hover': {
      backgroundColor: '#b830a0',
      transform: 'translateY(-2px)',
      boxShadow: '0 6px 25px rgba(208, 56, 186, 0.45)',
    },
  },
  secondaryCta: {
    px: { xs: 4, md: 5 },
    py: { xs: 1.5, md: 1.8 },
    fontSize: { xs: '1.05rem', md: '1.15rem' },
    fontWeight: 700,
    borderColor: 'rgba(255,255,255,0.7)',
    color: 'white',
    borderWidth: 2,
    minWidth: { xs: '240px', sm: 'auto' },
    width: { xs: '100%', sm: 'auto' },
    maxWidth: { xs: '300px', sm: 'none' },
    borderRadius: '8px',
    '&:hover': {
      borderColor: '#FFFFFF',
      backgroundColor: 'rgba(255,255,255,0.12)',
      transform: 'translateY(-2px)',
    },
  },
}

export default EnhancedHero
