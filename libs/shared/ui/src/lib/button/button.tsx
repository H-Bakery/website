'use client'
import {
  Button as MuiButton,
  ButtonProps as MuiButtonProps,
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
  ...props
}) => {
  return (
    <MuiButton variant={variant} {...props}>
      {children}
    </MuiButton>
  )
}

export default Button
