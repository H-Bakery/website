import React from 'react'
import { Box, Modal } from '@mui/material'

interface Props {
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  open: boolean
  children?: React.ReactNode
}

export const MobileHeaderModal: React.FC<Props> = ({ setOpen, open, children }) => {
  return (
    <Modal open={open} onClose={() => setOpen(false)}>
      <Box sx={styles}>
        {children}
      </Box>
    </Modal>
  )
}

const styles = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  maxWidth: '90%',
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: '8px',
}