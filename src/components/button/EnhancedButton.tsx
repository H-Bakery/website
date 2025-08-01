'use client'
import { Button as MuiButton, ButtonProps } from '@mui/material'
import React from 'react'
import { keyframes } from '@mui/system'

// Animation keyframes
const shimmer = keyframes`
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
`

const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(208, 56, 186, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(208, 56, 186, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(208, 56, 186, 0);
  }
`

// Extend ButtonProps with the anchor-specific props
interface EnhancedButtonProps extends ButtonProps {
  target?: string
  rel?: string
  pulse?: boolean
  shimmer?: boolean
}

const EnhancedButton: React.FC<EnhancedButtonProps> = ({ 
  children, 
  sx,
  variant = 'contained',
  pulse: enablePulse = false,
  shimmer: enableShimmer = true,
  ...props 
}) => {
  const isContained = variant === 'contained'
  const isOutlined = variant === 'outlined'
  
  return (
    <MuiButton 
      variant={variant}
      sx={{
        borderRadius: '30px',
        textTransform: 'none',
        fontWeight: 600,
        letterSpacing: '0.5px',
        px: 3,
        py: 1.2,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontSize: '1rem',
        
        // Contained variant styles
        ...(isContained && {
          background: 'primary.main',
          color: 'white',
          boxShadow: '0 4px 15px rgba(208, 56, 186, 0.25)',
          '&:hover': {
            background: 'primary.dark',
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 20px rgba(208, 56, 186, 0.35)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
          ...(enablePulse && {
            animation: `${pulse} 2s infinite`,
          }),
          // Shimmer effect on hover
          ...(enableShimmer && {
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
              transition: 'left 0.5s',
            },
            '&:hover::before': {
              left: '100%',
            },
          }),
        }),
        
        // Outlined variant styles
        ...(isOutlined && {
          borderWidth: 2,
          borderColor: 'primary.main',
          color: 'primary.main',
          '&:hover': {
            borderWidth: 2,
            borderColor: 'primary.dark',
            backgroundColor: 'rgba(208, 56, 186, 0.08)',
            transform: 'translateY(-2px)',
            color: 'primary.dark',
          },
        }),
        
        // Text variant styles
        ...(variant === 'text' && {
          color: 'primary.main',
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: '50%',
            width: 0,
            height: 2,
            backgroundColor: 'primary.main',
            transition: 'all 0.3s',
            transform: 'translateX(-50%)',
          },
          '&:hover': {
            backgroundColor: 'transparent',
            color: 'primary.dark',
            '&::after': {
              width: '80%',
            },
          },
        }),
        
        // Success variant styles
        ...(props.color === 'success' && {
          backgroundColor: 'success.main',
          color: 'white',
          '&:hover': {
            backgroundColor: 'success.dark',
          },
        }),
        
        // Disabled state
        '&.Mui-disabled': {
          opacity: 0.6,
          cursor: 'not-allowed',
        },
        
        // Icon adjustments
        '& .MuiButton-startIcon': {
          marginRight: 1,
        },
        '& .MuiButton-endIcon': {
          marginLeft: 1,
        },
        
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiButton>
  )
}

export default EnhancedButton