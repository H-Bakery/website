import React from 'react'
import { Box } from '@mui/system'
import { Typography } from '@mui/material'

const Contact: React.FC = () => {
  return (
    <Box>
			<Box sx={{mb: 2}}>
				<Typography variant='h6' fontSize={16} gutterBottom>
					Adresse
				</Typography>
				<Typography variant='body2' color='text.secondary'>
					Eckstraße 3
				</Typography>
				<Typography variant='body2' color='text.secondary'>
					66424 Homburg
				</Typography>
				<Typography variant='body2' color='text.secondary'>
					Deutschland
				</Typography>
			</Box>
			<Box>
				<Typography variant='h6' fontSize={16} gutterBottom>
					Kontakt
				</Typography>
				<Typography variant='body2' color='text.secondary'>
					06841 2229
				</Typography>
				<Typography variant='body2' color='text.secondary'>
					01522 6621236
				</Typography>
			</Box>
    </Box>
  )
}

export default Contact