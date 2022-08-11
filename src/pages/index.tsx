import React from 'react'
import { Box, Button, Typography } from '@mui/material'

import { Base } from '../layout/Base'
import { Hero } from '../components/home/hero/Hero'
import Map from '../components/home/map'
import Products from '../components/home/products'
import Testimonial from '../components/home/testimonial'
import News from '../components/home/news'
import { featuredProducts } from '../mocks/products/featured'
import { useRouter } from 'next/router'
const Index: React.FC = () => {
  const router = useRouter();
  return (
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
          <Typography sx={{fontSize: {xs: '9vw'}}} variant='h3'>
            Sortiment
          </Typography>  
          <Button onClick={() => router.push("products")} variant='contained'>Mehr</Button>
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
        mt: 4,
        mb: 2
      }}>
        <Typography sx={{fontSize: {xs: '9vw'}}} variant='h3'>
          Neuigkeiten
        </Typography>  
        <Button onClick={() => router.push("news")} variant='contained'>Mehr</Button>
      </Box>
    } />
  </Base>
)};

export default Index;
