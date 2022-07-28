import React from 'react'
import { Box, Button, Container, Grid, Typography } from '@mui/material'
import { featuredProducts } from '../../../mocks/products/featured'
import ProductCard from './ProductCard'

const Products: React.FC = () => {
  return (
    <Box sx={{ py: 6 }}>
      <Container>
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
        <Grid container spacing={4}>
          {featuredProducts.map((item) => (
            <Grid key={item.id} item xs={3}>
              <ProductCard {...item} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box> 
  )
}

export default Products