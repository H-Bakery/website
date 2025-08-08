'use client'
import { Button as MuiButton, ButtonProps } from '@mui/material'
import React from 'react'

// Extend ButtonProps with the anchor-specific props
interface CustomButtonProps extends ButtonProps {
  target?: string
  rel?: string
}

const Button: React.FC<CustomButtonProps> = ({ children, ...props }) => {
  return (
    <MuiButton variant="contained" {...props}>
      {children}
    </MuiButton>
  )
}

export default Button
