'use client'
import {
  Button as MuiButton,
  ButtonProps as MuiButtonProps,
  CircularProgress,
} from '@mui/material'
import React from 'react'

/**
 * Custom button props extending Material UI ButtonProps
 * @interface ButtonProps
 */
export interface ButtonProps extends MuiButtonProps {
  /** Target attribute for anchor elements */
  target?: string
  /** Rel attribute for anchor elements */
  rel?: string
  /** Zeigt einen Spinner und sperrt den Button, solange eine Aktion läuft */
  loading?: boolean
}

/**
 * Basic button component wrapping Material UI Button
 * @component
 * @example
 * ```tsx
 * <Button variant="contained" color="primary">
 *   Click me
 * </Button>
 * ```
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'contained',
  loading = false,
  disabled = false,
  startIcon,
  ...props
}) => {
  return (
    <MuiButton
      variant={variant}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      startIcon={
        loading ? <CircularProgress size={16} color="inherit" /> : startIcon
      }
      {...props}
    >
      {children}
    </MuiButton>
  )
}

export default Button
