import React from 'react'
import { IconButton, useTheme } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'

interface Props {
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  open: boolean
}

export const HamburgerMenu: React.FC<Props> = ({ setOpen, open }) => {
  const theme = useTheme()
  
  return (
    <IconButton
      sx={{
        bgcolor: 'grey.100',
        '&:hover': {
          bgcolor: 'grey.200',
        },
      }}
      onClick={() => setOpen(!open)}
    >
      {open ? (
        <CloseIcon sx={{ color: theme.palette.primary.main }} />
      ) : (
        <MenuIcon sx={{ color: theme.palette.primary.main }} />
      )}
    </IconButton>
  )
}