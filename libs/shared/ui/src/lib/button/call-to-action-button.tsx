'use client'
import React from 'react'
import { EnhancedButton, EnhancedButtonProps } from './enhanced-button'
import { Box } from '@mui/material'
import { keyframes } from '@mui/system'

// Animation for attention-grabbing effect
const attentionPulse = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
`

const iconBounce = keyframes`
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-3px);
  }
  75% {
    transform: translateX(3px);
  }
`

/**
 * Call-to-action button props extending EnhancedButtonProps
 * @interface CallToActionButtonProps
 */
export interface CallToActionButtonProps extends EnhancedButtonProps {
  /** Enable attention-grabbing animation */
  attention?: boolean
  /** Show arrow icon after text */
  showArrow?: boolean
  /** Custom arrow icon */
  arrowIcon?: React.ReactNode
  /** Enable icon animation on hover */
  iconAnimation?: boolean
}

/**
 * Call-to-action button component optimized for conversions
 * @component
 * @example
 * ```tsx
 * <CallToActionButton
 *   attention
 *   showArrow
 *   onClick={handleClick}
 * >
 *   Jetzt bestellen
 * </CallToActionButton>
 * ```
 */
export const CallToActionButton: React.FC<CallToActionButtonProps> = ({
  children,
  attention = false,
  showArrow = true,
  arrowIcon,
  iconAnimation = true,
  sx,
  endIcon,
  ...props
}) => {
  // Default arrow icon
  const defaultArrowIcon = (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        ml: 0.5,
        transition: 'transform 0.3s ease',
        ...(iconAnimation && {
          '.MuiButton-root:hover &': {
            animation: `${iconBounce} 0.6s ease infinite`,
          },
        }),
      }}
    >
      →
    </Box>
  )

  return (
    <EnhancedButton
      {...props}
      sx={{
        // Call-to-action specific styles
        fontWeight: 700,
        letterSpacing: '0.75px',
        textTransform: 'uppercase',
        px: 4,
        py: 1.5,

        // Attention animation
        ...(attention && {
          animation: `${attentionPulse} 2s ease-in-out infinite`,
          '&:hover': {
            animation: 'none',
            transform: 'translateY(-2px)',
          },
        }),

        // Enhanced shadow for CTA
        ...(props.variant === 'contained' && {
          boxShadow: '0 6px 20px rgba(208, 56, 186, 0.3)',
          '&:hover': {
            boxShadow: '0 8px 25px rgba(208, 56, 186, 0.4)',
          },
        }),

        // Success variant with green theme
        ...(props.color === 'success' && {
          backgroundColor: '#4caf50',
          color: 'white',
          boxShadow: '0 6px 20px rgba(76, 175, 80, 0.3)',
          '&:hover': {
            backgroundColor: '#388e3c',
            boxShadow: '0 8px 25px rgba(76, 175, 80, 0.4)',
          },
        }),

        // High contrast for accessibility
        ...(props.variant === 'outlined' && {
          borderWidth: 3,
          '&:hover': {
            borderWidth: 3,
          },
        }),

        // Custom icon styles
        '& .MuiButton-endIcon': {
          transition: 'transform 0.3s ease',
          ml: 1.5,
        },
        '&:hover .MuiButton-endIcon': {
          transform: 'translateX(4px)',
        },

        ...sx,
      }}
      endIcon={showArrow && !endIcon ? arrowIcon || defaultArrowIcon : endIcon}
      // Always enable pulse for primary CTA buttons
      pulse={props.variant === 'contained' ? true : props.pulse}
    >
      {children}
    </EnhancedButton>
  )
}

export default CallToActionButton
