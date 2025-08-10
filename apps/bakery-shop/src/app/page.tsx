'use client'
import React from 'react'
import { Box } from '@mui/material'
import { Header, Footer, Hero, Products } from '@bakery/shared/ui'
import { QuickOrder } from '@bakery/shop/feature-cart'

export default function HomePage() {
  return (
    <Box>
      <Header />

      {/* Hero Section */}
      <Hero
        title="Willkommen bei der Bäckerei Heusser"
        subtitle="Frische Backwaren aus traditioneller Handwerkskunst"
      />

      {/* Quick Order Section */}
      <QuickOrder />

      {/* Featured Products Section */}
      <Box sx={{ py: 8 }}>
        <Products
          header="Unsere beliebten Produkte"
          items={[]} // Will be populated by the Products component
          showControls={false}
        />
      </Box>

      <Footer />
    </Box>
  )
}
