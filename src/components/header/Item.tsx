import React from 'react'
import Link from 'next/link'
import { Box, Typography } from '@mui/material'

interface Props {
  label: string
  path: string
  cta?: boolean
}

const Item: React.FC<Props> = (props) => {
  const { label, path, cta = false } = props

  return (
    <Link href={path}>
      <Box sx={styles} className={`menu-item ${cta && 'cta'}`}>
        <Typography variant='button'>
          {label}
        </Typography>
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
    bgcolor: 'grey.300'
  },
  
  '&.cta': {
    color: 'common.white',
    bgcolor: 'primary.main',

    '&:hover': {
      bgcolor: 'primary.dark'
    }
  },
}

export default Item