import React from 'react'
import { Button as MuiButton, ButtonProps } from '@mui/material'

const Button: React.FC<ButtonProps> = (props) => {
  const { sx, children } = props

  return (
    <MuiButton {...props} variant='contained' sx={{
      ...sx,
      textTransform: 'none',
    }}>
      {children}
    </MuiButton>
  )
}

export default Button
