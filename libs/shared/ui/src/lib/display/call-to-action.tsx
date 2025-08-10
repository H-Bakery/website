'use client'
import React from 'react'
import {
  Box,
  Typography,
  Container,
  Paper,
  Grid,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { useRouter } from 'next/navigation'
import { EnhancedButton } from '../button/enhanced-button'

/**
 * Call-to-action button configuration
 * @interface CTAAction
 */
export interface CTAAction {
  /** Button text label */
  label: string
  /** Optional icon component */
  icon?: React.ReactNode
  /** Navigation destination */
  href: string
  /** Button variant style */
  variant?: 'text' | 'outlined' | 'contained'
  /** Button color theme */
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning'
  /** Whether the link is external */
  external?: boolean
}

/**
 * Call-to-action component props
 * @interface CallToActionProps
 */
export interface CallToActionProps {
  /** Main headline text */
  title: string
  /** Supporting subtitle text */
  subtitle: string
  /** Descriptive text body */
  description: string
  /** Primary action button configuration */
  primaryAction: CTAAction
  /** Optional secondary action button */
  secondaryAction?: CTAAction
  /** Background image URL */
  backgroundImage?: string
  /** Visual position context */
  position?: 'top' | 'bottom'
  /** Compact layout mode */
  compact?: boolean
  /** Custom styling overrides */
  sx?: React.ComponentProps<typeof Box>['sx']
}

/**
 * Call-to-action section component
 *
 * Features:
 * - Responsive design with mobile optimization
 * - Background image support with overlay
 * - Decorative background elements
 * - Flexible action button configuration
 * - External and internal link handling
 *
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * <CallToAction
 *   title="Visit Our Bakery"
 *   subtitle="Fresh Daily"
 *   description="Experience the finest artisan bread and pastries made with traditional methods."
 *   primaryAction={{
 *     label: "Get Directions",
 *     href: "/contact",
 *     icon: <DirectionsIcon />
 *   }}
 * />
 *
 * // With background image and secondary action
 * <CallToAction
 *   title="Order Online"
 *   subtitle="Convenient Pickup"
 *   description="Skip the line and pre-order your favorites for pickup."
 *   backgroundImage="/images/bakery-hero.jpg"
 *   primaryAction={{
 *     label: "Start Order",
 *     href: "/products",
 *     variant: "contained"
 *   }}
 *   secondaryAction={{
 *     label: "View Menu",
 *     href: "/menu",
 *     variant: "outlined"
 *   }}
 *   compact={true}
 * />
 * ```
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
        bgcolor: position === 'top' ? 'background.default' : 'background.paper',
        ...sx,
      }}
    >
      {/* Background decorative elements */}
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
                    fontSize: { xs: '1rem', md: '1.1rem' },
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
              <EnhancedButton
                variant={primaryAction.variant || 'contained'}
                color={primaryAction.color || 'primary'}
                size={compact ? 'medium' : 'large'}
                startIcon={primaryAction.icon}
                onClick={() => handleActionClick(primaryAction)}
                fullWidth={isMobile}
                pulse={position === 'top'}
                sx={{
                  px: 3,
                  py: compact ? 1 : 1.5,
                  minWidth: { md: '200px' },
                  fontWeight: 'bold',
                  fontSize: compact ? 'inherit' : '1.1rem',
                }}
              >
                {primaryAction.label}
              </EnhancedButton>

              {secondaryAction && (
                <EnhancedButton
                  variant={secondaryAction.variant || 'outlined'}
                  color={secondaryAction.color || 'primary'}
                  size={compact ? 'medium' : 'large'}
                  startIcon={secondaryAction.icon}
                  onClick={() => handleActionClick(secondaryAction)}
                  fullWidth={isMobile}
                  shimmer={false}
                  sx={{
                    px: 3,
                    py: compact ? 1 : 1.5,
                    minWidth: { md: '200px' },
                    fontWeight: 'medium',
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
                </EnhancedButton>
              )}
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  )
}

export default CallToAction
