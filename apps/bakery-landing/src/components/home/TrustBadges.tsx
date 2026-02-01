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
import Cake from '@mui/icons-material/Cake'
import { getEarliestOpeningLabel } from '../../utils/openingHours'

// Animation keyframes - simplified
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(15px);
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
    title: 'Erfahrene Bäcker',
    description: 'Jahrzehntelange Expertise',
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
    description: getEarliestOpeningLabel(),
    highlight: 'Frisch',
  },
  {
    icon: <Cake sx={{ fontSize: 40 }} />,
    title: 'Große Auswahl',
    description: 'Über 50 Sorten',
    highlight: 'Vielfalt',
  },
]

const TrustBadges: React.FC = () => {
  const theme = useTheme()

  return (
    <Box
      sx={{
        py: 6,
        backgroundColor: 'grey.50', // Warm cream background
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Pattern - warm accents (hidden on mobile to reduce visual clutter) */}
      <Box
        sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 200,
          height: 200,
          borderRadius: '50%',
          backgroundColor: 'secondary.main', // Dusty rose
          opacity: 0.08,
          display: { xs: 'none', md: 'block' }, // Hide on mobile
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
          backgroundColor: 'primary.light', // Caramel
          opacity: 0.08,
          display: { xs: 'none', md: 'block' }, // Hide on mobile
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

        <Grid container spacing={{ xs: 2, md: 3 }}>
          {trustBadges.map((badge, index) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={badge.title}>
              {' '}
              {/* Single column on mobile */}
              <Tooltip title={badge.description} arrow placement="top">
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2.5, md: 2 },
                    height: '100%',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    border: '2px solid',
                    borderColor: 'transparent',
                    backgroundColor: 'background.paper',
                    minHeight: { xs: 120, md: 'auto' },
                    animation: `${fadeIn} 0.6s ease-out ${index * 0.1}s both`,
                    // Simple hover - no infinite animations
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      boxShadow: '0 8px 24px rgba(107, 68, 35, 0.15)', // Warm brown shadow
                      borderColor: 'secondary.main', // Rose border on hover
                      '& .badge-icon': {
                        color: 'primary.main', // Brown icon
                        transform: 'scale(1.1)',
                      },
                      '& .highlight-text': {
                        backgroundColor: 'secondary.main', // Dusty rose
                        color: 'primary.dark',
                      },
                    },
                    // Mobile touch styles
                    '@media (max-width: 600px)': {
                      '&:active': {
                        transform: 'translateY(-3px) scale(0.98)',
                        boxShadow: 2,
                        borderColor: 'secondary.main',
                      },
                    },
                  }}
                >
                  <Box
                    className="badge-icon"
                    sx={{
                      color: 'primary.light', // Caramel color for icons
                      mb: { xs: 1.5, md: 1 },
                      transition: 'all 0.3s ease',
                      '& svg': {
                        fontSize: { xs: 36, md: 40 },
                      },
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
                        backgroundColor: 'grey.100', // Soft beige
                        color: 'primary.main', // Warm brown text
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
                      fontSize: { xs: '0.9rem', md: '0.875rem' }, // Better mobile sizing
                    }}
                  >
                    {badge.title}
                  </Typography>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      lineHeight: 1.3,
                      fontSize: { xs: '0.8rem', md: '0.75rem' }, // Better mobile sizing
                    }}
                  >
                    {badge.description}
                  </Typography>
                </Paper>
              </Tooltip>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default TrustBadges
