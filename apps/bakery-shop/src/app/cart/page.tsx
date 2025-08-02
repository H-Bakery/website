'use client'
import React from 'react'
import { Box } from '@mui/material'
import { Header, Footer } from '@bakery/shared/ui'
import { CartPage } from '@bakery/shop/feature-cart'

export default function Cart() {
  return (
    <Box>
      <Header />
      <CartPage />
      <Footer />
    </Box>
  )
}
