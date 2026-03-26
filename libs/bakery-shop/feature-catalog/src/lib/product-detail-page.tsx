'use client'
import React, { useEffect, useState } from 'react'
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
  CircularProgress,
  Alert,
} from '@mui/material'
import Image from 'next/image'
import HomeIcon from '@mui/icons-material/Home'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'

import { formatter } from '@bakery/shared/utils'
import { Button } from '@bakery/shared/ui'
import { useCart } from '@bakery/shared/contexts'
import {
  Product,
  ProductType,
  ProductStatus,
  ProductCategory,
} from '@bakery/shared/types'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'

interface HQProduct {
  id: string
  numeric_id: number
  name: string
  category: string
  price: number
  available: boolean
  image: string | null
  short_description: string
  description?: string
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export default function ProductDetailPage({ pid }: { pid: string }) {
  const [product, setProduct] = useState<HQProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const { addToCart } = useCart()

  useEffect(() => {
    fetch(`${API}/api/products`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        const products: HQProduct[] = data.data || data || []
        const found = products.find(
          (p) => String(p.numeric_id) === String(pid) || p.id === String(pid)
        )
        setProduct(found || null)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching product:', err)
        setError('Produkt konnte nicht geladen werden.')
        setLoading(false)
      })
  }, [pid])

  const handleAddToCart = () => {
    if (!product) return
    const cartProduct = {
      id: product.numeric_id,
      name: product.name,
      description: product.description || product.short_description,
      category: product.category as unknown as ProductCategory,
      type: ProductType.Fresh,
      price: product.price,
      stock: 99,
      status: ProductStatus.Available,
      image: product.image || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Product
    addToCart(cartProduct)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Container>
    )
  }

  if (error) {
    return (
      <Container>
        <Alert severity="error" sx={{ my: 4 }}>
          {error}
        </Alert>
      </Container>
    )
  }

  if (!product) {
    return (
      <Container>
        <Alert severity="warning" sx={{ my: 4 }}>
          Produkt nicht gefunden.
        </Alert>
      </Container>
    )
  }

  return (
    <div>
      <Container>
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

        <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box
                sx={styles.imageContainer}
                component="figure"
                aria-label={`Bild von ${product.name}`}
              >
                {product.image &&
                product.image.startsWith('/assets/') &&
                product.image.length > 10 ? (
                  <Image
                    width={400}
                    height={300}
                    src={product.image}
                    alt={product.name}
                    style={styles.productImage}
                  />
                ) : (
                  <Typography variant="h1">🥖</Typography>
                )}
              </Box>
            </Grid>

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
                    product.short_description ||
                    `${product.name} ist ein hochwertiges Backprodukt aus unserer Bäckerei.`}
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

                <Button
                  sx={{ mt: 3 }}
                  size="large"
                  fullWidth
                  onClick={handleAddToCart}
                  color={added ? 'success' : undefined}
                  aria-label={`${product.name} zum Warenkorb hinzufügen`}
                >
                  {added ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleOutlineIcon fontSize="small" />
                      Hinzugefügt!
                    </Box>
                  ) : (
                    'In den Warenkorb'
                  )}
                </Button>

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" color="text.secondary">
                  Artikelnummer: {product.numeric_id}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </div>
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
    objectFit: 'contain' as const,
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
