'use client'
import React from 'react'
import { Box } from '@mui/material'
import PhoneIcon from '@mui/icons-material/Phone'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HeusserLogo } from '../icons'
import { LEGAL } from '../../config/legal'
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
  { label: 'Kontakt', path: '/contact' },
]

const ctaItems: MenuItem[] = [
  { label: 'Bestellen', path: '/bestellen', cta: true },
]

/**
 * Platz, den der fixierte Header im Seitenfluss belegt: Abstand oben + Leiste +
 * Abstand unten (siehe `styles.header`). Der Wrapper in `Header` reserviert ihn,
 * damit Seiteninhalt - etwa die Breadcrumbs - nicht unter der Leiste beginnt.
 * Der vollflächige Hero der Startseite zieht sich per negativem Rand wieder
 * darunter (`EnhancedHero`).
 */
export const HEADER_SPACE = { xs: 72, sm: 102 }

const Header = () => {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()

  // Close mobile nav when route changes
  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <Box
      component="header"
      sx={{
        position: 'relative',
        height: HEADER_SPACE,
      }}
    >
      <Box sx={styles.header}>
        <Box sx={styles.logoSlot}>
          <Link href="/" aria-label="Bäckerei Heusser – Startseite">
            <Box sx={styles.logo}>
              <HeusserLogo color="#5A2E2A" />
            </Box>
          </Link>
        </Box>
        {/* Desktop navigation */}
        <Box
          component="nav"
          aria-label="Hauptnavigation"
          sx={styles.desktopNav}
        >
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
        <Box
          component="nav"
          aria-label="Hauptnavigation"
          sx={styles.mobileMenu}
        >
          {items.map((item) => (
            <MobileItem key={item.label} {...item} />
          ))}
          {ctaItems.map((item) => (
            <MobileItem key={item.label} {...item} />
          ))}
        </Box>
        <Box component="a" href={LEGAL.phoneHref} sx={styles.mobilePhone}>
          <PhoneIcon fontSize="small" aria-hidden="true" />
          Anrufen: {LEGAL.phone}
        </Box>
      </Modal>
    </Box>
  )
}

/**
 * Breite, die Logo und Bestellen-Knopf in der Desktop-Leiste mindestens
 * belegen. Beide Seiten sind gleich breit, damit das Menü dazwischen genau in
 * der Mitte der Leiste steht - und es kann sie nicht überdecken, weil es im
 * normalen Fluss liegt statt absolut darüber.
 */
const SIDE_SLOT = 140

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
  logoSlot: {
    display: 'flex',
    flexShrink: 0,
    minWidth: { md: SIDE_SLOT },
  },
  logo: {
    cursor: 'pointer',
    '& svg': {
      display: 'block',
      maxHeight: 40,
      width: 'auto',
    },
  },
  desktopNav: {
    display: { xs: 'none', md: 'flex' },
    flex: 1,
    alignItems: 'center',
  },
  menu: {
    display: 'flex',
    flex: 1,
    justifyContent: 'center',
    px: 1,

    '& .menu-item': {
      mx: { md: 0.5, lg: 1 },
      fontFamily: '"Merriweather", serif',
      fontSize: '0.95rem',
    },
  },
  mobileMenu: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 1,
  },
  mobilePhone: {
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 1,
    minHeight: 44,
    mt: 2,
    color: 'text.primary',
    textDecoration: 'underline',
    textUnderlineOffset: '4px',
  },
  ctas: {
    display: 'flex',
    flexShrink: 0,
    justifyContent: 'flex-end',
    minWidth: SIDE_SLOT,
  },
}

export { Header }
