'use client'
import React, { useState } from 'react'
import { Box, Container } from '@mui/material'

import { PRODUCTS } from '../../mocks/products'
import Base from '../../layouts/Base'
import Hero from '../../components/Hero'
import Filter from '../../components/products/Filter'
import Products from '../../components/home/products'

const Index = () => {
  const [products, setProducts] = useState(PRODUCTS)

  return (
    <Base>
      <Hero title="Sortiment" />
      <Box mb={6}>
        <Container>
          <Filter setProducts={setProducts} />
        </Container>
        <Products items={products} />
      </Box>
    </Base>
  )
}

export default Index
