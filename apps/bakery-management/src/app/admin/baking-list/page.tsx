'use client'
import React from 'react'
import { Box } from '@mui/material'
import { Header, Footer } from '@bakery/shared/ui'
import { BakingListPage } from '@bakery/management/feature-orders'

export default function AdminBakingListPage() {
  return (
    <Box>
      <Header />
      <BakingListPage />
      <Footer />
    </Box>
  )
}
