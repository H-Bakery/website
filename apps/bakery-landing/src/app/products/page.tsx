import React from 'react'
import { Box, Container, Typography, Breadcrumbs, Link } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'
import Hero from '../../components/Hero'
import ProductsByCategory from '../../components/home/ProductsByCategory'
import { getProductsByCategory } from '../../lib/products'

export default function ProductsPage() {
  const categories = getProductsByCategory()

  return (
    <>
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
      </Container>

      {/* Hero Section */}
      <Hero title="Unser Sortiment" />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography
          variant="h5"
          component="p"
          color="text.secondary"
          sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', mb: 6 }}
        >
          Entdecken Sie unsere vielfältige Auswahl an handwerklich hergestellten
          Backwaren. Von traditionellen Broten bis hin zu süßen Leckereien.
        </Typography>
      </Container>

      {/* All products with category filters */}
      <ProductsByCategory categories={categories} />
    </>
  )
}
