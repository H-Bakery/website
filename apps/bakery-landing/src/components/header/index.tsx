'use client'
import React from 'react'
import { Box } from '@mui/material'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HeusserLogo } from '../icons'
import Hamburger from './Hamburger'
import Item from './Item'
import Modal from './Modal'
import MobileItem from './MobileItem'

interface MenuItem {
  label: string
  path: string
  cta?: boolean
}

const items: MenuItem[] = [
  { label: 'Sortiment', path: '/products' },
  { label: 'Neuigkeiten', path: '/news' },
  { label: 'Über uns', path: '/about' },
]

const ctaItems: MenuItem[] = [
  { label: 'Bestellen', path: '/bestellen', cta: true },
]

const Header = () => {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()

  // Close mobile nav when route changes
  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <Box
      sx={{
        position: 'relative',
      }}
    >
      <Box sx={styles.header}>
        <Link href="/">
          <Box sx={styles.logo}>
            <HeusserLogo color="#5A2E2A" />
          </Box>
        </Link>
        {/* Desktop navigation */}
        <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
          <Box sx={styles.menu}>
            {items.map((item) => (
              <Item key={item.label} {...item} />
            ))}
          </Box>
          <Box sx={styles.ctas}>
            {ctaItems.map((item) => (
              <Item key={item.label} {...item} />
            ))}
          </Box>
        </Box>
        {/* Mobile hamburger */}
        <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
          <Hamburger setOpen={setOpen} open={open} />
        </Box>
      </Box>
      <Modal setOpen={setOpen} open={open}>
        <Box sx={{ ...styles.mobileMenu, display: { xs: 'flex', md: 'none' } }}>
          {items.map((item) => (
            <MobileItem key={item.label} {...item} />
          ))}
          {ctaItems.map((item) => (
            <MobileItem key={item.label} {...item} />
          ))}
        </Box>
      </Modal>
    </Box>
  )
}

const styles = {
  header: {
    position: 'fixed' as const,
    zIndex: 10001,
    top: { xs: 8, sm: 16 },
    left: { xs: 8, sm: 16 },
    height: { xs: 56, sm: 70 },
    width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 32px)' },
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    bgcolor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 12px rgba(90, 46, 42, 0.08)',
    borderRadius: '8px',
    p: { xs: 1, sm: 2 },
  },
  logo: {
    cursor: 'pointer',
    '& svg': {
      maxHeight: 40,
      width: 'auto',
    },
  },
  menu: {
    display: 'flex',
    position: 'absolute' as const,
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',

    '& .menu-item': {
      mx: 1,
      fontFamily: '"Merriweather", serif',
      fontSize: '0.95rem',
    },
  },
  mobileMenu: {
    display: 'flex',
    flexDirection: 'column' as const,

    '& .menu-item': {
      mb: 2,
    },
  },
  ctas: {
    display: 'flex',
    '& .menu-item': {
      ml: 1,
    },
  },
}

export { Header }
