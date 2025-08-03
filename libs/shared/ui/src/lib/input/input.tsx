'use client'
import React from 'react'
import { TextFieldProps, TextField } from '@mui/material'

/**
 * Enhanced input props extending Material UI TextFieldProps
 * @type InputProps
 */
export type InputProps = TextFieldProps & {
  /** Custom icon to display in the input */
  icon?: React.ReactNode
}

/**
 * Styled input component based on Material UI TextField
 *
 * Features:
 * - Filled variant with white background
 * - Full width by default
 * - Built-in styling for icons
 * - Support for multiline text areas
 * - Rounded corners and subtle shadow
 *
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * <Input
 *   label="Email"
 *   type="email"
 *   placeholder="Enter your email"
 * />
 *
 * // With icon
 * <Input
 *   label="Password"
 *   type="password"
 *   icon={<LockIcon />}
 * />
 *
 * // Multiline
 * <Input
 *   label="Message"
 *   multiline
 *   rows={4}
 * />
 * ```
 */
export const Input: React.FC<InputProps> = ({
  icon,
  InputProps: inputPropsFromParent,
  sx,
  ...props
}) => {
  return (
    <TextField
      {...props}
      variant="filled"
      fullWidth
      InputProps={{
        startAdornment: icon,
        ...inputPropsFromParent,
      }}
      sx={{
        mb: 2,
        boxShadow: 1,
        overflow: 'hidden',
        borderRadius: '8px',

        '& .MuiFilledInput-root': {
          bgcolor: 'white',
          '&:hover': {
            bgcolor: 'white',
          },
          '&.Mui-focused': {
            bgcolor: 'white',
          },
        },

        '& svg': {
          mr: '6px',
          mt: '14px',
          color: 'text.secondary',
        },

        '& .MuiInputBase-multiline': {
          alignItems: 'flex-start',

          '& svg': {
            mt: '2px',
          },
        },

        // Enhanced focus states
        '& .MuiFilledInput-underline:after': {
          borderBottomColor: 'primary.main',
        },

        // Error states
        '&.Mui-error .MuiFilledInput-root': {
          bgcolor: 'error.lighter',
        },

        ...sx,
      }}
    />
  )
}

export default Input
