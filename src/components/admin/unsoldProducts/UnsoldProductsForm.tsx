'use client'
import React, { useState, useEffect } from 'react'
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  FormHelperText,
  Alert,
  Autocomplete,
  CircularProgress,
} from '@mui/material'
import { Save, Inventory } from '@mui/icons-material'
import bakeryAPI from '../../../services/bakeryAPI'
import { Product } from '../../../types/product'

interface UnsoldProductsFormProps {
  onSubmit: (productId: number, quantity: number) => Promise<void>
}

const UnsoldProductsForm: React.FC<UnsoldProductsFormProps> = ({ onSubmit }) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const productsData = await bakeryAPI.getProducts()
        setProducts(productsData)
      } catch (error) {
        console.error('Error loading products:', error)
        setError('Fehler beim Laden der Produkte')
      } finally {
        setIsLoadingProducts(false)
      }
    }

    loadProducts()
  }, [])

  const handleQuantityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    // Only allow positive integers
    if (value === '' || /^\d+$/.test(value)) {
      setQuantity(value)
      setError(null)
      setShowConfirmation(false)
    }
  }

  const validateForm = (): boolean => {
    if (!selectedProduct) {
      setError('Bitte wählen Sie ein Produkt aus')
      return false
    }

    const numericQuantity = parseInt(quantity)
    
    if (isNaN(numericQuantity) || numericQuantity < 0) {
      setError('Bitte geben Sie eine gültige Anzahl (0 oder größer) ein')
      return false
    }
    
    if (numericQuantity > 999) {
      setError('Die Anzahl darf nicht größer als 999 sein')
      return false
    }
    
    return true
  }

  const checkForUnusualQuantity = (numericQuantity: number): boolean => {
    // Check if quantity is unusually high (more than 50 pieces)
    return numericQuantity > 50
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    const numericQuantity = parseInt(quantity)
    
    // Show confirmation for unusual quantities
    if (checkForUnusualQuantity(numericQuantity) && !showConfirmation) {
      setShowConfirmation(true)
      return
    }
    
    setIsSubmitting(true)
    setError(null)
    
    try {
      await onSubmit(selectedProduct!.id, numericQuantity)
      setSelectedProduct(null)
      setQuantity('')
      setShowConfirmation(false)
    } catch (error) {
      setError('Fehler beim Speichern der unverkauften Produkte')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmSubmit = () => {
    setShowConfirmation(false)
    handleSubmit(new Event('submit') as any)
  }

  const getCurrentDateTime = () => {
    const now = new Date()
    return now.toLocaleString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Unverkaufte Produkte erfassen
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Erfassen Sie hier die Produkte, die am Ende des Tages nicht verkauft wurden.
        Aktuell: {getCurrentDateTime()}
      </Typography>

      <Paper elevation={2} sx={{ p: 3, maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <Autocomplete
            options={products}
            getOptionLabel={(option) => `${option.name} (${option.category})`}
            value={selectedProduct}
            onChange={(_, newValue) => {
              setSelectedProduct(newValue)
              setError(null)
              setShowConfirmation(false)
            }}
            loading={isLoadingProducts}
            disabled={isSubmitting}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Produkt auswählen"
                fullWidth
                sx={{ mb: 2 }}
                error={!!error && !selectedProduct}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isLoadingProducts ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          <TextField
            fullWidth
            label="Anzahl unverkauft"
            value={quantity}
            onChange={handleQuantityChange}
            placeholder="0"
            type="text"
            inputProps={{
              inputMode: 'numeric',
              pattern: '[0-9]*',
            }}
            InputProps={{
              startAdornment: <Inventory color="primary" sx={{ mr: 1 }} />,
              sx: {
                fontSize: '1.2rem',
                '& input': {
                  fontSize: '1.2rem',
                  textAlign: 'center',
                },
              },
            }}
            InputLabelProps={{
              sx: { fontSize: '1rem' },
            }}
            error={!!error && !selectedProduct}
            disabled={isSubmitting}
            sx={{ mb: 2 }}
          />
          
          {error && (
            <FormHelperText error sx={{ mb: 2, fontSize: '1rem' }}>
              {error}
            </FormHelperText>
          )}
          
          {showConfirmation && (
            <Alert 
              severity="warning" 
              sx={{ mb: 2 }}
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    color="inherit" 
                    size="small" 
                    onClick={() => setShowConfirmation(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button 
                    color="inherit" 
                    size="small" 
                    variant="outlined"
                    onClick={handleConfirmSubmit}
                  >
                    Bestätigen
                  </Button>
                </Box>
              }
            >
              <Typography variant="body2">
                Die eingegebene Anzahl ({quantity} Stück) ist ungewöhnlich hoch. 
                Möchten Sie fortfahren?
              </Typography>
            </Alert>
          )}
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            startIcon={<Save />}
            disabled={isSubmitting || !selectedProduct || !quantity || !!error}
            sx={{ 
              py: 1.5,
              fontSize: '1.1rem',
            }}
          >
            {isSubmitting ? 'Speichere...' : 'Unverkaufte Produkte speichern'}
          </Button>
        </form>
        
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Tipp: Geben Sie 0 ein, wenn von einem Produkt nichts übrig geblieben ist
        </Typography>
      </Paper>
    </Box>
  )
}

export default UnsoldProductsForm