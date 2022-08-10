import React from 'react'
import { useRouter } from 'next/router'
import NextLink from 'next/link'
import { Box } from '@mui/material'

interface Props {
	path: string
	label: string	
}

const Link: React.FC<Props> = (props) => {
	const { path, label } = props
	const router = useRouter()

  return (
    <Box sx={styles.root} className={
        `link ${
          router.pathname === path ? 'active' : ''
        }`
      }>
        <NextLink href={path}>
          {label}
        </NextLink>
      </Box>
  )
}

const styles = {
 root: {
    mb: 1,

    '& a': {
      textDecoration: 'none',
      color: 'text.secondary',
      transition: 'all ease-in-out 120ms',
      fontSize: 14,
    },

    '&.active, &:hover': {
      '& a': {
        fontWeight: 'bold',
        color: 'primary.main',
      }
    },
  }
}

export default Link