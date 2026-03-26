'use client'
import React, { use } from 'react'
import { Box } from '@mui/material'
import { Header, Footer } from '@bakery/shared/ui'
import { ProductDetailPage } from '@bakery/shop/feature-catalog'

interface ProductPageProps {
  params: Promise<{ pid: string }>
}

export default function ProductPage({ params }: ProductPageProps) {
  const { pid } = use(params)
  return (
    <Box>
      <Header />
      <ProductDetailPage pid={pid} />
      <Footer />
    </Box>
  )
}
