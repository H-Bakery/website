import React from 'react'
import { Box, BoxProps, Button, Container, Grid, Typography } from '@mui/material'
import ProductCard from './ProductCard'
import { Product } from '../../products/types'

interface Props extends BoxProps {
  header?: React.ReactNode
  items: Product[]
}

const Products: React.FC<Props> = (props) => {
  const { items, header, sx } = props

  return (
    <Box sx={sx}>
      <Container>
        {header}
        <Grid container spacing={4}>
          {items.map((item) => (
            <Grid key={item.id} item xs={6} sm={4} md={3}>
              <ProductCard {...item} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box> 
  )
}

export default Products