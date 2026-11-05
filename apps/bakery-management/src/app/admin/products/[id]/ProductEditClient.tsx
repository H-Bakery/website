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
import { apiClient } from '@bakery/shared/data-access'
import {
  PENDING_APPROVAL_LABEL,
  pendingApprovalHint,
  toManagementProduct,
  type ApiHqProduct,
  type ManagementProduct,
} from '../../../../lib/products'
import { useOptionalSession } from '../../../../lib/session'

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
  // F4: schreiben darf nur der Inhaber (B5). Ohne Sitzung (Specs) wie bisher.
  const role = useOptionalSession()?.user?.role
  const canEdit = !role || role === 'inhaber'
  const [current, setCurrent] = useState<ManagementProduct | undefined>(
    initialProduct
  )
  const [name, setName] = useState(initialProduct?.name ?? '')
  const [category, setCategory] = useState(initialProduct?.categoryKey ?? '')
  const [price, setPrice] = useState(initialProduct?.price?.toString() ?? '0')
  const [shortDescription, setShortDescription] = useState(
    initialProduct?.shortDescription ?? ''
  )
  const [description, setDescription] = useState(
    initialProduct?.description ?? ''
  )
  const [image, setImage] = useState(initialProduct?.rawImage ?? '')
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
      const res = await apiClient.put<ApiHqProduct>(
        `/api/hq-products/${encodeURIComponent(productId)}`,
        {
          name: name.trim(),
          category,
          price: parsedPrice,
          short_description: shortDescription.trim(),
          description,
          image: image.trim(),
          available: status !== 'unavailable',
          seasonal: status === 'seasonal',
        }
      )

      if (!res.success) {
        throw new Error(res.error || res.message || 'Speichern fehlgeschlagen')
      }

      // B5: die Antwort trägt `pendingApproval` (und oben `pending`) - eine
      // Änderung wartet auf Freigabe, bis die rollende hq-PR gemergt ist.
      const pending =
        res.data?.pendingApproval === true ||
        (res as { pending?: unknown }).pending === true
      if (res.data) {
        // Die PUT-Antwort trägt kein `approved`. Freigegeben ist, was vor
        // dem ersten wartenden Speichern galt: der bisherige freigegebene
        // Stand, sonst der Stand vor diesem Speichern.
        const approved =
          !pending || !current
            ? null
            : current.pendingApproval
            ? current.approved
            : {
                name: current.name,
                price: current.price,
                status: current.status,
              }
        setCurrent({
          ...toManagementProduct({ ...res.data, pendingApproval: pending }),
          approved,
        })
      }
      setFeedback({
        message: pending
          ? 'Gespeichert - die Änderung wartet auf Freigabe.'
          : 'Produkt erfolgreich gespeichert',
        severity: 'success',
      })
    } catch (err) {
      setFeedback({
        message: err instanceof Error ? err.message : 'Fehler beim Speichern',
        severity: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  // An `image:` of "images/" is a placeholder in some HQ files; fall back to
  // whatever the loader resolved (category default) when the field is unusable.
  const previewImage =
    image.trim().length > 10 ? image.trim() : initialProduct.image

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
            Produkt bearbeiten
          </Typography>
          <Chip
            label={statusLabels[status] || status}
            color={statusColors[status] || 'default'}
            size="small"
            sx={{ ml: 2 }}
          />
          {current?.pendingApproval && (
            <Chip
              label={PENDING_APPROVAL_LABEL}
              color="info"
              variant="outlined"
              size="small"
              sx={{ ml: 1 }}
            />
          )}
        </Box>

        {current?.pendingApproval && (
          <Alert severity="info" sx={{ mb: 3 }}>
            {pendingApprovalHint(current)}
          </Alert>
        )}
        {!canEdit && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Produkte ändert nur der Inhaber. Die Angaben hier sind nur zum
            Ansehen.
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {previewImage ? (
                <Box
                  component="img"
                  src={previewImage}
                  alt={name}
                  sx={{
                    width: '100%',
                    maxWidth: '180px',
                    height: 'auto',
                    maxHeight: '180px',
                    objectFit: 'contain',
                    borderRadius: 1,
                    mb: 2,
                    border: '1px solid',
                    borderColor: 'divider',
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
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="product-category-label">Kategorie</InputLabel>
                  <Select
                    labelId="product-category-label"
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
                  <InputLabel id="product-status-label">Status</InputLabel>
                  <Select
                    labelId="product-status-label"
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
                  variant="outlined"
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
                  variant="outlined"
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
                  variant="outlined"
                  size="small"
                  helperText="Ausführlicher Text aus der Produktdatei."
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
              {canEdit && (
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
              )}
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
