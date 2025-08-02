import React from 'react'
import Link from 'next/link'
import { Box, Typography } from '@mui/material'
import { usePathname } from 'next/navigation'

interface Props {
  label: string
  path: string
  cta?: boolean
  external?: boolean
}

const Item: React.FC<Props> = (props) => {
  const { label, path, cta = false, external = false } = props
  const pathname = usePathname()

  const isActive = !external && pathname === path

  if (external) {
    return (
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'none' }}
      >
        <Box sx={styles} className={`menu-item ${cta && 'cta'}`}>
          <Typography variant="button">{label}</Typography>
        </Box>
      </a>
    )
  }

  return (
    <Link style={{ textDecoration: 'none' }} href={path}>
      <Box
        sx={styles}
        className={`menu-item ${cta && 'cta'} ${isActive && 'active'}`}
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
  transition: 'all ease-in-out 200ms',

  '&:hover': {
    bgcolor: 'grey.300',
  },

  '&.active': {
    bgcolor: 'primary.main',
    color: 'common.white',
  },

  '&.cta': {
    color: 'common.white',
    bgcolor: 'primary.main',

    '&:hover': {
      bgcolor: 'primary.dark',
    },
  },
}

export default Item
