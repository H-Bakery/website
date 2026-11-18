'use client'
import React from 'react'
import { Box, Container, Typography, Breadcrumbs, Link } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'
import Hero from '../../components/Hero'
import Products from '../../components/home/products'
import { Product } from '../../types/product'

interface Props {
  initialProducts: Product[]
}

export default function ProductsPageClient({ initialProducts }: Props) {
  return (
    <>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Breadcrumb Navigation */}
        <Box sx={{ mb: 4 }}>
          <Breadcrumbs aria-label="Seitenpfad">
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

      <Container maxWidth="lg" sx={{ pt: 4 }}>
        <Typography
          variant="h5"
          component="p"
          color="text.secondary"
          sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', mb: 2 }}
        >
          Entdecken Sie unsere vielfältige Auswahl an handwerklich hergestellten
          Backwaren. Von traditionellen Broten bis hin zu süßen Leckereien.
        </Typography>
      </Container>

      {/* Kategorie, Suche, Liste und Seiten - eine Komponente, damit Kategorie
          und Suche zusammen wirken und in der Adresse stehen. Kein äußerer
          Container: sonst doppelter Seitenrand und Kacheln und Karten nicht
          bündig. */}
      <Products
        items={initialProducts}
        showControls
        showCategoryFilter
        syncUrl
      />
    </>
  )
}
