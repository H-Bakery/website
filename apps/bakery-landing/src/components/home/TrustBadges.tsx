'use client'
import React from 'react'
import {
  Box,
  Container,
  Grid,
  Typography,
  Paper,
  useTheme,
  Tooltip,
} from '@mui/material'
import { keyframes } from '@mui/system'
import VerifiedIcon from '@mui/icons-material/Verified'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom'
import LocalFloristIcon from '@mui/icons-material/LocalFlorist'
import StarIcon from '@mui/icons-material/Star'

// Animation keyframes
const float = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
`

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`

interface TrustBadge {
  icon: React.ReactNode
  title: string
  description: string
  highlight?: string
}

const trustBadges: TrustBadge[] = [
  {
    icon: <FamilyRestroomIcon sx={{ fontSize: 40 }} />,
    title: 'Familienbetrieb',
    description: 'Seit 1933',
    highlight: '90+ Jahre',
  },
  {
    icon: <VerifiedIcon sx={{ fontSize: 40 }} />,
    title: 'Meisterbetrieb',
    description: 'Zertifizierte Qualität',
    highlight: 'Handwerk',
  },
  {
    icon: <LocalFloristIcon sx={{ fontSize: 40 }} />,
    title: 'Regional & Bio',
    description: 'Lokale Zutaten',
    highlight: '100%',
  },
  {
    icon: <StarIcon sx={{ fontSize: 40 }} />,
    title: 'Kundenzufriedenheit',
    description: 'Über 500 Bewertungen',
    highlight: '4.8★',
  },
  {
    icon: <LocalShippingIcon sx={{ fontSize: 40 }} />,
    title: 'Immer frisch',
    description: 'Ab 6:00 Uhr',
    highlight: 'Frisch',
  },
]

const TrustBadges: React.FC = () => {
  const theme = useTheme()

  return (
    <Box
      sx={{
        py: 6,
        backgroundColor: 'background.default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 200,
          height: 200,
          borderRadius: '50%',
          backgroundColor: 'primary.main',
          opacity: 0.05,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -50,
          left: -50,
          width: 150,
          height: 150,
          borderRadius: '50%',
          backgroundColor: 'primary.main',
          opacity: 0.05,
        }}
      />

      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography
            variant="h3"
            component="h2"
            gutterBottom
            sx={{
              fontWeight: 'bold',
              fontSize: { xs: '2rem', md: '2.5rem' },
            }}
          >
            Warum unsere Kunden uns vertrauen
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ maxWidth: 600, mx: 'auto' }}
          >
            Qualität, Tradition und Leidenschaft – das macht uns seit
            Generationen aus
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {trustBadges.map((badge, index) => (
            <Grid item xs={6} sm={4} md={2} key={badge.title}>
              <Tooltip title={badge.description} arrow placement="top">
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    height: '100%',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    border: '2px solid',
                    borderColor: 'transparent',
                    backgroundColor: 'background.paper',
                    animation: `${fadeIn} 0.6s ease-out ${
                      index * 0.1
                    }s both, ${float} 3s ease-in-out ${index * 0.5}s infinite`,
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: 4,
                      borderColor: 'primary.main',
                      '& .badge-icon': {
                        color: 'primary.main',
                        transform: 'scale(1.1)',
                      },
                      '& .highlight-text': {
                        backgroundColor: 'primary.main',
                        color: 'white',
                      },
                    },
                  }}
                >
                  <Box
                    className="badge-icon"
                    sx={{
                      color: 'text.secondary',
                      mb: 1,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {badge.icon}
                  </Box>

                  {badge.highlight && (
                    <Box
                      className="highlight-text"
                      sx={{
                        display: 'inline-block',
                        px: 1.5,
                        py: 0.5,
                        mb: 1,
                        borderRadius: '20px',
                        backgroundColor: 'grey.200',
                        color: 'text.primary',
                        fontSize: '0.875rem',
                        fontWeight: 'bold',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {badge.highlight}
                    </Box>
                  )}

                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 'bold',
                      mb: 0.5,
                    }}
                  >
                    {badge.title}
                  </Typography>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      lineHeight: 1.2,
                    }}
                  >
                    {badge.description}
                  </Typography>
                </Paper>
              </Tooltip>
            </Grid>
          ))}
        </Grid>

        {/* Additional Trust Statement */}
        <Box
          sx={{
            mt: 6,
            p: 3,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
            textAlign: 'center',
            border: '1px solid',
            borderColor: theme.palette.divider,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: 'text.primary',
              fontWeight: 'medium',
              mb: 1,
            }}
          >
            🌟 Über 5.000 zufriedene Kunden vertrauen uns
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            Danke für Ihr Vertrauen in unsere Handwerkskunst
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}

export default TrustBadges
