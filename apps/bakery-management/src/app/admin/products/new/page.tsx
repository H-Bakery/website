'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import { apiClient } from '@bakery/shared/data-access'

const CATEGORY_OPTIONS = [
  { value: 'brot', label: 'Brot' },
  { value: 'broetchen', label: 'Brötchen' },
  { value: 'baguette', label: 'Baguette' },
  { value: 'teilchen', label: 'Teilchen' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'kuchen', label: 'Kuchen' },
  { value: 'torten', label: 'Torten' },
]

export default function NewProductPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('brot')
  const [price, setPrice] = useState('')
  const [image, setImage] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'active' | 'seasonal' | 'unavailable'>(
    'active'
  )
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{
    message: string
    severity: 'success' | 'error'
  } | null>(null)

  const handleCreate = async () => {
    const parsedPrice = parseFloat(price)
    if (!name.trim()) {
      setFeedback({
        message: 'Bitte einen Produktnamen angeben',
        severity: 'error',
      })
      return
    }
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setFeedback({
        message: 'Bitte einen gültigen Preis angeben',
        severity: 'error',
      })
      return
    }
    setSaving(true)
    try {
      const res = await apiClient.post<{ id: string }>('/api/hq-products', {
        name: name.trim(),
        category,
        price: parsedPrice,
        image: image.trim(),
        short_description: shortDescription.trim(),
        description,
        available: status !== 'unavailable',
        seasonal: status === 'seasonal',
      })

      if (!res.success) {
        throw new Error(res.error || res.message || 'Anlegen fehlgeschlagen')
      }

      setFeedback({ message: 'Produkt angelegt', severity: 'success' })
      router.refresh()
      const newId = res.data?.id
      router.push(newId ? `/admin/products/${newId}` : '/admin/products')
    } catch (err) {
      setFeedback({
        message: err instanceof Error ? err.message : 'Fehler beim Anlegen',
        severity: 'error',
      })
      setSaving(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ mt: 2, mb: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton
            onClick={() => router.push('/admin/products')}
            aria-label="Zurück zur Produktliste"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ ml: 1 }}>
            Neues Produkt anlegen
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Das Produkt wird als Markdown-Datei im HQ-Produktverzeichnis
          gespeichert. ID und Nummer werden automatisch aus dem Namen vergeben.
        </Alert>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Produktname"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel id="new-product-category-label">Kategorie</InputLabel>
              <Select
                labelId="new-product-category-label"
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
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              fullWidth
              size="small"
              type="number"
              inputProps={{ step: '0.01', min: '0' }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel id="new-product-status-label">Status</InputLabel>
              <Select
                labelId="new-product-status-label"
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
          <Grid item xs={12} sm={6}>
            <TextField
              label="Bildpfad"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              fullWidth
              size="small"
              placeholder="/assets/images/products/beispiel.svg"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Kurzbeschreibung"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              fullWidth
              size="small"
              helperText="Ein Satz — erscheint in Produktlisten und auf der Website."
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Beschreibung"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={6}
              size="small"
              helperText="Ausführlicher Text für die Produktdatei."
            />
          </Grid>
          <Grid item xs={12}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 2,
                mt: 1,
              }}
            >
              <Button
                variant="outlined"
                onClick={() => router.push('/admin/products')}
                startIcon={<ArrowBackIcon />}
              >
                Abbrechen
              </Button>
              <Button
                variant="contained"
                onClick={handleCreate}
                startIcon={
                  saving ? <CircularProgress size={18} /> : <SaveIcon />
                }
                disabled={saving}
              >
                {saving ? 'Anlegen...' : 'Produkt anlegen'}
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
