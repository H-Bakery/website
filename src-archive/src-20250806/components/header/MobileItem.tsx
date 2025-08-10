import React from 'react'
import Link from 'next/link'
import { Box, Typography } from '@mui/material'
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
    <Link href={path}>
      <Box
        sx={styles}
        className={`menu-item ${isActive && 'active'} ${cta && 'cta'}`}
      >
        <Typography variant="button" fontSize="8vw">
          {label}
        </Typography>
      </Box>
    </Link>
  )
}

const styles = {
  cursor: 'pointer',
  transition: 'all ease-in-out 200ms',
  textAlign: 'right',
  mb: '20px !important',

  '&.active': {
    color: 'primary.main',
  },
}

export default MobileItem
