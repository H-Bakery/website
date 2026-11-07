'use client'

import React from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Grid,
  MenuItem,
  TextField,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import { PageSection } from '../../../components/layout'
import {
  CATEGORY_LABELS,
  displayImage,
  type ProductStatus,
} from '../../../lib/products'

/**
 * Felder eines Produkts - dieselbe Maske für „Neu“ und „Bearbeiten“, damit
 * beide gleich aussehen. Zwei Abschnitte (Verkauf, Texte und Bild) und unten
 * genau ein Knopf; zurück geht es über den Rücklink im Seitenkopf.
 */
export interface ProductFormValues {
  name: string
  category: string
  /** Text, wie getippt (deutsch „2,50“) - siehe `priceInput.ts`. */
  price: string
  status: ProductStatus
  image: string
  shortDescription: string
  description: string
}

export const STATUS_LABELS: Record<ProductStatus, string> = {
  active: 'Verfügbar',
  seasonal: 'Saisonal',
  unavailable: 'Nicht verfügbar',
}

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label })
)

export interface ProductFormProps {
  values: ProductFormValues
  onChange: (values: ProductFormValues) => void
  /** Nur ansehen (nicht Inhaber): Felder gesperrt, kein Knopf. */
  readOnly?: boolean
  /** Fehler am Preisfeld (Prüfung vor dem Senden). */
  priceError?: string | null
  submitLabel: string
  busyLabel: string
  busy: boolean
  onSubmit: () => void
  /** Kennung für die Label-IDs der Auswahlfelder. */
  idPrefix: string
  /**
   * Rückmeldung zum letzten Speichern - direkt über dem Knopf statt als
   * Snackbar: die lag am Handy 4 s lang über dem breiten Speichern-Knopf
   * und schluckte jeden Tipp darauf.
   */
  feedback?: { message: string; severity: 'success' | 'error' } | null
  onDismissFeedback?: () => void
}

export default function ProductForm({
  values,
  onChange,
  readOnly = false,
  priceError,
  submitLabel,
  busyLabel,
  busy,
  onSubmit,
  idPrefix,
  feedback,
  onDismissFeedback,
}: ProductFormProps) {
  const set =
    <K extends keyof ProductFormValues>(key: K) =>
    (value: ProductFormValues[K]) =>
      onChange({ ...values, [key]: value })
  const preview = displayImage(values.image.trim(), values.category)

  return (
    <>
      <PageSection title="Verkauf">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Produktname"
              required
              value={values.name}
              onChange={(e) => set('name')(e.target.value)}
              fullWidth
              disabled={readOnly}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Kategorie"
              value={values.category}
              onChange={(e) => set('category')(e.target.value)}
              fullWidth
              disabled={readOnly}
              id={`${idPrefix}-category`}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Preis (EUR)"
              required
              value={values.price}
              onChange={(e) => set('price')(e.target.value)}
              fullWidth
              disabled={readOnly}
              error={Boolean(priceError)}
              helperText={
                priceError || (values.price ? undefined : 'z. B. 2,50')
              }
              placeholder="0,00"
              inputProps={{ inputMode: 'decimal', autoComplete: 'off' }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Status"
              value={values.status}
              onChange={(e) => set('status')(e.target.value as ProductStatus)}
              fullWidth
              disabled={readOnly}
              id={`${idPrefix}-status`}
            >
              {(Object.keys(STATUS_LABELS) as ProductStatus[]).map((key) => (
                <MenuItem key={key} value={key}>
                  {STATUS_LABELS[key]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </PageSection>

      <PageSection
        title="Texte und Bild"
        description="Erscheinen im Shop und auf der Website."
      >
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Kurzbeschreibung"
              value={values.shortDescription}
              onChange={(e) => set('shortDescription')(e.target.value)}
              fullWidth
              disabled={readOnly}
              helperText="Ein Satz für Produktlisten."
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Beschreibung"
              value={values.description}
              onChange={(e) => set('description')(e.target.value)}
              fullWidth
              multiline
              minRows={4}
              maxRows={14}
              disabled={readOnly}
              helperText="Ausführlicher Text der Produktdatei."
            />
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Avatar
                src={preview || undefined}
                alt=""
                variant="rounded"
                sx={{
                  width: 56,
                  height: 56,
                  flexShrink: 0,
                  bgcolor: 'action.selected',
                  color: 'text.secondary',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                {values.name.charAt(0)}
              </Avatar>
              <TextField
                label="Bildpfad"
                value={values.image}
                onChange={(e) => set('image')(e.target.value)}
                fullWidth
                disabled={readOnly}
                placeholder="/assets/images/products/beispiel.svg"
                helperText="Leer lassen für das Bild der Kategorie."
              />
            </Box>
          </Grid>
        </Grid>
      </PageSection>

      {feedback && (
        <Alert
          severity={feedback.severity}
          onClose={onDismissFeedback}
          role={feedback.severity === 'error' ? 'alert' : 'status'}
        >
          {feedback.message}
        </Alert>
      )}

      {!readOnly && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            '@media print': { display: 'none' },
          }}
        >
          <Button
            variant="contained"
            size="large"
            onClick={onSubmit}
            startIcon={
              busy ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <SaveIcon />
              )
            }
            disabled={busy}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            {busy ? busyLabel : submitLabel}
          </Button>
        </Box>
      )}
    </>
  )
}
