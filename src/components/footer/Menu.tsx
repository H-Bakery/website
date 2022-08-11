import React from 'react'
import { useRouter } from 'next/router'
import { Box, Typography } from '@mui/material'

import { MENU } from './data'
import Link from './Link'

const Menu: React.FC = () => {
	const router = useRouter()

  return (
    <Box sx={styles.root}>
			<Typography variant='h6' fontSize={16} gutterBottom>
				Menu
			</Typography>
			{MENU.map((item) => (
        <Link key={item.label} {...item} />
      ))}
    </Box>
  )
}

const styles = {
	root: {
    display: 'flex',
    flexDirection: 'column',
  },
}

export default Menu