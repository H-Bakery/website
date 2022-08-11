import React from 'react'
import { Box, BoxProps, Modal as MuiModal } from '@mui/material'

interface Props extends BoxProps {
  open: boolean
  setOpen: (status: boolean) => void
}

const Modal: React.FC<Props> = (props) => {
  const { open, setOpen, children } = props

  return (
    <MuiModal
      open={open}
      onClose={() => setOpen(false)}
      aria-labelledby='mobile-menu'
      aria-describedby='mobile-hamburger-menu'
      sx={{
        position: 'fixed',
        zIndex: '100000',
        bgcolor: 'rgba(255,255,255,0.66)',
        backdropFilter: 'blur(8px)',
        '& .MuiBackdrop-root': {
          bgcolor: 'transparent'
        }
      }}
    >
      <Box sx={{
        outline: 'none'
      }}>
        {children}
      </Box>
    </MuiModal>
  )
}

export default Modal