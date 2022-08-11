import React from 'react'
import { TextFieldProps, TextField } from '@mui/material'

const Input: React.FC<TextFieldProps> = (props) => {
  return (
    <TextField 
      {...props}
      variant='filled'
      sx={{
        mb: 2,
        boxShadow: 1,
        overflow: 'hidden',
        borderRadius: '8px',
        
        '& .MuiFilledInput-root': {
          bgcolor: 'white',
        },

        '& svg': {
          mr: '6px',
          mt: '14px',
        },

        '& .MuiInputBase-multiline': {
          alignItems: 'flex-start',

          '& svg': {
            mt: '2px'
          },
        }
      }} 
    />
  )
}

export default Input