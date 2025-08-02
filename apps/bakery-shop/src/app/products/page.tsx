'use client'
import React from 'react'
import { Box } from '@mui/material'
import { Header, Footer } from '@bakery/shared/ui'
import { CatalogPage } from '@bakery/shop/feature-catalog'

export default function ProductsPage() {
  return (
    <Box>
      <Header />
      <CatalogPage />
      <Footer />
    </Box>
  )
}
