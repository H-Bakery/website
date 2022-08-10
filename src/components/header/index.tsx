import { Box } from "@mui/material";
import Link from "next/link";
import Heusser from "../icons/brand/Heusser";
import Item from "./Item";

interface MenuItem {
  label: string
  path: string
  cta?: boolean
}

const items: MenuItem[] = [
  { label: 'Sortiment', path: '/sortiment' },
  { label: 'Neuigkeiten', path: '/news' },
  { label: 'Über uns', path: '/about' },
]

const ctaItems: MenuItem[] = [
  { label: 'Bestellen', path: '/bestellen', cta: true },
]

const Header = () => {
  return (
    <Box sx={styles.header}>
      <Link href='/' passHref={true}>
        <Box sx={styles.logo}>
          <Heusser />
        </Box>
      </Link>
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
  )
};

const styles = {
  header: {
    position: 'fixed',
    zIndex: 1000,
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
    cursor: 'pointer'
  },
  menu: {
    display: 'flex',
    
    '& .menu-item': {
      mx: 1
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
