'use client'
import React, { useState } from 'react'
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  InputAdornment,
  FormHelperText,
  Alert,
} from '@mui/material'
import { Euro, Save } from '@mui/icons-material'

interface CashEntryFormProps {
  onSubmit: (amount: number) => Promise<void>
}

const CashEntryForm: React.FC<CashEntryFormProps> = ({ onSubmit }) => {
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const formatCurrency = (value: string): string => {
    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '')
    
    // Ensure only one decimal point
    const parts = numericValue.split('.')
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('')
    }
    
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].substring(0, 2)
    }
    
    return numericValue
  }

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatCurrency(event.target.value)
    setAmount(formattedValue)
    setError(null)
    setShowConfirmation(false)
  }

  const validateAmount = (): boolean => {
    const numericAmount = parseFloat(amount)
    
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Bitte geben Sie einen gültigen Betrag größer als 0 ein')
      return false
    }
    
    if (numericAmount > 9999.99) {
      setError('Der Betrag darf nicht größer als €9.999,99 sein')
      return false
    }
    
    return true
  }

  const checkForUnusualAmount = (numericAmount: number): boolean => {
    // Check if amount differs significantly from typical range (€200-€800)
    if (numericAmount < 100 || numericAmount > 1000) {
      return true
    }
    return false
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    
    if (!validateAmount()) {
      return
    }
    
    const numericAmount = parseFloat(amount)
    
    // Show confirmation for unusual amounts
    if (checkForUnusualAmount(numericAmount) && !showConfirmation) {
      setShowConfirmation(true)
      return
    }
    
    setIsSubmitting(true)
    setError(null)
    
    try {
      await onSubmit(numericAmount)
      setAmount('')
      setShowConfirmation(false)
    } catch (error) {
      setError('Fehler beim Speichern des Kassenstands')
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
        Täglichen Kassenstand eingeben
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Erfassen Sie hier den Gesamtbetrag der Tageseinnahmen. 
        Aktuell: {getCurrentDateTime()}
      </Typography>

      <Paper elevation={2} sx={{ p: 3, maxWidth: 500 }}>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Kassenstand"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0,00"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Euro color="primary" />
                </InputAdornment>
              ),
              sx: {
                fontSize: '1.5rem',
                '& input': {
                  fontSize: '1.5rem',
                  textAlign: 'center',
                },
              },
            }}
            InputLabelProps={{
              sx: { fontSize: '1.1rem' },
            }}
            error={!!error}
            disabled={isSubmitting}
            sx={{ mb: 2 }}
            autoFocus
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
                Der eingegebene Betrag (€{parseFloat(amount).toFixed(2)}) weicht vom 
                üblichen Bereich ab. Möchten Sie fortfahren?
              </Typography>
            </Alert>
          )}
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            startIcon={<Save />}
            disabled={isSubmitting || !amount || !!error}
            sx={{ 
              py: 1.5,
              fontSize: '1.1rem',
            }}
          >
            {isSubmitting ? 'Speichere...' : 'Kassenstand speichern'}
          </Button>
        </form>
        
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Tipp: Verwenden Sie das Dezimalkomma (z.B. 425,75) oder den Punkt (425.75)
        </Typography>
      </Paper>
    </Box>
  )
}

export default CashEntryForm