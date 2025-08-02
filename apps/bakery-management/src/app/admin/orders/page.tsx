'use client'
import React from 'react'
import { Box } from '@mui/material'
import { Header, Footer } from '@bakery/shared/ui'
import { OrdersPage } from '@bakery/management/feature-orders'

export default function AdminOrdersPage() {
  return (
    <Box>
      <Header />
      <OrdersPage />
      <Footer />
    </Box>
  )
}
