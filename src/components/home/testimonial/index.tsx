import React from 'react'
import { Box, Container, Grid, Typography } from '@mui/material'
import { TESTIMONIALS } from '../../../mocks/testimonials'
import Card from './Card'

const Testimonial = () => {
  return (
    <Box sx={{
      bgcolor: 'background.paper',
      py: 6
    }}>
      <Container>
        <Typography variant='h3' gutterBottom>Kundenmeinungen</Typography>
        <Grid container spacing={4}>
          {TESTIMONIALS.map((item) => (
            <Grid key={item.name} item xs={4}>
              <Card {...item} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default Testimonial