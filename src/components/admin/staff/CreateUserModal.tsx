import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  IconButton,
  InputAdornment,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import bakeryAPI from '../../../services/bakeryAPI'

interface CreateUserModalProps {
  open: boolean
  onClose: () => void
  onUserCreated: () => void
}

interface FormData {
  username: string
  password: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'staff' | 'user'
}

interface FormErrors {
  username?: string
  password?: string
  email?: string
  firstName?: string
  lastName?: string
  role?: string
}

export default function CreateUserModal({
  open,
  onClose,
  onUserCreated,
}: CreateUserModalProps) {
  const [formData, setFormData] = useState<FormData>({
    username: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'staff',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.username.trim()) {
      newErrors.username = 'Benutzername ist erforderlich'
    } else if (formData.username.length < 3) {
      newErrors.username = 'Benutzername muss mindestens 3 Zeichen lang sein'
    }

    if (!formData.password) {
      newErrors.password = 'Passwort ist erforderlich'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Passwort muss mindestens 6 Zeichen lang sein'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'E-Mail ist erforderlich'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Ungültige E-Mail-Adresse'
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Vorname ist erforderlich'
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Nachname ist erforderlich'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    setServerError('')

    try {
      await bakeryAPI.createStaff(formData)
      onUserCreated()
      handleClose()
    } catch (error: any) {
      setServerError(error.message || 'Fehler beim Erstellen des Benutzers')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setFormData({
        username: '',
        password: '',
        email: '',
        firstName: '',
        lastName: '',
        role: 'staff',
      })
      setErrors({})
      setServerError('')
      setShowPassword(false)
      onClose()
    }
  }

  const handleChange = (field: keyof FormData) => (
    event: React.ChangeEvent<HTMLInputElement | { value: unknown }>
  ) => {
    setFormData({
      ...formData,
      [field]: event.target.value as string,
    })
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: undefined,
      })
    }
    setServerError('')
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="create-user-dialog-title"
    >
      <DialogTitle id="create-user-dialog-title">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Neuen Mitarbeiter hinzufügen
          <IconButton
            edge="end"
            color="inherit"
            onClick={handleClose}
            aria-label="close"
            disabled={loading}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {serverError && (
            <Box
              sx={{
                color: 'error.main',
                bgcolor: 'error.light',
                p: 2,
                borderRadius: 1,
                opacity: 0.1,
              }}
            >
              {serverError}
            </Box>
          )}

          <TextField
            label="Benutzername"
            fullWidth
            value={formData.username}
            onChange={handleChange('username')}
            error={!!errors.username}
            helperText={errors.username}
            disabled={loading}
            required
          />

          <TextField
            label="Passwort"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            value={formData.password}
            onChange={handleChange('password')}
            error={!!errors.password}
            helperText={errors.password}
            disabled={loading}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="E-Mail"
            type="email"
            fullWidth
            value={formData.email}
            onChange={handleChange('email')}
            error={!!errors.email}
            helperText={errors.email}
            disabled={loading}
            required
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Vorname"
              fullWidth
              value={formData.firstName}
              onChange={handleChange('firstName')}
              error={!!errors.firstName}
              helperText={errors.firstName}
              disabled={loading}
              required
            />

            <TextField
              label="Nachname"
              fullWidth
              value={formData.lastName}
              onChange={handleChange('lastName')}
              error={!!errors.lastName}
              helperText={errors.lastName}
              disabled={loading}
              required
            />
          </Box>

          <FormControl fullWidth error={!!errors.role} disabled={loading}>
            <InputLabel id="role-label">Rolle</InputLabel>
            <Select
              labelId="role-label"
              value={formData.role}
              label="Rolle"
              onChange={(e) => handleChange('role')(e as any)}
            >
              <MenuItem value="admin">Administrator</MenuItem>
              <MenuItem value="staff">Mitarbeiter</MenuItem>
              <MenuItem value="user">Benutzer</MenuItem>
            </Select>
            {errors.role && <FormHelperText>{errors.role}</FormHelperText>}
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Abbrechen
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Erstelle...' : 'Erstellen'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}