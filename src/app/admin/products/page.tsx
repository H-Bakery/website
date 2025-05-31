// src/app/admin/products/page.tsx
'use client'

import React from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import Link from 'next/link'
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Container,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import bakeryAPI from '../../../services/bakeryAPI'
import { Product } from '../../../types/product'
import ProductTable from '../../../components/admin/products/ProductTable'
import ProductFilters from '../../../components/admin/products/ProductFilters' // Import ProductFilters

export default function AdminProductsPage() {
  const queryClient = useQueryClient()

  const {
    data: products,
    isLoading,
    isError,
    error,
  } = useQuery<Product[], Error>('adminProducts', bakeryAPI.getProducts)

  const deleteMutation = useMutation(bakeryAPI.deleteProduct, {
    onSuccess: () => {
      queryClient.invalidateQueries('adminProducts')
      // TODO: Add a success notification (e.g., Snackbar)
    },
    onError: (deletionError: Error) => {
      console.error('Error deleting product:', deletionError.message)
      // TODO: Add an error notification (e.g., Snackbar)
    },
  })

  const handleDeleteProduct = (productId: number) => {
    if (
      window.confirm(
        'Are you sure you want to delete this product? This action cannot be undone.'
      )
    ) {
      deleteMutation.mutate(productId)
    }
  }

  const [filters, setFilters] = React.useState({
    name: '',
    category: '',
    status: '', // '' for all, 'active', 'inactive'
  })

  const handleFilterChange = (
    filterName: keyof typeof filters,
    value: string
  ) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      [filterName]: value,
    }))
  }

  const uniqueCategories = React.useMemo(() => {
    if (!products) return []
    const allCategories = products.map((p) => p.category)
    return [...new Set(allCategories)].sort()
  }, [products])

  const filteredProducts = React.useMemo(() => {
    if (!products) return []
    return products.filter((product) => {
      const nameMatch = product.name
        .toLowerCase()
        .includes(filters.name.toLowerCase())
      const categoryMatch = filters.category
        ? product.category === filters.category
        : true
      let statusMatch = true
      if (filters.status === 'active') {
        statusMatch = product.isActive
      } else if (filters.status === 'inactive') {
        statusMatch = !product.isActive
      }
      return nameMatch && categoryMatch && statusMatch
    })
  }, [products, filters])

  if (isLoading) {
    return (
      <Container
        maxWidth="lg"
        sx={{ mt: 4, mb: 4, display: 'flex', justifyContent: 'center' }}
      >
        <CircularProgress />
      </Container>
    )
  }

  if (isError || !products) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Error fetching products:{' '}
          {error?.message || 'Products data is unavailable.'}
        </Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          Product Management
        </Typography>
        <Button
          variant="contained"
          component={Link}
          href="/admin/products/new"
          startIcon={<AddIcon />}
        >
          Add New Product
        </Button>
      </Box>

      <ProductFilters
        categories={uniqueCategories}
        filterValues={filters}
        onFilterChange={handleFilterChange}
      />

      <Box sx={{ mb: 2 }}>
        <Typography variant="body1">
          Showing {filteredProducts?.length || 0} of {products?.length || 0}{' '}
          products.
        </Typography>
      </Box>

      <ProductTable
        products={filteredProducts || []}
        onDelete={handleDeleteProduct}
      />
    </Container>
  )
}
