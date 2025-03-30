import React from 'react'
import { Box, Container, Grid, Typography, Divider } from '@mui/material'
import { TESTIMONIALS } from '../../../mocks/testimonials'
import Card from './Card'

const Testimonial = () => {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        py: 6,
      }}
    >
      <Container>
        <Box
          sx={{
            mb: 5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography
            sx={{ fontSize: { xs: '9vw' } }}
            variant="h3"
            gutterBottom
          ></Typography>
          <Typography
            variant="h3"
            align="center"
            sx={{
              fontSize: { xs: '9vw', sm: '2.5rem' },
              fontWeight: 'bold',
              mb: 1,
            }}
          >
            Kundenmeinungen
          </Typography>
          <Divider
            sx={{
              width: '80px',
              borderWidth: 2,
              borderColor: 'primary.main',
              mb: 2,
            }}
          />
          <Typography
            variant="subtitle1"
            align="center"
            color="text.secondary"
            sx={{ maxWidth: '800px' }}
          >
            Entdecken Sie, was unsere Kunden über uns sagen. Diese authentischen
            Bewertungen spiegeln unsere Hingabe zur Qualität und den herzlichen
            Service wider, den wir jeden Tag bieten.
          </Typography>
        </Box>
        <Grid container spacing={4}>
          {TESTIMONIALS.map((item) => (
            <Grid key={item.name} item xs={12} md={4}>
              <Card {...item} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default Testimonial
