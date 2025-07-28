'use client'
import React, { useState, useEffect } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  IconButton,
  Divider,
  Alert,
  Skeleton,
  Badge,
  Tooltip,
  Paper,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  Add,
  Remove,
  Save,
  CheckCircle,
  Warning,
  Info,
  CalendarToday,
  TrendingDown,
  Assessment,
} from '@mui/icons-material'
import bakeryAPI from '../../../services/bakeryAPI'
import { Product } from '../../../types/product'

interface UnsoldEntry {
  productId: number
  quantity: number
  hasEntry: boolean
}

interface DailyUnsoldTrackerProps {
  selectedDate: string
  onSave: () => void
}

const DailyUnsoldTracker: React.FC<DailyUnsoldTrackerProps> = ({ selectedDate, onSave }) => {
  const [products, setProducts] = useState<Product[]>([])
  const [unsoldEntries, setUnsoldEntries] = useState<Map<number, UnsoldEntry>>(new Map())
  const [existingEntries, setExistingEntries] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Group products by category
  const productsByCategory = React.useMemo(() => {
    const grouped = products.reduce((acc, product) => {
      const category = product.category || 'Sonstiges'
      if (!acc[category]) acc[category] = []
      acc[category].push(product)
      return acc
    }, {} as Record<string, Product[]>)

    // Sort categories logically
    const categoryOrder = ['Brot', 'Brötchen', 'Gebäck', 'Kuchen', 'Torten', 'Sonstiges']
    const sortedCategories: Record<string, Product[]> = {}
    
    categoryOrder.forEach(cat => {
      if (grouped[cat]) {
        sortedCategories[cat] = grouped[cat].sort((a, b) => a.name.localeCompare(b.name))
      }
    })
    
    // Add any remaining categories
    Object.keys(grouped).forEach(cat => {
      if (!categoryOrder.includes(cat)) {
        sortedCategories[cat] = grouped[cat].sort((a, b) => a.name.localeCompare(b.name))
      }
    })

    return sortedCategories
  }, [products])

  const categories = Object.keys(productsByCategory)
  const filteredCategories = categoryFilter 
    ? categories.filter(cat => cat === categoryFilter)
    : categories

  useEffect(() => {
    loadData()
  }, [selectedDate])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Load products and existing entries in parallel
      const [productsData, existingData] = await Promise.all([
        bakeryAPI.getProducts(),
        bakeryAPI.getUnsoldProducts()
      ])
      
      setProducts(productsData)
      
      // Filter existing entries for the selected date and create a set of product IDs
      const entriesForDate = existingData.filter(entry => entry.date === selectedDate)
      const existingProductIds = new Set(entriesForDate.map(entry => entry.productId || entry.ProductId))
      setExistingEntries(existingProductIds)
      
      // Initialize unsold entries map with existing data
      const entriesMap = new Map<number, UnsoldEntry>()
      entriesForDate.forEach(entry => {
        const productId = entry.productId || entry.ProductId
        entriesMap.set(productId, {
          productId,
          quantity: entry.quantity,
          hasEntry: true
        })
      })
      
      setUnsoldEntries(entriesMap)
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Fehler beim Laden der Daten')
    } finally {
      setLoading(false)
    }
  }

  const updateQuantity = (productId: number, quantity: number) => {
    setUnsoldEntries(prev => {
      const newMap = new Map(prev)
      if (quantity <= 0 && !existingEntries.has(productId)) {
        newMap.delete(productId)
      } else {
        newMap.set(productId, {
          productId,
          quantity: Math.max(0, quantity),
          hasEntry: existingEntries.has(productId)
        })
      }
      return newMap
    })
  }

  const incrementQuantity = (productId: number) => {
    const current = unsoldEntries.get(productId)?.quantity || 0
    updateQuantity(productId, current + 1)
  }

  const decrementQuantity = (productId: number) => {
    const current = unsoldEntries.get(productId)?.quantity || 0
    if (current > 0) {
      updateQuantity(productId, current - 1)
    }
  }

  const handleDirectInput = (productId: number, value: string) => {
    const quantity = parseInt(value) || 0
    updateQuantity(productId, quantity)
  }

  const getTotalUnsoldCount = () => {
    return Array.from(unsoldEntries.values()).reduce((sum, entry) => sum + entry.quantity, 0)
  }

  const getProductsWithDataCount = () => {
    return Array.from(unsoldEntries.values()).filter(entry => entry.quantity > 0).length
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      
      const entriesToSave = Array.from(unsoldEntries.values()).filter(entry => 
        entry.quantity > 0 && !entry.hasEntry
      )
      
      if (entriesToSave.length === 0) {
        setError('Keine neuen Einträge zum Speichern')
        return
      }

      // Save all entries
      await Promise.all(
        entriesToSave.map(entry =>
          bakeryAPI.addUnsoldProduct(entry.productId, entry.quantity)
        )
      )
      
      setSuccess(`${entriesToSave.length} Einträge erfolgreich gespeichert`)
      setTimeout(() => setSuccess(null), 5000)
      
      // Reload data to reflect changes
      await loadData()
      onSave()
      
    } catch (error) {
      console.error('Error saving entries:', error)
      setError('Fehler beim Speichern der Einträge')
    } finally {
      setSaving(false)
      setShowConfirmDialog(false)
    }
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0]
  const hasUnsavedChanges = Array.from(unsoldEntries.values()).some(entry => 
    entry.quantity > 0 && !entry.hasEntry
  )

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header Section */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CalendarToday />
            <Typography variant="h5" fontWeight={600}>
              Unverkaufte Produkte erfassen
            </Typography>
            {isToday && (
              <Chip 
                label="Heute" 
                color="secondary" 
                size="small" 
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>
          <Typography variant="h6">
            {new Date(selectedDate).toLocaleDateString('de-DE', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })}
          </Typography>
        </Box>
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" fontWeight={700}>
                {getTotalUnsoldCount()}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Gesamt unverkauft
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" fontWeight={700}>
                {getProductsWithDataCount()}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Produkte erfasst
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" fontWeight={700}>
                {existingEntries.size}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Bereits gespeichert
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Category Filter */}
      <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          label="Alle Kategorien"
          onClick={() => setCategoryFilter('')}
          color={categoryFilter === '' ? 'primary' : 'default'}
          variant={categoryFilter === '' ? 'filled' : 'outlined'}
        />
        {categories.map(category => (
          <Chip
            key={category}
            label={category}
            onClick={() => setCategoryFilter(category)}
            color={categoryFilter === category ? 'primary' : 'default'}
            variant={categoryFilter === category ? 'filled' : 'outlined'}
          />
        ))}
      </Box>

      {/* Products Grid by Category */}
      {filteredCategories.map(category => (
        <Box key={category} sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ 
            color: 'primary.main', 
            fontWeight: 600,
            borderBottom: 1,
            borderColor: 'divider',
            pb: 1,
            mb: 2
          }}>
            {category}
          </Typography>
          
          <Grid container spacing={2}>
            {productsByCategory[category].map(product => {
              const entry = unsoldEntries.get(product.id)
              const quantity = entry?.quantity || 0
              const hasExistingEntry = existingEntries.has(product.id)
              const hasUnsavedData = quantity > 0 && !hasExistingEntry

              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                  <Card 
                    elevation={hasUnsavedData ? 4 : 1}
                    sx={{ 
                      height: '100%',
                      position: 'relative',
                      border: hasUnsavedData ? 2 : 0,
                      borderColor: hasUnsavedData ? 'warning.main' : 'transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    {hasExistingEntry && (
                      <Chip
                        icon={<CheckCircle />}
                        label="Gespeichert"
                        color="success"
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          zIndex: 1
                        }}
                      />
                    )}
                    
                    <CardContent sx={{ pb: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        {product.name}
                      </Typography>
                      
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        €{product.price.toFixed(2)}
                      </Typography>
                      
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: 1,
                        mt: 2
                      }}>
                        <IconButton
                          onClick={() => decrementQuantity(product.id)}
                          disabled={quantity <= 0}
                          color="primary"
                          size="small"
                        >
                          <Remove />
                        </IconButton>
                        
                        <TextField
                          value={quantity}
                          onChange={(e) => handleDirectInput(product.id, e.target.value)}
                          inputProps={{
                            style: { textAlign: 'center' },
                            min: 0,
                            inputMode: 'numeric'
                          }}
                          sx={{ 
                            width: 80,
                            '& .MuiOutlinedInput-root': {
                              height: 40
                            }
                          }}
                          size="small"
                        />
                        
                        <IconButton
                          onClick={() => incrementQuantity(product.id)}
                          color="primary"
                          size="small"
                        >
                          <Add />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        </Box>
      ))}

      {/* Save Button */}
      {hasUnsavedChanges && (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            p: 2,
            bgcolor: 'warning.main',
            color: 'white',
            borderRadius: 3
          }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<Save />}
            onClick={() => setShowConfirmDialog(true)}
            disabled={saving}
            sx={{
              bgcolor: 'white',
              color: 'warning.main',
              '&:hover': {
                bgcolor: 'grey.100'
              }
            }}
          >
            {saving ? 'Speichere...' : `${getProductsWithDataCount()} Einträge speichern`}
          </Button>
        </Paper>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)}>
        <DialogTitle>Einträge speichern bestätigen</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Sie sind dabei, {getProductsWithDataCount()} neue Einträge mit insgesamt{' '}
            {getTotalUnsoldCount()} unverkauften Produkten zu speichern.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Datum: {new Date(selectedDate).toLocaleDateString('de-DE')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={saving}
            startIcon={<Save />}
          >
            {saving ? 'Speichere...' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default DailyUnsoldTracker