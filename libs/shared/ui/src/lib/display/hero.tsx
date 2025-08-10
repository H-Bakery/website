import { Box, Container, Typography } from '@mui/material'
import React from 'react'
import { DividerIcon } from '../icons'

/**
 * Hero section component props
 * @interface HeroProps
 */
export interface HeroProps {
  /** The main title text to display */
  title: string
  /** Optional subtitle text */
  subtitle?: string
  /** Custom spacing overrides */
  spacing?: {
    /** Top padding - overrides default responsive padding */
    top?: string | { xs?: string; md?: string }
    /** Bottom padding - overrides default padding */
    bottom?: string | { xs?: string; md?: string }
  }
  /** Whether to show the decorative divider */
  showDivider?: boolean
  /** Custom styling overrides */
  sx?: React.ComponentProps<typeof Box>['sx']
}

/**
 * Hero section component for page headers
 *
 * Features:
 * - Responsive design with mobile-first approach
 * - Centered layout with optional decorative divider
 * - Customizable spacing and typography
 * - Accessible heading structure
 *
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * <Hero title="Welcome to Our Bakery" />
 *
 * // With subtitle and custom spacing
 * <Hero
 *   title="Fresh Bread Daily"
 *   subtitle="Artisan baked goods since 1985"
 *   spacing={{
 *     top: { xs: '80px', md: '120px' },
 *     bottom: '2rem'
 *   }}
 * />
 *
 * // Without divider
 * <Hero
 *   title="Contact Us"
 *   showDivider={false}
 * />
 * ```
 */
export const Hero: React.FC<HeroProps> = ({
  title,
  subtitle,
  spacing,
  showDivider = true,
  sx,
}) => {
  const defaultTopPadding = { xs: '120px', md: '160px' }
  const defaultBottomPadding = 3

  return (
    <Box
      component="section"
      sx={{
        pt: spacing?.top || defaultTopPadding,
        pb: spacing?.bottom || defaultBottomPadding,
        ...sx,
      }}
    >
      <Container
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',

          '& svg': {
            maxWidth: '80vw',
          },
        }}
      >
        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontSize: { xs: '8vw', md: '3rem' },
            fontWeight: 'bold',
            mb: subtitle ? 1 : 2,
            color: 'text.primary',
          }}
        >
          {title}
        </Typography>

        {subtitle && (
          <Typography
            variant="h6"
            component="p"
            sx={{
              fontSize: { xs: '1rem', md: '1.25rem' },
              color: 'text.secondary',
              mb: 2,
              maxWidth: '600px',
              fontWeight: 400,
            }}
          >
            {subtitle}
          </Typography>
        )}

        {showDivider && <DividerIcon />}
      </Container>
    </Box>
  )
}

export default Hero
