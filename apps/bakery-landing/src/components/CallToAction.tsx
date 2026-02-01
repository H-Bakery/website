'use client'
import React from 'react'
import {
  Box,
  Typography,
  Container,
  Paper,
  Grid,
  Button,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { useRouter } from 'next/navigation'

/**
 * Call-to-action button configuration
 */
export interface CTAAction {
  label: string
  icon?: React.ReactNode
  href: string
  variant?: 'text' | 'outlined' | 'contained'
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning'
  external?: boolean
}

/**
 * Call-to-action component props
 */
export interface CallToActionProps {
  title: string
  subtitle: string
  description: string
  primaryAction: CTAAction
  secondaryAction?: CTAAction
  backgroundImage?: string
  position?: 'top' | 'bottom'
  compact?: boolean
  sx?: React.ComponentProps<typeof Box>['sx']
}

/**
 * Local CallToAction component for landing page (simplified version)
 */
export const CallToAction: React.FC<CallToActionProps> = ({
  title,
  subtitle,
  description,
  primaryAction,
  secondaryAction,
  backgroundImage,
  position = 'top',
  compact = false,
  sx,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const router = useRouter()

  const handleActionClick = (action: CTAAction) => {
    if (action.external) {
      window.open(action.href, '_blank', 'noopener,noreferrer')
    } else {
      router.push(action.href)
    }
  }

  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        py: compact ? 3 : 5,
        bgcolor: position === 'top' ? 'grey.50' : 'background.paper', // Warm cream
        ...sx,
      }}
    >
      <Container maxWidth="lg">
        <Paper
          elevation={3}
          sx={{
            p: { xs: 2, sm: 3, md: 4 }, // Smaller padding on mobile
            borderRadius: 2,
            backgroundImage: backgroundImage
              ? `url(${backgroundImage})`
              : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative',
            overflow: 'hidden',
            bgcolor: backgroundImage ? 'rgba(0,0,0,0.7)' : 'background.paper',
            color: backgroundImage ? 'white' : 'inherit',
          }}
        >
          <Grid
            container
            spacing={{ xs: 2, md: 3 }} // Smaller spacing on mobile
            alignItems="center"
            justifyContent="space-between"
          >
            {/* Text content */}
            <Grid item xs={12} md={8}>
              {' '}
              {/* Wider on mobile */}
              <Box>
                <Typography
                  variant="overline"
                  component="p"
                  sx={{
                    color: backgroundImage ? 'grey.300' : 'primary.main',
                    fontWeight: 'bold',
                    mb: 0.5,
                    letterSpacing: '0.1em',
                  }}
                >
                  {subtitle}
                </Typography>

                <Typography
                  variant="h4"
                  component="h2"
                  fontWeight="bold"
                  sx={{
                    mb: { xs: 1, md: 1.5 }, // Smaller margin on mobile
                    color: backgroundImage ? 'white' : 'text.primary',
                    fontSize: compact
                      ? { xs: '1.3rem', sm: '1.5rem', md: '2rem' } // Better mobile scaling
                      : { xs: '1.5rem', sm: '1.75rem', md: '2.5rem' },
                    lineHeight: { xs: 1.2, md: 1.1 }, // Better line height on mobile
                  }}
                >
                  {title}
                </Typography>

                <Typography
                  variant="body1"
                  sx={{
                    mb: { xs: 2, md: 3 }, // Smaller margin on mobile
                    color: backgroundImage ? 'grey.100' : 'text.secondary',
                    maxWidth: { xs: 'none', md: '600px' }, // No max width on mobile
                    lineHeight: 1.6,
                    fontSize: { xs: '0.9rem', md: '1.1rem' }, // Smaller on mobile
                  }}
                >
                  {description}
                </Typography>
              </Box>
            </Grid>

            {/* Action buttons */}
            <Grid
              item
              xs={12}
              md={4} // Smaller on desktop to match wider text area
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: { xs: 'stretch', md: 'flex-end' },
                gap: { xs: 1.5, md: 2 }, // Smaller gap on mobile
                mt: { xs: 1, md: 0 }, // Small margin on mobile
              }}
            >
              <Button
                variant={primaryAction.variant || 'contained'}
                color={primaryAction.color || 'primary'}
                size={compact ? 'medium' : 'large'}
                startIcon={primaryAction.icon}
                onClick={() => handleActionClick(primaryAction)}
                fullWidth={isMobile}
                sx={{
                  px: { xs: 2, md: 3 }, // Smaller padding on mobile
                  py: compact ? { xs: 0.8, md: 1 } : { xs: 1.2, md: 1.5 },
                  minWidth: { xs: '100%', md: '200px' }, // Full width on mobile
                  fontWeight: 'bold',
                  fontSize: compact
                    ? { xs: '0.9rem', md: 'inherit' }
                    : { xs: '1rem', md: '1.1rem' }, // Smaller on mobile
                  minHeight: 44, // Ensure good touch target size
                }}
              >
                {primaryAction.label}
              </Button>

              {secondaryAction && (
                <Button
                  variant={secondaryAction.variant || 'outlined'}
                  color={secondaryAction.color || 'primary'}
                  size={compact ? 'medium' : 'large'}
                  startIcon={secondaryAction.icon}
                  onClick={() => handleActionClick(secondaryAction)}
                  fullWidth={isMobile}
                  sx={{
                    px: { xs: 2, md: 3 }, // Smaller padding on mobile
                    py: compact ? { xs: 0.8, md: 1 } : { xs: 1.2, md: 1.5 },
                    minWidth: { xs: '100%', md: '200px' }, // Full width on mobile
                    fontWeight: 'medium',
                    fontSize: compact
                      ? { xs: '0.9rem', md: 'inherit' }
                      : { xs: '1rem', md: '1.1rem' }, // Smaller on mobile
                    minHeight: 44, // Ensure good touch target size
                    borderColor: backgroundImage ? 'white' : undefined,
                    color: backgroundImage ? 'white' : undefined,
                    '&:hover': {
                      borderColor: backgroundImage ? 'grey.300' : undefined,
                      bgcolor: backgroundImage
                        ? 'rgba(255,255,255,0.1)'
                        : undefined,
                    },
                  }}
                >
                  {secondaryAction.label}
                </Button>
              )}
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  )
}

export default CallToAction
