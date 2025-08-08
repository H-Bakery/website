'use client'
import React from 'react'
import dynamic from 'next/dynamic'
import { Box, CircularProgress } from '@mui/material'
import { Header, Footer } from '@bakery/shared/ui'

// Lazy load the CartPage component
const CartPage = dynamic(
  () =>
    import('@bakery/shop/feature-cart').then((mod) => ({
      default: mod.CartPage,
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

export default function Cart() {
  return (
    <Box>
      <Header />
      <CartPage />
      <Footer />
    </Box>
  )
}
