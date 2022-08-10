import { Box, Typography } from '@mui/material'
import Link from 'next/link'
import React from 'react'
import Facebook from './icons/Facebook'
import Instagram from './icons/Instagram'
import Whatsapp from './icons/Whatsapp'

const SOCIALS = [
	{
		link: 'facebook.de',
		icon: <Facebook />
	},
	{
		link: 'instagram.de',
		icon: <Instagram />
	},
	{
		link: 'https://we.me/01522 66 2 12 36',
		icon: <Whatsapp />
	},
]

const Socials: React.FC = () => {
  return (
    <Box sx={styles.root}>
			{SOCIALS.map((item) => (
				<Link href={item.link}>
					{item.icon}
				</Link>
			))}
    </Box>
  )
}

const styles = {
	root: {
		mb: 2,

		'& svg': {
			minHeight: 24,
			mr: 2
		}
	}
}

export default Socials