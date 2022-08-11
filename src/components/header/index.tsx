import React from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import Link from "next/link";
import Heusser from "../icons/brand/Heusser";
import Hamburger from "./Hamburger";
import Item from "./Item";
import Modal from "./Modal";
import MobileItem from "./MobileItem";

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
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [open, setOpen] = React.useState(false)

  return (
    <Box sx={{
      position: 'relative'
    }}>
      <Box sx={styles.header}>
        <Link href='/'>
          <Box sx={styles.logo}>
            <Heusser />
          </Box>
        </Link>
        {!isMobile && (
          <Box sx={{
            display: 'flex',
          }}>
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
        )}
        {isMobile && <Hamburger setOpen={setOpen} open={open} />}
      </Box>
      {isMobile && (
        <Modal setOpen={setOpen} open={open}>
          <Box sx={styles.mobileMenu}>
            {items.map((item) => (
              <MobileItem key={item.label} {...item} />
            ))}
            {ctaItems.map((item) => (
              <MobileItem key={item.label} {...item} />
            ))}
          </Box>
        </Modal>
      )}
    </Box>
  )
};

const styles = {
  header: {
    position: 'fixed',
    zIndex: 10001,
    top: 16,
    left: 16,
    height: 70,
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
    '& svg': {
      maxHeight: 40,
      width: 'auto'
    }
  },
  menu: {
    display: 'flex',
    position: 'absolute',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    
    '& .menu-item': {
      mx: 1
    }
  },
  mobileMenu: {
    display: 'flex',
    flexDirection: 'column',
    
    '& .menu-item': {
      mb: 2
    }
  },
  ctas: {
    display: 'flex',
    '& .menu-item': {
      ml: 1
    }
  }
}

export { Header };
