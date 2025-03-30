'use client'
import React from 'react'
import {
  Box,
  Typography,
  Container,
  Paper,
  Button,
  Grid,
  useTheme,
  useMediaQuery,
  Divider,
} from '@mui/material'
import DirectionsIcon from '@mui/icons-material/Directions'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'
import PhoneIcon from '@mui/icons-material/Phone'
import { useRouter } from 'next/navigation'

interface CTAAction {
  label: string
  icon?: React.ReactNode
  href: string
  variant?: 'text' | 'outlined' | 'contained'
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning'
  external?: boolean
}

interface CallToActionProps {
  title: string
  subtitle: string
  description: string
  primaryAction: CTAAction
  secondaryAction?: CTAAction
  backgroundImage?: string
  position?: 'top' | 'bottom'
  compact?: boolean
}

const CallToAction: React.FC<CallToActionProps> = ({
  title,
  subtitle,
  description,
  primaryAction,
  secondaryAction,
  backgroundImage,
  position = 'top',
  compact = false,
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
      sx={{
        position: 'relative',
        overflow: 'hidden',
        py: compact ? 3 : 5,
        bgcolor: position === 'top' ? 'background.default' : 'background.paper',
      }}
    >
      {/* Background graphics */}
      {position === 'top' && (
        <Box
          sx={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 150,
            height: 150,
            borderRadius: '50%',
            backgroundColor: 'primary.main',
            opacity: 0.05,
            zIndex: 0,
          }}
        />
      )}

      {position === 'bottom' && (
        <Box
          sx={{
            position: 'absolute',
            bottom: -30,
            left: -30,
            width: 150,
            height: 150,
            borderRadius: '50%',
            backgroundColor: 'primary.main',
            opacity: 0.05,
            zIndex: 0,
          }}
        />
      )}

      <Container maxWidth="lg">
        <Paper
          elevation={3}
          sx={{
            p: { xs: 3, md: 4 },
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
            '&::before': backgroundImage
              ? {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  zIndex: 1,
                }
              : {},
          }}
        >
          <Grid
            container
            spacing={3}
            alignItems="center"
            justifyContent="space-between"
            sx={{ position: 'relative', zIndex: 2 }}
          >
            {/* Text content */}
            <Grid item xs={12} md={7}>
              <Box>
                <Typography
                  variant="overline"
                  component="p"
                  sx={{
                    color: backgroundImage ? 'grey.300' : 'primary.main',
                    fontWeight: 'bold',
                    mb: 0.5,
                  }}
                >
                  {subtitle}
                </Typography>

                <Typography
                  variant="h4"
                  component="h2"
                  fontWeight="bold"
                  sx={{
                    mb: 1.5,
                    color: backgroundImage ? 'white' : 'text.primary',
                    fontSize: compact
                      ? { xs: '1.5rem', md: '2rem' }
                      : { xs: '1.75rem', md: '2.5rem' },
                  }}
                >
                  {title}
                </Typography>

                <Typography
                  variant="body1"
                  sx={{
                    mb: 3,
                    color: backgroundImage ? 'grey.100' : 'text.secondary',
                    maxWidth: '600px',
                    lineHeight: 1.6,
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
              md={5}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: { xs: 'stretch', md: 'flex-end' },
                gap: 2,
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
                  px: 3,
                  py: compact ? 1 : 1.5,
                  minWidth: { md: '200px' },
                  fontWeight: 'bold',
                  fontSize: compact ? 'inherit' : '1.1rem',
                  borderRadius: '8px',
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
                    px: 3,
                    py: compact ? 1 : 1.5,
                    minWidth: { md: '200px' },
                    fontWeight: 'medium',
                    borderRadius: '8px',
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
