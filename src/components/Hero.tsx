import { Box, Container, Typography } from '@mui/material'
import React from 'react'
import Divider from './icons/brand/Divider'

interface Props {
	title: string
}

const Hero: React.FC<Props> = (props) => {
	const { title } = props

  return (
    <Box sx={{
			pt: '160px',
			pb: '80px'
		}}>
			<Container sx={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center'
			}}>
				<Typography variant='h3'>{title}</Typography>
				<Divider />
			</Container>
		</Box>
  )
}

export default Hero