import React from 'react'
import { Typography, Box } from '@mui/material'

interface Props {
	name: string
	stars: number
	text: string
}

const Card: React.FC<Props> = (props) => {
  const { name, stars, text } = props
	let starsArray = []
	for (let index = 0; index < stars; index++) {
		starsArray.push(index)
	}

  return (
    <Box key={name}>
			<Box sx={{
				display: 'flex',
				mb: 1
			}}>
				{starsArray.map((item) => (
					<Typography key={item} sx={{ mr: 1 / 2 }} variant='h5'>⭐️</Typography>	
				))}
			</Box>
			<Typography color='text.secondary'>{text}</Typography>
			<Typography variant='h6' sx={{ mt: 1 }}>{name}</Typography>
    </Box>
  )
}

export default Card