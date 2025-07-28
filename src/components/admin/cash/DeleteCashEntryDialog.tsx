'use client'
import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material'
import { Warning, Delete, Cancel } from '@mui/icons-material'
import { CashEntry } from '../../../services/types'

interface DeleteCashEntryDialogProps {
  open: boolean
  entry: CashEntry | null
  onClose: () => void
  onDelete: (id: number) => Promise<void>
}

const DeleteCashEntryDialog: React.FC<DeleteCashEntryDialogProps> = ({
  open,
  entry,
  onClose,
  onDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!entry) return
    
    setIsDeleting(true)
    setError(null)
    
    try {
      await onDelete(entry.id)
      onClose()
    } catch (error) {
      console.error('Error deleting cash entry:', error)
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('Fehler beim Löschen des Kassenstands')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancel = () => {
    if (!isDeleting) {
      setError(null)
      onClose()
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
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
          <Warning color="error" />
          <Typography variant="h6">
            Kassenstand löschen
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body1" sx={{ mb: 2 }}>
          Möchten Sie diesen Kassenstand wirklich löschen?
        </Typography>

        {entry && (
          <Box 
            sx={{ 
              p: 2, 
              border: 1, 
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              mb: 2
            }}
          >
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Betrag:</strong> {formatCurrency(entry.amount)}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Datum:</strong> {formatDate(entry.date)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Erfasst am:</strong> {new Date(entry.createdAt).toLocaleString('de-DE')}
            </Typography>
          </Box>
        )}

        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Achtung:</strong> Diese Aktion kann nicht rückgängig gemacht werden. 
            Der Kassenstand wird dauerhaft aus der Datenbank entfernt.
          </Typography>
        </Alert>

        <Typography variant="body2" color="text.secondary">
          Wenn Sie sich nicht sicher sind, können Sie den Eintrag stattdessen bearbeiten, 
          um Korrekturen vorzunehmen.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button
          onClick={handleCancel}
          disabled={isDeleting}
          startIcon={<Cancel />}
        >
          Abbrechen
        </Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          color="error"
          disabled={isDeleting}
          startIcon={<Delete />}
        >
          {isDeleting ? 'Lösche...' : 'Endgültig löschen'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DeleteCashEntryDialog