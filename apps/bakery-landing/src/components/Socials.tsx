import React from 'react'
import { Box } from '@mui/material'

import { FacebookIcon, InstagramIcon, WhatsappIcon } from './icons'

const SOCIALS = [
	{
		link: 'https://www.facebook.com/profile.php?id=100068876322773',
		icon: <FacebookIcon />
	},
	{
		link: 'https://www.instagram.com/backereiheusser',
		icon: <InstagramIcon />
	},
	{
		link: 'https://wa.me/015226621236',
		icon: <WhatsappIcon />
	},
]

const Socials: React.FC = () => {
  return (
    <Box sx={styles.root}>
			{SOCIALS.map((item) => (
				<a key={item.link} href={item.link} target="_blank" rel="noreferrer">
					{item.icon}
				</a>
			))}
    </Box>
  )
}

const styles = {
	root: {
		mb: 2,

		'& a': {
			color: 'text.secondary',
			
			'&:hover': {
				color :'primary.main'
			}
		},

		'& svg': {
			minHeight: 24,
			mr: 2
		}
	}
}

export default Socials