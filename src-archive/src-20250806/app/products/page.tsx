'use client'
import React, { useState, useEffect } from 'react'
import { Box, Container, CircularProgress, Alert } from '@mui/material'

import bakeryAPI from '../../services/bakeryAPI'
import { Product } from '../../types/product'
import Base from '../../layouts/Base'
import Hero from '../../components/Hero'
import Filter from '../../components/products/Filter'
import Products from '../../components/home/products'

const Index = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const fetchedProducts = await bakeryAPI.getProducts()
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
      <Base>
        <Hero title="Sortiment" />
        <Container sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Container>
      </Base>
    )
  }

  if (error) {
    return (
      <Base>
        <Hero title="Sortiment" />
        <Container>
          <Alert severity="error" sx={{ my: 4 }}>
            {error}
          </Alert>
        </Container>
      </Base>
    )
  }

  return (
    <Base>
      <Hero title="Sortiment" />
      <Box mb={6}>
        <Container>
          <Filter setProducts={setProducts} allProducts={allProducts} />
        </Container>
        <Products items={products} showControls={true} />
      </Box>
    </Base>
  )
}

export default Index
