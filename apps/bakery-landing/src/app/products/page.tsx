import React from 'react'
import { Box, Container, Typography, Breadcrumbs, Link } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'
import Products from '../../components/home/products'
import { PRODUCTS } from '../../mocks/products'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sortiment - Bäckerei Heusser',
  description:
    'Entdecken Sie unser vielfältiges Sortiment an frischen Backwaren, Broten, Brötchen, Kuchen und mehr.',
  keywords: 'Backwaren, Brot, Brötchen, Kuchen, Sortiment, Bäckerei',
}

export default function ProductsPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumb Navigation */}
      <Box sx={{ mb: 4 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link
            underline="hover"
            color="inherit"
            href="/"
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Startseite
          </Link>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: 'text.primary',
            }}
          >
            <ShoppingBasketIcon sx={{ mr: 0.5 }} fontSize="small" />
            Sortiment
          </Box>
        </Breadcrumbs>
      </Box>

      {/* Hero Section */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography
          variant="h2"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 'bold',
            color: 'primary.main',
            mb: 2,
          }}
        >
          Unser Sortiment
        </Typography>
        <Typography
          variant="h5"
          component="p"
          color="text.secondary"
          sx={{ maxWidth: 600, mx: 'auto' }}
        >
          Entdecken Sie unsere vielfältige Auswahl an handwerklich hergestellten
          Backwaren. Von traditionellen Broten bis hin zu süßen Leckereien.
        </Typography>
      </Box>

      {/* Products Display */}
      <Products items={PRODUCTS} showControls={true} />
    </Container>
  )
}
