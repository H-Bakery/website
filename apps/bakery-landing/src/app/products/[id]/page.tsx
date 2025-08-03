import React from 'react'
import { notFound } from 'next/navigation'
import {
  Box,
  Container,
  Typography,
  Paper,
  Chip,
  Grid,
  Divider,
  Breadcrumbs,
  Link,
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'
import Image from 'next/image'
import { PRODUCTS } from '../../../mocks/products'
import { formatPrice } from '../../../utils/formatPrice'
import { Metadata } from 'next'

interface ProductPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateStaticParams() {
  return PRODUCTS.map((product) => ({
    id: product.id.toString(),
  }))
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params
  const product = PRODUCTS.find((item) => item.id.toString() === id)

  if (!product) {
    return {
      title: 'Produkt nicht gefunden - Bäckerei Heusser',
    }
  }

  return {
    title: `${product.name} - Bäckerei Heusser`,
    description:
      product.description ||
      `${product.name} aus unserer Bäckerei. Frisch gebacken und von höchster Qualität.`,
    keywords: `${product.name}, ${product.category}, Backwaren, Bäckerei`,
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params
  const product = PRODUCTS.find((item) => item.id.toString() === id)

  if (!product) {
    notFound()
  }

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
          <Link
            underline="hover"
            color="inherit"
            href="/products"
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <ShoppingBasketIcon sx={{ mr: 0.5 }} fontSize="small" />
            Sortiment
          </Link>
          <Typography color="text.primary">{product.name}</Typography>
        </Breadcrumbs>
      </Box>

      {/* Product Detail */}
      <Paper
        elevation={2}
        sx={{
          p: 4,
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <Grid container spacing={4}>
          {/* Product Image */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                backgroundColor: 'grey.50',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 2,
                p: 4,
                height: { xs: 300, md: 400 },
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)',
              }}
              component="figure"
              aria-label={`Bild von ${product.name}`}
            >
              <Image
                width={300}
                height={250}
                src={product.image || '/assets/images/products/placeholder.jpg'}
                alt={product.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            </Box>
          </Grid>

          {/* Product Information */}
          <Grid item xs={12} md={6}>
            <Box component="article">
              {/* Category Badge */}
              <Box sx={{ mb: 2 }}>
                <Chip
                  size="small"
                  label={product.category}
                  color="primary"
                  variant="outlined"
                  sx={{ fontWeight: 'medium' }}
                />
              </Box>

              {/* Product Name */}
              <Typography
                variant="h3"
                component="h1"
                fontWeight="bold"
                gutterBottom
                sx={{ color: 'text.primary' }}
              >
                {product.name}
              </Typography>

              {/* Price */}
              <Typography
                variant="h4"
                component="p"
                color="primary.main"
                fontWeight="bold"
                sx={{ mb: 3 }}
              >
                {formatPrice(product.price)}
              </Typography>

              <Divider sx={{ my: 3 }} />

              {/* Description Section */}
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Produktbeschreibung
              </Typography>

              <Typography variant="body1" paragraph sx={{ lineHeight: 1.7 }}>
                {product.description ||
                  `${product.name} ist ein hochwertiges Backprodukt aus unserer Bäckerei.
                   Hergestellt aus sorgfältig ausgewählten Zutaten und mit handwerklichem
                   Können gebacken.`}
              </Typography>

              {/* Product Features */}
              <Box
                sx={{
                  mt: 3,
                  bgcolor: 'primary.light',
                  color: 'primary.dark',
                  p: 3,
                  borderRadius: 2,
                  borderLeft: '4px solid',
                  borderColor: 'primary.main',
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 'bold', mb: 1 }}
                >
                  Unsere Qualitätsversprechen:
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • Täglich frisch gebacken in unserer Bäckerei
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • Aus regionalen und hochwertigen Zutaten
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • Ohne künstliche Zusatzstoffe
                </Typography>
                <Typography variant="body2">
                  • Traditionelle Handwerkskunst
                </Typography>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Product Info */}
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Artikelnummer:</strong> {product.id}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Kategorie:</strong> {product.category}
                </Typography>
              </Box>

              {/* Call to Action */}
              <Box
                sx={{
                  mt: 4,
                  p: 3,
                  bgcolor: 'success.light',
                  borderRadius: 2,
                  textAlign: 'center',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Interesse geweckt?
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Besuchen Sie uns in unserer Filiale oder rufen Sie uns an
                  unter{' '}
                  <Link
                    href="tel:068412229"
                    color="primary"
                    sx={{ fontWeight: 'bold' }}
                  >
                    06841 2229
                  </Link>
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  )
}
