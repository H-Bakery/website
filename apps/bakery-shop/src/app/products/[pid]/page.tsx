'use client'
import React from 'react'
import { Box } from '@mui/material'
import { Header, Footer } from '@bakery/shared/ui'
import { ProductDetailPage } from '@bakery/shop/feature-catalog'

interface ProductPageProps {
  params: { pid: string }
}

export default function ProductPage({ params }: ProductPageProps) {
  return (
    <Box>
      <Header />
      <ProductDetailPage params={params} />
      <Footer />
    </Box>
  )
}
