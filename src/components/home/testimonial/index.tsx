import React from 'react'
import { Box, Container, Grid, Typography } from '@mui/material'
import { KUNDENBEWERTUNGEN } from '../../../mocks/kundenbewertungen'

const Testimonial = () => {
  return (
    <Box sx={{
      bgcolor: 'background.paper',
      py: 6
    }}>
      <Container>
        <Typography variant='h3' gutterBottom>Kundenmeinungen</Typography>
        <Grid container spacing={4}>
          {KUNDENBEWERTUNGEN.map((item) => (
            <Grid key={item.name} item xs={4}>
              <Box key={item.name}>
                <Typography gutterBottom variant='h5'>{item.stars} ⭐️</Typography>
                <Typography color='text.secondary'>{item.text}</Typography>
                <Typography variant='h6' sx={{ mt: 1 }}>{item.name}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default Testimonial