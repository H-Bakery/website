import React from 'react'
import { Box, Button, Typography } from '@mui/material'

import { Base } from '../layout/Base'
import { Hero } from '../components/home/hero/Hero'
import Map from '../components/home/map'
import Products from '../components/home/products'
import Testimonial from '../components/home/testimonial'
import News from '../components/home/news'
import { featuredProducts } from '../mocks/products/featured'

const Index: React.FC = () => (
  <Base>
    <Hero />
    <Map />
    <Products
      sx={{ py: 6 }}
      header={
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4
        }}>
          <Typography variant='h3'>
            Sortiment
          </Typography>  
          <Button variant='contained'>Alle entdecken</Button>
        </Box>
      }
      items={featuredProducts}
    />
    <Testimonial />
    <News header={
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 4
      }}>
        <Typography variant='h3'>
          Neuigkeiten
        </Typography>  
        <Button variant='contained'>Alle entdecken</Button>
      </Box>
    } />
  </Base>
);

export default Index;
