import React from 'react'
import { Box, Container, Typography } from '@mui/material'

import { Base } from '../../layout/Base'
import Hero from '../../components/Hero'
import { useRouter } from 'next/router'
import { PRODUCTS } from '../../mocks/products'
import { Product } from '../../components/products/types'

const Index: React.FC = () => { 
  const router = useRouter()
  const { pid } = router.query

  const products: Product[] = PRODUCTS.filter((item) => Number(pid) === Number(item.id))
  console.log('products: ', products)
  const currentProduct: Product = products[0]

  return (  
    <Base>
      <Container maxWidth='sm'>
        <Hero title={currentProduct?.name} />
        <Box sx={{
          backgroundImage: `url(${currentProduct?.image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          height: 320,
          width: '100%',
          borderRadius: '8px',
          boxShadow: 1,
          mb: 2
        }} />
      </Container>
    </Base>
  )
}

export default Index
