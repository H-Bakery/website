import React from 'react'
import { Box, Typography } from '@mui/material'
import { MENU } from './footer-data'
import { FooterLink } from './footer-link'

export const FooterMenu: React.FC = () => {
  return (
    <Box sx={styles.root}>
      <Typography variant="h6" fontSize={16} gutterBottom>
        Menu
      </Typography>
      {MENU.map((item) => (
        <FooterLink key={item.label} {...item} />
      ))}
    </Box>
  )
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
}