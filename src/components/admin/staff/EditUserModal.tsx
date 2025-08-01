import React, { useState, useEffect } from 'react'
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
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import bakeryAPI from '../../../services/bakeryAPI'

interface EditUserModalProps {
  open: boolean
  onClose: () => void
  onUserUpdated: () => void
  user: any
}

interface FormData {
  username: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'staff' | 'user'
  isActive: boolean
  password?: string
}

interface FormErrors {
  username?: string
  email?: string
  firstName?: string
  lastName?: string
  role?: string
  password?: string
}

export default function EditUserModal({
  open,
  onClose,
  onUserUpdated,
  user,
}: EditUserModalProps) {
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'staff',
    isActive: true,
    password: '',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const [changePassword, setChangePassword] = useState(false)

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role || 'staff',
        isActive: user.isActive !== false,
        password: '',
      })
      setChangePassword(false)
      setShowPassword(false)
    }
  }, [user])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.username.trim()) {
      newErrors.username = 'Benutzername ist erforderlich'
    } else if (formData.username.length < 3) {
      newErrors.username = 'Benutzername muss mindestens 3 Zeichen lang sein'
    }

    if (changePassword && formData.password) {
      if (formData.password.length < 6) {
        newErrors.password = 'Passwort muss mindestens 6 Zeichen lang sein'
      }
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
      const updateData: any = {
        username: formData.username,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,
        isActive: formData.isActive,
      }

      if (changePassword && formData.password) {
        updateData.password = formData.password
      }

      await bakeryAPI.updateStaff(user.id, updateData)
      onUserUpdated()
      handleClose()
    } catch (error: any) {
      setServerError(error.message || 'Fehler beim Aktualisieren des Benutzers')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setErrors({})
      setServerError('')
      setChangePassword(false)
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
      aria-labelledby="edit-user-dialog-title"
    >
      <DialogTitle id="edit-user-dialog-title">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Mitarbeiter bearbeiten
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

          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                disabled={loading}
              />
            }
            label="Aktiv"
          />

          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={changePassword}
                  onChange={(e) => {
                    setChangePassword(e.target.checked)
                    if (!e.target.checked) {
                      setFormData({ ...formData, password: '' })
                      setErrors({ ...errors, password: undefined })
                    }
                  }}
                  disabled={loading}
                />
              }
              label="Passwort ändern"
            />

            {changePassword && (
              <TextField
                label="Neues Passwort"
                type={showPassword ? 'text' : 'password'}
                fullWidth
                value={formData.password}
                onChange={handleChange('password')}
                error={!!errors.password}
                helperText={errors.password}
                disabled={loading}
                sx={{ mt: 2 }}
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
            )}
          </Box>

          {user && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Erstellt: {new Date(user.createdAt).toLocaleDateString('de-DE')}
                {user.lastLogin && (
                  <>
                    {' '}
                    | Letzte Anmeldung:{' '}
                    {new Date(user.lastLogin).toLocaleString('de-DE')}
                  </>
                )}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Abbrechen
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Speichere...' : 'Speichern'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}