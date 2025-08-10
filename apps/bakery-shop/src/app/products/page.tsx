'use client'
import React from 'react'
import dynamic from 'next/dynamic'
import { Box, CircularProgress } from '@mui/material'
import { Header, Footer } from '@bakery/shared/ui'

// Lazy load the CatalogPage component
const CatalogPage = dynamic(
  () =>
    import('@bakery/shop/feature-catalog').then((mod) => ({
      default: mod.CatalogPage,
    })),
  {
    loading: () => (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
      >
        <CircularProgress />
      </Box>
    ),
  }
)

export default function ProductsPage() {
  return (
    <Box>
      <Header />
      <CatalogPage />
      <Footer />
    </Box>
  )
}
