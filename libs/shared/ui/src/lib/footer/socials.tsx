import React from 'react'
import { Box } from '@mui/material'
import FacebookIcon from '../icons/socials/facebook-icon'
import InstagramIcon from '../icons/socials/instagram-icon'
import WhatsappIcon from '../icons/socials/whatsapp-icon'

const SOCIALS = [
  {
    link: 'https://www.facebook.com/profile.php?id=100068876322773',
    icon: <FacebookIcon />,
  },
  {
    link: 'https://www.instagram.com/backereiheusser',
    icon: <InstagramIcon />,
  },
  {
    link: 'https://wa.me/491706133279',
    icon: <WhatsappIcon />,
  },
]

export const Socials: React.FC = () => {
  return (
    <Box sx={styles.root}>
      {SOCIALS.map((item) => (
        <a key={item.link} href={item.link} target="_blank" rel="noreferrer">
          {item.icon}
        </a>
      ))}
    </Box>
  )
}

const styles = {
  root: {
    mb: 2,

    '& a': {
      color: 'text.secondary',

      '&:hover': {
        color: 'primary.main',
      },
    },

    '& svg': {
      minHeight: 24,
      mr: 2,
    },
  },
}
