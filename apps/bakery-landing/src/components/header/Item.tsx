import React from 'react'
import Link from 'next/link'
import { Box, Typography } from '@mui/material'
import { usePathname } from 'next/navigation'

interface Props {
  label: string
  path: string
  cta?: boolean
}

const Item: React.FC<Props> = (props) => {
  const { label, path, cta = false } = props
  const pathname = usePathname()

  const isActive = pathname === path

  return (
    <Link
      style={{ textDecoration: 'none' }}
      href={path}
      aria-current={isActive ? 'page' : undefined}
    >
      <Box
        sx={styles}
        className={['menu-item', cta && 'cta', isActive && 'active']
          .filter(Boolean)
          .join(' ')}
      >
        <Typography variant="button">{label}</Typography>
      </Box>
    </Link>
  )
}

const styles = {
  bgcolor: 'grey.200',
  px: '12px',
  py: '8px',
  borderRadius: '8px',
  fontSize: '16px',
  boxShadow: 1,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all ease-in-out 200ms',

  '&:hover': {
    bgcolor: 'grey.300',
  },

  '&.active': {
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
  },

  '&.cta': {
    color: 'primary.contrastText',
    bgcolor: 'primary.main',

    '&:hover': {
      bgcolor: 'primary.dark',
    },
  },
}

export default Item
