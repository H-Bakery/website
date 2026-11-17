import React from 'react'
import Link from 'next/link'
import { Box } from '@mui/material'
import { usePathname } from 'next/navigation'

interface Props {
  label: string
  path: string
  cta?: boolean
}

const MobileItem: React.FC<Props> = (props) => {
  const { label, path, cta = false } = props
  const pathname = usePathname()
  const isActive = pathname === path

  return (
    <Box
      component={Link}
      href={path}
      aria-current={isActive ? 'page' : undefined}
      className={['menu-item', cta && 'cta', isActive && 'active']
        .filter(Boolean)
        .join(' ')}
      sx={styles}
    >
      {label}
    </Box>
  )
}

const styles = {
  typography: 'button',
  fontSize: { xs: '1.1rem', sm: '1.3rem' },
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  minHeight: 44,
  cursor: 'pointer',
  transition: 'all ease-in-out 200ms',

  '&.active': {
    color: 'primary.main',
    textDecoration: 'underline',
    textUnderlineOffset: '6px',
  },

  // Bestellen hebt sich wie in der Desktop-Leiste als Knopf ab.
  '&.cta': {
    alignSelf: 'flex-end',
    mt: 1,
    px: 3,
    borderRadius: '8px',
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    boxShadow: 1,
    textDecoration: 'none',

    '&:hover': {
      bgcolor: 'primary.dark',
    },
  },
}

export default MobileItem
