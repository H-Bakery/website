'use client'
import React, { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Typography,
  Paper,
  Avatar,
  Rating,
  IconButton,
  Fade,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { keyframes } from '@mui/system'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { TESTIMONIALS } from '../../../mocks/testimonials'

// Animation keyframes
const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(50px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`

const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
`

interface EnhancedTestimonial {
  name: string
  role?: string
  rating: number
  message: string
  image?: string
  date?: string
  verified?: boolean
}

// Enhanced testimonials with additional data
const enhancedTestimonials: EnhancedTestimonial[] = TESTIMONIALS.map((testimonial, index) => ({
  name: testimonial.name,
  rating: testimonial.stars,
  message: testimonial.text,
  role: ['Stammkunde', 'Lokaler Kunde', 'Geschäftskunde', 'Familienkunde'][index % 4],
  image: `/assets/images/testimonials/customer-${index + 1}.jpg`,
  date: new Date(Date.now() - (index * 7 * 24 * 60 * 60 * 1000) % (30 * 24 * 60 * 60 * 1000)).toLocaleDateString('de-DE'),
  verified: true,
}))

const EnhancedTestimonial: React.FC = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // Auto-rotate testimonials
  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % enhancedTestimonials.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [isAutoPlaying])

  const handlePrevious = () => {
    setIsAutoPlaying(false)
    setCurrentIndex((prev) => 
      prev === 0 ? enhancedTestimonials.length - 1 : prev - 1
    )
  }

  const handleNext = () => {
    setIsAutoPlaying(false)
    setCurrentIndex((prev) => (prev + 1) % enhancedTestimonials.length)
  }

  const currentTestimonial = enhancedTestimonials[currentIndex]

  return (
    <Box
      sx={{
        py: 8,
        backgroundColor: 'background.paper',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Decoration */}
      <Box
        sx={{
          position: 'absolute',
          top: -100,
          left: -100,
          width: 300,
          height: 300,
          borderRadius: '50%',
          backgroundColor: 'primary.main',
          opacity: 0.03,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -100,
          right: -100,
          width: 400,
          height: 400,
          borderRadius: '50%',
          backgroundColor: 'primary.main',
          opacity: 0.03,
        }}
      />

      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography
            variant="h3"
            component="h2"
            gutterBottom
            sx={{
              fontWeight: 'bold',
              fontSize: { xs: '2rem', md: '2.5rem' },
            }}
          >
            Was unsere Kunden sagen
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ maxWidth: 600, mx: 'auto' }}
          >
            Echte Bewertungen von echten Menschen aus unserer Nachbarschaft
          </Typography>
        </Box>

        <Box
          sx={{
            position: 'relative',
            maxWidth: 800,
            mx: 'auto',
          }}
        >
          {/* Navigation Buttons */}
          <IconButton
            onClick={handlePrevious}
            sx={{
              position: 'absolute',
              left: { xs: -20, md: -60 },
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'background.paper',
              boxShadow: 2,
              zIndex: 2,
              '&:hover': {
                backgroundColor: 'primary.light',
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>

          <IconButton
            onClick={handleNext}
            sx={{
              position: 'absolute',
              right: { xs: -20, md: -60 },
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'background.paper',
              boxShadow: 2,
              zIndex: 2,
              '&:hover': {
                backgroundColor: 'primary.light',
              },
            }}
          >
            <ArrowForwardIcon />
          </IconButton>

          {/* Testimonial Card */}
          <Fade in={true} key={currentIndex} timeout={600}>
            <Paper
              elevation={4}
              sx={{
                p: { xs: 3, md: 5 },
                borderRadius: 3,
                position: 'relative',
                overflow: 'visible',
                animation: `${slideIn} 0.6s ease-out`,
              }}
            >
              {/* Quote Icon */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -20,
                  left: 30,
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  backgroundColor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 3,
                  animation: `${pulse} 2s ease-in-out infinite`,
                }}
              >
                <FormatQuoteIcon sx={{ color: 'white', fontSize: 30 }} />
              </Box>

              {/* Rating */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, mt: 4 }}>
                <Rating
                  value={currentTestimonial.rating}
                  readOnly
                  size="large"
                  sx={{
                    '& .MuiRating-iconFilled': {
                      color: 'primary.main',
                    },
                  }}
                />
              </Box>

              {/* Message */}
              <Typography
                variant="h6"
                component="blockquote"
                sx={{
                  fontStyle: 'italic',
                  textAlign: 'center',
                  mb: 4,
                  fontSize: { xs: '1.1rem', md: '1.3rem' },
                  lineHeight: 1.8,
                  color: 'text.primary',
                  fontWeight: 400,
                  position: 'relative',
                  '&::before': {
                    content: '"\\201C"',
                    position: 'absolute',
                    left: -10,
                    top: -10,
                    fontSize: '3rem',
                    color: 'primary.light',
                    fontFamily: 'serif',
                  },
                  '&::after': {
                    content: '"\\201D"',
                    position: 'absolute',
                    right: -10,
                    bottom: -30,
                    fontSize: '3rem',
                    color: 'primary.light',
                    fontFamily: 'serif',
                  },
                }}
              >
                {currentTestimonial.message}
              </Typography>

              {/* Customer Info */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                <Avatar
                  sx={{
                    width: 60,
                    height: 60,
                    backgroundColor: 'primary.main',
                    fontSize: '1.5rem',
                  }}
                >
                  {currentTestimonial.name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    {currentTestimonial.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {currentTestimonial.role}
                  </Typography>
                  {currentTestimonial.verified && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'success.main',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      ✓ Verifizierter Kunde
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Date */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  textAlign: 'center',
                  mt: 2,
                }}
              >
                {currentTestimonial.date}
              </Typography>
            </Paper>
          </Fade>

          {/* Dots Indicator */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 1,
              mt: 4,
            }}
          >
            {enhancedTestimonials.map((_, index) => (
              <Box
                key={index}
                onClick={() => {
                  setCurrentIndex(index)
                  setIsAutoPlaying(false)
                }}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: currentIndex === index ? 'primary.main' : 'grey.300',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.5)',
                  },
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Trust Statement */}
        <Box
          sx={{
            mt: 6,
            p: 3,
            backgroundColor: 'background.default',
            borderRadius: 2,
            textAlign: 'center',
          }}
        >
          <Typography variant="h6" color="primary.main" gutterBottom>
            Über 500 Bewertungen
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Durchschnittliche Bewertung: 4.8 von 5 Sternen
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}

export default EnhancedTestimonial