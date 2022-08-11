import React from 'react'
import { Box } from '@mui/material'

interface Props {
  open: boolean
  setOpen: (status: boolean) => void
}

const Hamburger: React.FC<Props> = (props) => {
  const { open, setOpen } = props

  return (
    <Box
      onClick={() => setOpen(!open)} 
      className={open ? 'open' : ''}
      sx={{
        width: 36,
        height: 28,
        position: 'relative',
        transform: 'rotate(0deg)',
        transition: '320ms ease-in-out',
        cursor: 'pointer',
        
        '& span': {
          display: 'block',
          position: 'absolute',
          height: 4,
          width: '100%',
          bgcolor: 'text.primary',
          borderRadius: '8px',
          opacity: 1,
          right: 0,
          transform: 'rotate(0deg)',
          transition: '320ms ease-in-out',

          '&:nth-child(1)': {
            top: 0,
            width: '100%'
          },
          
          '&:nth-child(2), &:nth-child(3)': {
            top: 12,
            width: '80%'
          },

          '&:nth-child(4)': {
            top: 24,
            width: '66%'
          },
        },
        '&.open': {
          '& span': {
            '&:nth-child(1)': {
              top: 18,
              width: '0%',
              right: '40%'
            },
            
            '&:nth-child(2)': {
              transform: 'rotate(45deg)',
              width: '100%',
              right: '-5%'
            },
            
            '&:nth-child(3)': {
              transform: 'rotate(-45deg)',
              width: '100%',
              right: '-5%'
            },
    
            '&:nth-child(4)': {
              top: 18,
              width: '0%',
              right: '40%'
            },
          }
        }
      }}>
      <span></span>
      <span></span>
      <span></span>
      <span></span>
    </Box>
  )
}

export default Hamburger