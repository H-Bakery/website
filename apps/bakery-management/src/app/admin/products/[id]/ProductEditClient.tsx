'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Alert,
  Box,
  Grid,
  TextField,
  Button,
  Paper,
  Chip,
  Avatar,
  IconButton,
  Snackbar,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import type { ManagementProduct } from '../../../../lib/products'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const statusLabels: Record<string, string> = {
  active: 'Verfügbar',
  seasonal: 'Saisonal',
  unavailable: 'Nicht verfügbar',
}

const statusColors: Record<string, 'success' | 'warning' | 'error'> = {
  active: 'success',
  seasonal: 'warning',
  unavailable: 'error',
}

const CATEGORY_OPTIONS = [
  { value: 'brot', label: 'Brot' },
  { value: 'broetchen', label: 'Brötchen' },
  { value: 'baguette', label: 'Baguette' },
  { value: 'teilchen', label: 'Teilchen' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'kuchen', label: 'Kuchen' },
  { value: 'torten', label: 'Torten' },
]

export default function ProductEditClient({
  productId,
  initialProduct,
}: {
  productId: string
  initialProduct?: ManagementProduct
}) {
  const router = useRouter()
  const [name, setName] = useState(initialProduct?.name ?? '')
  const [category, setCategory] = useState(initialProduct?.categoryKey ?? '')
  const [price, setPrice] = useState(initialProduct?.price?.toString() ?? '0')
  const [description, setDescription] = useState(
    initialProduct?.description ?? ''
  )
  const [status, setStatus] = useState(initialProduct?.status ?? 'active')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{
    message: string
    severity: 'success' | 'error'
  } | null>(null)

  if (!initialProduct) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">
          Produkt mit ID &quot;{productId}&quot; nicht gefunden.
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/admin/products')}
          sx={{ mt: 2 }}
        >
          Zurück zur Produktliste
        </Button>
      </Container>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/hq-products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          price: parseFloat(price),
          short_description: description,
          description,
          available: status !== 'unavailable',
          seasonal: status === 'seasonal',
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Speichern fehlgeschlagen')
      }

      setFeedback({
        message: 'Produkt erfolgreich gespeichert',
        severity: 'success',
      })
    } catch (err: any) {
      setFeedback({
        message: err.message || 'Fehler beim Speichern',
        severity: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ mt: 2, mb: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.back()} aria-label="back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ ml: 1 }}>
            Produkt bearbeiten
          </Typography>
          <Chip
            label={statusLabels[status] || status}
            color={statusColors[status] || 'default'}
            size="small"
            sx={{ ml: 2 }}
          />
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {initialProduct.image ? (
                <Box
                  component="img"
                  src={initialProduct.image}
                  alt={name}
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
              ) : (
                <Avatar
                  sx={{ width: 180, height: 180, mb: 2, fontSize: '4rem' }}
                  variant="rounded"
                >
                  {name.charAt(0)}
                </Avatar>
              )}
            </Box>
          </Grid>

          <Grid item xs={12} md={8}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Produktname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Kategorie</InputLabel>
                  <Select
                    value={category}
                    label="Kategorie"
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Preis (EUR)"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  type="number"
                  inputProps={{ step: '0.01', min: '0' }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={status}
                    label="Status"
                    onChange={(e) =>
                      setStatus(
                        e.target.value as 'active' | 'seasonal' | 'unavailable'
                      )
                    }
                  >
                    <MenuItem value="active">Verfügbar</MenuItem>
                    <MenuItem value="seasonal">Saisonal</MenuItem>
                    <MenuItem value="unavailable">Nicht verfügbar</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Beschreibung"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  variant="outlined"
                  size="small"
                />
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 2,
                mt: 2,
              }}
            >
              <Button
                variant="outlined"
                onClick={() => router.push('/admin/products')}
                startIcon={<ArrowBackIcon />}
              >
                Zurück
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                startIcon={
                  saving ? <CircularProgress size={18} /> : <SaveIcon />
                }
                disabled={saving}
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Snackbar
        open={feedback !== null}
        autoHideDuration={4000}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {feedback ? (
          <Alert
            severity={feedback.severity}
            onClose={() => setFeedback(null)}
            variant="filled"
          >
            {feedback.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Container>
  )
}
