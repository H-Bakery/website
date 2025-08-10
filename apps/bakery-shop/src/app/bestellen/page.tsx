'use client'
import React from 'react'
import dynamic from 'next/dynamic'
import { Box, CircularProgress } from '@mui/material'
import { Header, Footer } from '@bakery/shared/ui'

// Lazy load the CheckoutPage component
const CheckoutPage = dynamic(
  () =>
    import('@bakery/shop/feature-cart').then((mod) => ({
      default: mod.CheckoutPage,
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

export default function BestellenPage() {
  return (
    <Box>
      <Header />
      <CheckoutPage />
      <Footer />
    </Box>
  )
}
