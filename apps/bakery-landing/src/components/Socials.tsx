import React from 'react'
import { Box } from '@mui/material'

import FacebookIcon from '@mui/icons-material/Facebook'
import InstagramIcon from '@mui/icons-material/Instagram'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'

const SOCIALS = [
  {
    label: 'Facebook',
    link: 'https://www.facebook.com/profile.php?id=100068876322773',
    icon: <FacebookIcon />,
  },
  {
    label: 'Instagram',
    link: 'https://www.instagram.com/backereiheusser',
    icon: <InstagramIcon />,
  },
  {
    label: 'WhatsApp',
    link: 'https://wa.me/491706133279',
    icon: <WhatsAppIcon />,
  },
]

const Socials: React.FC = () => {
  return (
    <Box sx={styles.root}>
      {SOCIALS.map((item) => (
        <a
          key={item.link}
          href={item.link}
          aria-label={item.label}
          title={item.label}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.icon}
        </a>
      ))}
    </Box>
  )
}

const styles = {
  root: {
    mb: 2,
    display: 'flex',
    alignItems: 'center',

    '& a': {
      color: 'text.secondary',

      '&:hover': {
        color: 'primary.main',
      },
    },

    '& svg': {
      minHeight: 24,
      mr: 2,
      display: 'block',
    },
  },
}

export default Socials
