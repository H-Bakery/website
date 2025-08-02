'use client'
import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Container,
  Button,
  Chip,
  Fade,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { keyframes } from '@mui/system'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import Baeckerei from '../../icons/brand/Baeckerei'
import Wappen from '../../icons/brand/Wappen'

// Animation keyframes
const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`

const float = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
`

const pulse = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
`

// Hero images rotation - will use gradient fallback if images don't exist
const heroImages = [
  '/assets/images/bakery/fresh-bread-hero.jpg',
  '/assets/images/bakery/artisan-croissants.jpg',
  '/assets/images/bakery/traditional-pretzels.jpg',
  '/assets/images/bakery/homemade-cakes.jpg',
]

// Enhanced gradient backgrounds for better visual appeal
const gradientBackgrounds = [
  'linear-gradient(135deg, #8B4513 0%, #D2691E 25%, #CD853F 50%, #DEB887 75%, #F5DEB3 100%)',
  'linear-gradient(135deg, #654321 0%, #8B4513 30%, #D2691E 60%, #F5DEB3 100%)',
  'linear-gradient(135deg, #3E2723 0%, #5D4037 25%, #795548 50%, #A1887F 75%, #D7CCC8 100%)',
  'linear-gradient(135deg, #4A148C 0%, #7B1FA2 25%, #AB47BC 50%, #CE93D8 75%, #F3E5F5 100%)',
]

const EnhancedHero: React.FC = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imageLoadErrors, setImageLoadErrors] = useState<{
    [key: number]: boolean
  }>({})

  // Rotate images/gradients every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleImageError = (index: number) => {
    setImageLoadErrors((prev) => ({ ...prev, [index]: true }))
  }

  const scrollToContent = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: 'smooth',
    })
  }

  return (
    <Box sx={styles.hero}>
      {/* Background Image with Parallax Effect */}
      <Box sx={styles.backgroundContainer}>
        {/* Dynamic Gradient Backgrounds */}
        {gradientBackgrounds.map((gradient, index) => (
          <Box
            key={`gradient-${index}`}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              background: gradient,
              opacity: currentImageIndex === index ? 1 : 0,
              transition: 'opacity 1.5s ease-in-out',
            }}
          />
        ))}

        {/* Hero Images (with error handling) */}
        {heroImages.map(
          (image, index) =>
            !imageLoadErrors[index] && (
              <Box
                key={image}
                component="img"
                src={image}
                alt={`Bäckerei Heußer - ${index + 1}`}
                onError={() => handleImageError(index)}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: currentImageIndex === index ? 1 : 0,
                  transition: 'opacity 1.5s ease-in-out',
                  transform: 'scale(1.1)',
                }}
              />
            )
        )}
        <Box sx={styles.overlay} />
      </Box>

      {/* Content Container */}
      <Container maxWidth="lg" sx={styles.contentContainer}>
        <Box sx={styles.content}>
          {/* Logo Section */}
          <Fade in={true} timeout={1000}>
            <Box sx={styles.logoSection}>
              <Box sx={styles.logoWrapper}>
                <Wappen />
                <Baeckerei />
              </Box>
            </Box>
          </Fade>

          {/* Main Headline */}
          <Fade in={true} timeout={1500}>
            <Typography variant="h1" component="h1" sx={styles.headline}>
              Handwerkliche Backkunst
              <br />
              <Box component="span" sx={styles.subHeadline}>
                seit 1933
              </Box>
            </Typography>
          </Fade>

          {/* Tagline */}
          <Fade in={true} timeout={2000}>
            <Typography variant="h5" sx={styles.tagline}>
              Tradition trifft Leidenschaft – täglich frisch für Sie gebacken
            </Typography>
          </Fade>

          {/* Feature Badges */}
          <Fade in={true} timeout={2500}>
            <Box sx={styles.badges}>
              <Chip
                icon={<LocalFireDepartmentIcon />}
                label="Täglich frisch aus dem Ofen"
                sx={styles.badge}
              />
              <Chip
                icon={<AccessTimeIcon />}
                label="Ab 6:00 Uhr geöffnet"
                sx={styles.badge}
              />
            </Box>
          </Fade>

          {/* CTA Buttons */}
          <Fade in={true} timeout={3000}>
            <Box sx={styles.ctaContainer}>
              <Button
                variant="contained"
                size="large"
                href="/products"
                sx={styles.primaryCta}
              >
                Unser Sortiment entdecken
              </Button>
              <Button
                variant="outlined"
                size="large"
                href="/bestellen"
                sx={styles.secondaryCta}
              >
                Jetzt vorbestellen
              </Button>
            </Box>
          </Fade>
        </Box>

        {/* Scroll Indicator */}
        <Box sx={styles.scrollIndicator} onClick={scrollToContent}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Mehr entdecken
          </Typography>
          <ArrowDownwardIcon sx={styles.scrollIcon} />
        </Box>
      </Container>
    </Box>
  )
}

const styles = {
  hero: {
    position: 'relative',
    height: '100vh',
    minHeight: '600px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    background:
      'linear-gradient(135deg, #8B4513 0%, #D2691E 25%, #CD853F 50%, #DEB887 75%, #F5DEB3 100%)',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    transform: 'scale(1.1)',
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background:
        'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
    },
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(1px)',
  },
  contentContainer: {
    position: 'relative',
    zIndex: 2,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  content: {
    textAlign: 'center',
    color: 'white',
    py: 4,
  },
  logoSection: {
    mb: 4,
    animation: `${fadeInUp} 1s ease-out`,
  },
  logoWrapper: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
    transform: { xs: 'scale(0.8)', sm: 'scale(0.9)', md: 'scale(1)' },
  },
  headline: {
    mb: 2,
    fontWeight: 900,
    fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
    textShadow: '2px 4px 8px rgba(0,0,0,0.5)',
    animation: `${fadeInUp} 1.2s ease-out`,
    lineHeight: 1.1,
  },
  subHeadline: {
    fontSize: '0.7em',
    fontWeight: 400,
    color: 'primary.main',
    display: 'inline-block',
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: -8,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '80%',
      height: '3px',
      backgroundColor: 'primary.main',
    },
  },
  tagline: {
    mb: 4,
    fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
    fontWeight: 400,
    maxWidth: '800px',
    mx: 'auto',
    textShadow: '1px 2px 4px rgba(0,0,0,0.5)',
    animation: `${fadeInUp} 1.4s ease-out`,
  },
  badges: {
    display: 'flex',
    justifyContent: 'center',
    gap: 2,
    mb: 4,
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    color: 'white',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    fontSize: '0.9rem',
    py: 0.5,
    px: 2,
    '& .MuiChip-icon': {
      color: '#F5DEB3', // Warm light color for better contrast on dark overlay
    },
    animation: `${float} 3s ease-in-out infinite`,
  },
  ctaContainer: {
    display: 'flex',
    gap: 2,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  primaryCta: {
    px: 4,
    py: 1.5,
    fontSize: '1.1rem',
    fontWeight: 600,
    backgroundColor: 'primary.main',
    color: 'white',
    boxShadow: '0 4px 20px rgba(208, 56, 186, 0.4)',
    transition: 'all 0.3s ease',
    '&:hover': {
      backgroundColor: 'primary.dark',
      transform: 'translateY(-2px)',
      boxShadow: '0 6px 25px rgba(208, 56, 186, 0.5)',
    },
    animation: `${pulse} 2s ease-in-out infinite`,
  },
  secondaryCta: {
    px: 4,
    py: 1.5,
    fontSize: '1.1rem',
    fontWeight: 600,
    borderColor: 'white',
    color: 'white',
    borderWidth: 2,
    '&:hover': {
      borderColor: 'white',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      transform: 'translateY(-2px)',
    },
  },
  scrollIndicator: {
    position: 'absolute',
    bottom: 30,
    left: '50%',
    transform: 'translateX(-50%)',
    textAlign: 'center',
    color: 'white',
    cursor: 'pointer',
    animation: `${float} 2s ease-in-out infinite`,
    '&:hover': {
      '& svg': {
        transform: 'translateY(5px)',
      },
    },
  },
  scrollIcon: {
    fontSize: '2rem',
    transition: 'transform 0.3s ease',
  },
}

export default EnhancedHero
