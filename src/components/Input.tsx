import React from 'react'
import { TextFieldProps, TextField } from '@mui/material'

const Input: React.FC<TextFieldProps> = (props) => {
  return (
    <TextField {...props} sx={{
      mb: 2,
      '& svg': {
        mr: '6px'
      },
      '& .MuiInputBase-multiline': {
        alignItems: 'flex-start',
        '& svg': {
          mt: '2px'
        },
      }
    }} />
  )
}

export default Input