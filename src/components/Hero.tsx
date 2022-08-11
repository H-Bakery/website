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
			pt: { xs: '120px', md: '160px'},
			pb: 3
		}}>
			<Container sx={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',

        '& svg': {
          maxWidth: '80vw',
        }
			}}>
				<Typography variant='h3' textAlign='center' sx={{
          fontSize: { xs: '8vw', md: '3rem' }
        }}>
          {title}
        </Typography>
				<Divider />
			</Container>
		</Box>
  )
}

export default Hero