'use client'
import React, { useState, useEffect } from 'react'
import { Box, Container, CircularProgress, Alert } from '@mui/material'

import { bakeryAPI } from '@bakery/shared/data-access'
import { Product } from '@bakery/shared/types'
import { Hero, ProductFilter, Products } from '@bakery/shared/ui'

const Index = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const fetchedProducts = await bakeryAPI.products.getAll()
        setProducts(fetchedProducts)
        setAllProducts(fetchedProducts)
      } catch (err) {
        setError('Failed to load products. Please try again.')
        console.error('Error fetching products:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  if (loading) {
    return (
      <div>
        <Hero title="Sortiment" />
        <Container sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Container>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <Hero title="Sortiment" />
        <Container>
          <Alert severity="error" sx={{ my: 4 }}>
            {error}
          </Alert>
        </Container>
      </div>
    )
  }

  return (
    <div>
      <Hero title="Sortiment" />
      <Box mb={6}>
        <Container>
          <ProductFilter setProducts={setProducts} allProducts={allProducts} />
        </Container>
        <Products items={products} showControls={true} />
      </Box>
    </div>
  )
}

export default Index
