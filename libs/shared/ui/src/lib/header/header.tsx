'use client'

import React from 'react'
import { Box, useMediaQuery, useTheme } from '@mui/material'
import Link from 'next/link'
import HeusserLogo from '../icons/brand/heusser-logo'
import WappenIcon from '../icons/brand/wappen-icon'
import { HamburgerMenu } from './hamburger-menu'
import { HeaderItem } from './header-item'
import { MobileHeaderModal } from './mobile-header-modal'
import { MobileHeaderItem } from './mobile-header-item'

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

export const Header = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [open, setOpen] = React.useState(false)

  return (
    <Box
      sx={{
        position: 'relative',
      }}
    >
      <Box sx={styles.header}>
        <Link href="/">
          <Box sx={styles.logo}>
            <Box sx={styles.logoContainer}>
              {/* Pass the CI color to the Heusser logo component */}
              <HeusserLogo color={theme.palette.primary.main} />
              {/* Add the Wappen below the Heusser logo */}
              <Box sx={styles.wappen}>
                <WappenIcon />
              </Box>
            </Box>
          </Box>
        </Link>
        {!isMobile && (
          <Box
            sx={{
              display: 'flex',
            }}
          >
            <Box sx={styles.menu}>
              {items.map((item) => (
                <HeaderItem key={item.label} {...item} />
              ))}
            </Box>
            <Box sx={styles.ctas}>
              {ctaItems.map((item) => (
                <HeaderItem key={item.label} {...item} />
              ))}
            </Box>
          </Box>
        )}
        {isMobile && <HamburgerMenu setOpen={setOpen} open={open} />}
      </Box>
      {isMobile && (
        <MobileHeaderModal setOpen={setOpen} open={open}>
          <Box sx={styles.mobileMenu}>
            {items.map((item) => (
              <MobileHeaderItem key={item.label} {...item} />
            ))}
            {ctaItems.map((item) => (
              <MobileHeaderItem key={item.label} {...item} />
            ))}
          </Box>
        </MobileHeaderModal>
      )}
    </Box>
  )
}

const styles = {
  header: {
    position: 'fixed',
    zIndex: 10001,
    top: 16,
    left: 16,
    height: 'auto',
    minHeight: 70,
    width: 'calc(100% - 32px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    bgcolor: 'background.paper',
    boxShadow: 1,
    borderRadius: '8px',
    p: 2,
  },
  logo: {
    cursor: 'pointer',
  },
  logoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0.5,
  },
  wappen: {
    width: 30,
    height: 30,
    '& svg': {
      width: '100%',
      height: '100%',
    },
  },
  menu: {
    display: 'flex',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',

    '& .menu-item': {
      mx: 1,
    },
  },
  mobileMenu: {
    display: 'flex',
    flexDirection: 'column',

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