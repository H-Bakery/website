'use client'
import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  Typography,
  InputAdornment,
} from '@mui/material'
import { Euro, Save, Cancel } from '@mui/icons-material'
import { CashEntry } from '@bakery/shared/types'
import { currencyUtils, dateUtils, validationUtils, errorUtils } from '@bakery/shared/utils'

interface EditCashEntryModalProps {
  open: boolean
  entry: CashEntry | null
  onClose: () => void
  onUpdate: (id: number, amount: number, date: string) => Promise<void>
}

const EditCashEntryModal: React.FC<EditCashEntryModalProps> = ({
  open,
  entry,
  onClose,
  onUpdate,
}) => {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when entry changes
  useEffect(() => {
    if (entry) {
      setAmount(entry.amount.toString())
      setDate(entry.date)
      setError(null)
    }
  }, [entry])

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setAmount('')
      setDate('')
      setError(null)
      setIsSubmitting(false)
    }
  }, [open])

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = currencyUtils.formatInput(event.target.value)
    setAmount(formattedValue)
    setError(null)
  }

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDate(event.target.value)
    setError(null)
  }

  const validateForm = (): boolean => {
    const numericAmount = currencyUtils.parse(amount)
    
    // Validate amount
    const amountValidation = validationUtils.validateAmount(numericAmount)
    if (!amountValidation.isValid) {
      setError(amountValidation.message!)
      return false
    }
    
    if (numericAmount > 9999.99) {
      setError('Der Betrag darf nicht größer als €9.999,99 sein')
      return false
    }

    if (!date) {
      setError('Bitte wählen Sie ein Datum')
      return false
    }

    // Validate date
    const dateValidation = validationUtils.validateDate(date)
    if (!dateValidation.isValid) {
      setError(dateValidation.message!)
      return false
    }

    return true
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    
    if (!entry || !validateForm()) {
      return
    }
    
    setIsSubmitting(true)
    setError(null)
    
    try {
      const numericAmount = currencyUtils.parse(amount)
      await onUpdate(entry.id, numericAmount, date)
      onClose()
    } catch (error) {
      console.error('Error updating cash entry:', error)
      setError(errorUtils.getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setError(null)
    onClose()
  }

  const hasChanges = () => {
    if (!entry) return false
    return amount !== entry.amount.toString() || date !== entry.date
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Euro color="primary" />
          <Typography variant="h6">
            Kassenstand bearbeiten
          </Typography>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Bearbeiten Sie den Kassenstand vom {entry ? dateUtils.formatWeekday(entry.date) + ', ' + dateUtils.formatDisplay(entry.date) : ''}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Betrag"
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
                  fontSize: '1.2rem',
                },
              }}
              InputLabelProps={{
                sx: { fontSize: '1rem' },
              }}
              disabled={isSubmitting}
              autoFocus
            />

            <TextField
              fullWidth
              label="Datum"
              type="date"
              value={date}
              onChange={handleDateChange}
              InputLabelProps={{
                shrink: true,
              }}
              disabled={isSubmitting}
              inputProps={{
                max: dateUtils.getCurrentDate(), // Prevent future dates
              }}
            />
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Hinweis: Das Datum kann nicht in der Zukunft liegen
          </Typography>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={handleCancel}
            disabled={isSubmitting}
            startIcon={<Cancel />}
          >
            Abbrechen
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || !hasChanges()}
            startIcon={<Save />}
          >
            {isSubmitting ? 'Speichere...' : 'Änderungen speichern'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default EditCashEntryModal