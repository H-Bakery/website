'use client'
import React from 'react'
import { Box } from '@mui/material'
import { Header, Footer } from '@bakery/shared/ui'
import { CheckoutPage } from '@bakery/shop/feature-cart'

export default function BestellenPage() {
  return (
    <Box>
      <Header />
      <CheckoutPage />
      <Footer />
    </Box>
  )
}
