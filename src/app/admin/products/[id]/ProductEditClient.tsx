'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import {
  Container,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Grid,
  TextField,
  Button,
  Paper,
  Switch,
  FormControlLabel,
  InputAdornment,
  IconButton,
  Avatar,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Cancel'
import BrokenImageIcon from '@mui/icons-material/BrokenImage'

import bakeryAPI from '../../../../services/bakeryAPI'
import { Product } from '../../../../types/product'
import { formatter } from '../../../../utils/formatPrice'

const initialFormData: Partial<Product> = {
  name: '',
  category: '',
  price: undefined, // Use undefined for empty numeric fields initially
  stock: undefined,
  dailyTarget: undefined,
  description: '',
  image: '',
  isActive: true,
}

export default function ProductEditClient({ productId }: { productId: string }) {
  const router = useRouter()
  const parsedProductId = parseInt(productId, 10)

  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<Partial<Product>>(initialFormData)
  const [originalData, setOriginalData] =
    useState<Partial<Product>>(initialFormData)
  const [isDirty, setIsDirty] = useState(false)
  const [errorAlert, setErrorAlert] = useState<string | null>(null)
  const [successAlert, setSuccessAlert] = useState<string | null>(null)
  const [imagePreviewError, setImagePreviewError] = useState(false)

  const {
    data: product,
    isLoading: isLoadingProduct,
    isError: isErrorProduct,
    error: productError,
  } = useQuery<Product, Error>(
    ['product', parsedProductId],
    () => bakeryAPI.getProductById(parsedProductId),
    {
      enabled: !!parsedProductId,
      onSuccess: (data) => {
        setFormData(data)
        setOriginalData(data)
        setIsDirty(false)
        setImagePreviewError(false) // Reset image error on new data
      },
      onError: () => {
        setErrorAlert('Failed to load product data.')
      },
    }
  )

  const updateMutation = useMutation(
    (updatedProduct: { id: number; data: Partial<Omit<Product, 'id'>> }) =>
      bakeryAPI.updateProduct(updatedProduct.id, updatedProduct.data),
    {
      onSuccess: (updatedProductData) => {
        setSuccessAlert('Product updated successfully!')
        setErrorAlert(null)
        queryClient.invalidateQueries('adminProducts') // Invalidate list
        queryClient.setQueryData(['product', parsedProductId], updatedProductData) // Update cache for this product
        setFormData(updatedProductData)
        setOriginalData(updatedProductData)
        setIsDirty(false)
        setTimeout(() => setSuccessAlert(null), 3000)
      },
      onError: (error: Error) => {
        setErrorAlert(`Failed to update product: ${error.message}`)
        setSuccessAlert(null)
      },
    }
  )

  useEffect(() => {
    if (JSON.stringify(formData) !== JSON.stringify(originalData)) {
      setIsDirty(true)
    } else {
      setIsDirty(false)
    }
  }, [formData, originalData])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = event.target

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'number'
          ? value === ''
            ? undefined
            : parseFloat(value)
          : value,
    }))
  }

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.checked,
    }))
  }

  const handleImageError = () => {
    setImagePreviewError(true)
  }

  const handleSave = () => {
    if (!parsedProductId) return

    // Basic Validation
    if (!formData.name || formData.name.trim() === '') {
      setErrorAlert('Product name is required.')
      return
    }
    if (formData.price === undefined || formData.price < 0) {
      setErrorAlert('Price must be a non-negative number.')
      return
    }
    if (formData.stock !== undefined && formData.stock < 0) {
      setErrorAlert('Stock must be a non-negative number.')
      return
    }
    if (formData.dailyTarget !== undefined && formData.dailyTarget < 0) {
      setErrorAlert('Daily Target must be a non-negative number.')
      return
    }
    setErrorAlert(null)

    const dataToSave: Partial<Omit<Product, 'id'>> = {
      ...formData,
      price: parseFloat(String(formData.price ?? 0)), // Ensure price is a number
      stock:
        formData.stock !== undefined ? parseInt(String(formData.stock), 10) : 0,
      dailyTarget:
        formData.dailyTarget !== undefined
          ? parseInt(String(formData.dailyTarget), 10)
          : 0,
    }
    // Remove id from dataToSave if it exists, as it's passed separately
    delete (dataToSave as Partial<Product>).id

    updateMutation.mutate({ id: parsedProductId, data: dataToSave })
  }

  const handleCancel = () => {
    setFormData(originalData)
    setIsDirty(false)
    setErrorAlert(null)
    router.back() // Or navigate to product list
  }

  if (isLoadingProduct) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    )
  }

  if (isErrorProduct || !product) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">
          {productError?.message || 'Product not found or failed to load.'}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/admin/products')}
          sx={{ mt: 2 }}
        >
          Back to Products
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ mt: 2, mb: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => router.back()} aria-label="back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ ml: 1 }}>
            Edit Product: {originalData.name || `ID: ${parsedProductId}`}
          </Typography>
        </Box>

        {successAlert && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successAlert}
          </Alert>
        )}
        {errorAlert && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorAlert}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {imagePreviewError || !formData.image ? (
                <Avatar
                  sx={{ width: 180, height: 180, mb: 2, fontSize: '4rem' }}
                  variant="rounded"
                >
                  <BrokenImageIcon fontSize="inherit" />
                </Avatar>
              ) : (
                <Box
                  component="img"
                  src={formData.image}
                  alt={formData.name || 'Product Image'}
                  onError={handleImageError}
                  sx={{
                    width: '100%',
                    maxWidth: '180px',
                    height: 'auto',
                    maxHeight: '180px',
                    objectFit: 'contain',
                    borderRadius: 1,
                    mb: 2,
                    border: '1px solid #ddd',
                  }}
                />
              )}
              <TextField
                label="Image URL"
                name="image"
                value={formData.image ?? ''}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                size="small"
              />
            </Box>
          </Grid>

          <Grid item xs={12} md={8}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Product Name"
                  name="name"
                  value={formData.name ?? ''}
                  onChange={handleChange}
                  fullWidth
                  required
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Category"
                  name="category"
                  value={formData.category ?? ''}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Price"
                  name="price"
                  type="number"
                  value={formData.price ?? ''}
                  onChange={handleChange}
                  fullWidth
                  required
                  variant="outlined"
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {'€'}
                      </InputAdornment>
                    ),
                    inputProps: { min: 0, step: 0.01 },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Stock Quantity"
                  name="stock"
                  type="number"
                  value={formData.stock ?? ''}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputProps={{ inputProps: { min: 0, step: 1 } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Daily Target"
                  name="dailyTarget"
                  type="number"
                  value={formData.dailyTarget ?? ''}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputProps={{ inputProps: { min: 0, step: 1 } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  name="description"
                  value={formData.description ?? ''}
                  onChange={handleChange}
                  fullWidth
                  multiline
                  rows={3}
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive ?? true}
                      onChange={handleSwitchChange}
                      name="isActive"
                    />
                  }
                  label="Product is Active"
                />
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={handleCancel}
                startIcon={<CancelIcon />}
                sx={{ mr: 2 }}
                disabled={updateMutation.isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                startIcon={<SaveIcon />}
                disabled={
                  !isDirty || updateMutation.isLoading || isLoadingProduct
                }
              >
                Save Changes
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  )
}