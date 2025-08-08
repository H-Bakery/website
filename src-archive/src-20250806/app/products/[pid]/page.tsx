// @ts-nocheck
import React from 'react'
import { notFound } from 'next/navigation'
import Base from '../../../layouts/Base'
import { PRODUCTS } from '../../../mocks/products'
import {
  Box,
  Chip,
  Container,
  Grid,
  Typography,
  Paper,
  Divider,
  Breadcrumbs,
  Link,
} from '@mui/material'
import { formatter } from '../../../utils/formatPrice'
import Button from '../../../components/button/Index'
import Hero from '../../../components/Hero'
import Image from 'next/image'
import HomeIcon from '@mui/icons-material/Home'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'

export default function ProductPage({ params }) {
  const { pid } = params

  const product = PRODUCTS.find((item) => Number(pid) === Number(item.id))

  if (!product) {
    notFound()
  }

  return (
    <Base>
      <Container>
        {/* Breadcrumb Navigation */}
        <Box sx={{ my: 2 }}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link
              underline="hover"
              color="inherit"
              href="/"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
              Home
            </Link>
            <Link
              underline="hover"
              color="inherit"
              href="/products"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <ShoppingBasketIcon sx={{ mr: 0.5 }} fontSize="small" />
              Produkte
            </Link>
            <Typography color="text.primary">{product.name}</Typography>
          </Breadcrumbs>
        </Box>

        {/* Product Detail */}
        <Paper
          elevation={2}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 2,
          }}
        >
          <Grid container spacing={3}>
            {/* Product Image */}
            <Grid item xs={12} md={6}>
              <Box
                sx={styles.imageContainer}
                component="figure"
                aria-label={`Bild von ${product.name}`}
              >
                <Image
                  width={200}
                  height={150}
                  src={product.image}
                  alt={product.name}
                  style={styles.productImage}
                />
              </Box>
            </Grid>

            {/* Product Information */}
            <Grid item xs={12} md={6}>
              <Box component="article">
                <Box sx={styles.categoryContainer}>
                  <Chip
                    size="small"
                    label={product.category}
                    color="primary"
                    variant="outlined"
                  />
                </Box>

                <Typography
                  variant="h4"
                  component="h1"
                  fontWeight="bold"
                  gutterBottom
                >
                  {product.name}
                </Typography>

                <Typography
                  variant="h5"
                  component="p"
                  color="primary.main"
                  fontWeight="bold"
                  sx={{ mb: 2 }}
                >
                  {formatter.format(product.price)}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                  Produktbeschreibung
                </Typography>

                <Typography variant="body1" paragraph>
                  {product.description ||
                    `${product.name} ist ein hochwertiges Backprodukt aus unserer Bäckerei.
                   Hergestellt aus sorgfältig ausgewählten Zutaten und mit handwerklichem
                   Können gebacken.`}
                </Typography>

                <Box sx={styles.productFeatures}>
                  <Typography variant="subtitle2">
                    • Frisch gebacken in unserer Bäckerei
                  </Typography>
                  <Typography variant="subtitle2">
                    • Aus regionalen Zutaten
                  </Typography>
                  <Typography variant="subtitle2">
                    • Ohne künstliche Zusatzstoffe
                  </Typography>
                </Box>

                {/* Add to Cart Button - Commented out but improved */}
                {/*
                <Button
                  sx={{ mt: 3 }}
                  size="large"
                  fullWidth
                  onClick={() => add(product.id)}
                  aria-label={`${product.name} zum Warenkorb hinzufügen`}
                >
                  Zum Warenkorb
                </Button>
                */}

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" color="text.secondary">
                  Artikelnummer: {product.id}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Base>
  )
}

const styles = {
  imageContainer: {
    backgroundColor: 'background.paper',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
    padding: 4,
    height: '100%',
    minHeight: 300,
    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)',
    margin: 0,
  },
  productImage: {
    maxWidth: '90%',
    maxHeight: '90%',
    objectFit: 'contain',
  },
  categoryContainer: {
    marginBottom: 2,
  },
  productFeatures: {
    mt: 2,
    bgcolor: 'grey.50',
    p: 2,
    borderRadius: 1,
    borderLeft: '4px solid',
    borderColor: 'primary.main',
  },
}

export async function generateStaticParams() {
  return PRODUCTS.map((product) => ({
    pid: product.id.toString(),
  }))
}
