import React from 'react'
import { Button, ButtonProps } from '@mui/material'

const EnhancedButton: React.FC<ButtonProps> = (props) => {
  return <Button variant="contained" {...props} />
}

export default EnhancedButton
