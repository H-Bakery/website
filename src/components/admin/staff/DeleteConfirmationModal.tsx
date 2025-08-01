import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import bakeryAPI from '../../../services/bakeryAPI'

interface DeleteConfirmationModalProps {
  open: boolean
  onClose: () => void
  onUserDeleted: () => void
  user: any
}

export default function DeleteConfirmationModal({
  open,
  onClose,
  onUserDeleted,
  user,
}: DeleteConfirmationModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    if (!user) return

    setLoading(true)
    setError('')

    try {
      await bakeryAPI.deleteStaff(user.id)
      onUserDeleted()
      handleClose()
    } catch (error: any) {
      setError(error.message || 'Fehler beim Löschen des Benutzers')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setError('')
      onClose()
    }
  }

  if (!user) return null

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
    >
      <DialogTitle id="delete-dialog-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="warning" />
          Mitarbeiter löschen
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <DialogContentText id="delete-dialog-description">
          Sind Sie sicher, dass Sie den folgenden Mitarbeiter löschen möchten?
        </DialogContentText>
        
        <Box
          sx={{
            mt: 2,
            p: 2,
            bgcolor: 'background.default',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold">
            {user.firstName} {user.lastName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Benutzername: {user.username}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            E-Mail: {user.email}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Rolle: {getRoleLabel(user.role)}
          </Typography>
        </Box>
        
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Hinweis:</strong> Der Benutzer wird nicht physisch gelöscht, 
            sondern nur deaktiviert. Die Daten bleiben für Audit-Zwecke erhalten.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Abbrechen
        </Button>
        <Button
          onClick={handleDelete}
          color="error"
          variant="contained"
          disabled={loading}
        >
          {loading ? 'Lösche...' : 'Löschen'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'admin':
      return 'Administrator'
    case 'staff':
      return 'Mitarbeiter'
    case 'user':
      return 'Benutzer'
    default:
      return role
  }
}