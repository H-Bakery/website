import React from 'react'
import { Box } from '@mui/material'

import Facebook from './icons/socials/Facebook'
import Instagram from './icons/socials/Instagram'
import Whatsapp from './icons/socials/Whatsapp'

const SOCIALS = [
	{
		link: 'https://www.facebook.com/profile.php?id=100068876322773',
		icon: <Facebook />
	},
	{
		link: 'https://www.instagram.com/backereiheusser',
		icon: <Instagram />
	},
	{
		link: 'https://wa.me/015226621236',
		icon: <Whatsapp />
	},
]

const Socials: React.FC = () => {
  return (
    <Box sx={styles.root}>
			{SOCIALS.map((item) => (
				<a key={item.link} href={item.link} target="_blank" >
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