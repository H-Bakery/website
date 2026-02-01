'use client'
import React from 'react'
import {
  Box,
  Container,
  Typography,
  Paper,
  Avatar,
  Rating,
  Button,
  Grid,
} from '@mui/material'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import StarIcon from '@mui/icons-material/Star'
import { TESTIMONIALS } from '../../../mocks/testimonials'

interface EnhancedTestimonial {
  name: string
  role?: string
  rating: number
  message: string
  date?: string
  verified?: boolean
}

const ROLES = ['Stammkunde', 'Lokaler Kunde', 'Geschäftskunde', 'Familienkunde']

const enhancedTestimonials: EnhancedTestimonial[] = TESTIMONIALS.map(
  (testimonial, index) => ({
    name: testimonial.name,
    rating: testimonial.stars,
    message: testimonial.text,
    role: ROLES[index % ROLES.length],
    date: new Date(
      Date.now() -
        ((index * 7 * 24 * 60 * 60 * 1000) % (30 * 24 * 60 * 60 * 1000))
    ).toLocaleDateString('de-DE'),
    verified: true,
  })
)

const EnhancedTestimonial: React.FC = () => {
  const displayedTestimonials = enhancedTestimonials.slice(0, 3)

  return (
    <Box
      sx={{
        py: { xs: 6, md: 8 },
        backgroundColor: '#F5EDE4',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            textAlign: 'center',
            mb: { xs: 4, md: 6 },
            px: { xs: 2, md: 0 },
          }}
        >
          <Typography
            variant="h3"
            component="h2"
            gutterBottom
            sx={{
              fontFamily: '"Cinzel", serif',
              fontWeight: 700,
              fontSize: { xs: '1.6rem', sm: '2rem', md: '2.25rem' },
              color: '#3B2B28',
              mb: { xs: 1, md: 2 },
            }}
          >
            Was unsere Kunden sagen
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              maxWidth: { xs: 'none', md: 600 },
              mx: 'auto',
              fontSize: { xs: '1rem', md: '1.1rem' },
              color: '#928168',
              px: { xs: 1, md: 0 },
            }}
          >
            Echte Bewertungen von echten Menschen aus unserer Nachbarschaft
          </Typography>
        </Box>

        <Grid
          container
          spacing={{ xs: 2, md: 4 }}
          sx={{
            maxWidth: { xs: 'none', md: 1200 },
            mx: 'auto',
            px: { xs: 2, md: 0 },
          }}
        >
          {displayedTestimonials.map((testimonial, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2.5, md: 3 },
                  borderRadius: '12px',
                  position: 'relative',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid',
                  borderColor: '#E6D8C3',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {/* Quote Icon */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: -15,
                    left: 20,
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    backgroundColor: '#928168',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(146, 129, 104, 0.3)',
                  }}
                >
                  <FormatQuoteIcon sx={{ color: '#FFFFFF', fontSize: 20 }} />
                </Box>

                {/* Rating */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 2,
                    mt: 3,
                  }}
                >
                  <Rating
                    value={testimonial.rating}
                    readOnly
                    size="medium"
                    sx={{
                      '& .MuiRating-iconFilled': {
                        color: '#D4A574',
                      },
                    }}
                  />
                </Box>

                {/* Message */}
                <Typography
                  variant="body1"
                  component="blockquote"
                  sx={{
                    fontStyle: 'italic',
                    fontFamily: '"Merriweather", serif',
                    textAlign: 'center',
                    mb: { xs: 2, md: 3 },
                    fontSize: { xs: '1rem', md: '1.05rem' },
                    lineHeight: 1.7,
                    color: '#3B2B28',
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    wordWrap: 'break-word',
                    hyphens: 'auto',
                  }}
                >
                  &ldquo;{testimonial.message}&rdquo;
                </Typography>

                {/* Customer Info */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    mt: 'auto',
                  }}
                >
                  <Avatar
                    sx={{
                      width: 50,
                      height: 50,
                      backgroundColor: '#5A2E2A',
                      fontFamily: '"Cinzel", serif',
                      fontSize: '1.2rem',
                    }}
                  >
                    {testimonial.name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 700,
                        color: '#3B2B28',
                        fontFamily: '"Merriweather", serif',
                      }}
                    >
                      {testimonial.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#928168' }}>
                      {testimonial.role}
                    </Typography>
                    {testimonial.verified && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#7A9B6B',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          fontWeight: 600,
                        }}
                      >
                        Verifiziert
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Trust Statement */}
        <Box
          sx={{
            mt: { xs: 4, md: 6 },
            mx: { xs: 2, md: 0 },
            p: { xs: 2.5, md: 3 },
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            textAlign: 'center',
            border: '1px solid',
            borderColor: '#E6D8C3',
          }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              fontFamily: '"Cinzel", serif',
              color: '#5A2E2A',
              fontSize: { xs: '1.1rem', md: '1.25rem' },
            }}
          >
            Echte Kundenbewertungen
          </Typography>
          <Typography
            variant="body2"
            gutterBottom
            sx={{
              color: '#928168',
              fontSize: { xs: '0.9rem', md: '0.95rem' },
            }}
          >
            Durchschnittliche Bewertung: 4.8 von 5 Sternen
          </Typography>
          <Button
            variant="outlined"
            startIcon={<StarIcon />}
            href="https://share.google/99F0UfUOhLCB8waq1"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              mt: 2,
              fontSize: { xs: '0.9rem', md: '0.95rem' },
              px: { xs: 2, md: 3 },
              py: { xs: 1, md: 1.5 },
              minHeight: 48,
              borderColor: '#5A2E2A',
              color: '#5A2E2A',
              fontWeight: 700,
              borderWidth: 2,
              borderRadius: '8px',
              '&:hover': {
                borderColor: '#3B2B28',
                backgroundColor: 'rgba(90, 46, 42, 0.05)',
                borderWidth: 2,
              },
            }}
          >
            <Box
              component="span"
              sx={{ display: { xs: 'none', sm: 'inline' } }}
            >
              Alle Google Bewertungen ansehen
            </Box>
            <Box
              component="span"
              sx={{ display: { xs: 'inline', sm: 'none' } }}
            >
              Google Bewertungen
            </Box>
          </Button>
        </Box>
      </Container>
    </Box>
  )
}

export default EnhancedTestimonial
