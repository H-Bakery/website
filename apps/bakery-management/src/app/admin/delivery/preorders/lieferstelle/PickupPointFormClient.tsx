'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
} from '@mui/icons-material'
import { useOptionalSession } from '../../../../../lib/session'
import {
  fetchPickupPoints,
  preorderErrorMessage,
  savePickupPoint,
} from '../../../../../lib/preordersApi'
import type { PickupPointInput } from '../../../../../lib/preordersTypes'
import {
  DELIVERY_WEEKDAY_LABELS,
  PickupPoint,
  formatPickupAddress,
  hasPickupAddress,
} from '../preorderTypes'

const LIST_HREF = '/admin/delivery/preorders'

const messageOf = preorderErrorMessage

export interface PickupPointFormClientProps {
  /** Sammelstelle aus der URL - sonst die erste aktive. */
  initialPickupPointId?: string
}

/**
 * Stammdaten einer Sammelstelle: Adresse, Liefertag, Übergabefenster,
 * Bestellschluss.
 *
 * Seit P2 über `PUT /api/preorders/pickup-points/:id` - ändern darf nur der
 * Inhaber (API: 403), alle anderen sehen die Stammdaten. Die echte API sucht
 * keine Koordinaten (kein Nominatim auf der Box): eine geänderte Adresse
 * verliert ihre Koordinaten, die Abholliste druckt die Adresse als Text.
 */
export default function PickupPointFormClient({
  initialPickupPointId,
}: PickupPointFormClientProps) {
  const router = useRouter()
  const session = useOptionalSession()
  const canEdit = session?.user?.role === 'inhaber'

  const [points, setPoints] = useState<PickupPoint[]>([])
  const [pointId, setPointId] = useState(initialPickupPointId ?? '')
  const [name, setName] = useState('')
  const [street, setStreet] = useState('')
  const [zip, setZip] = useState('')
  const [city, setCity] = useState('')
  const [weekday, setWeekday] = useState(6)
  const [handoverWindow, setHandoverWindow] = useState('')
  const [deadlineWeekday, setDeadlineWeekday] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  const [notes, setNotes] = useState('')
  const [active, setActive] = useState(true)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const point = useMemo(
    () => points.find((p) => p.id === pointId) ?? null,
    [points, pointId]
  )

  const apply = useCallback((next: PickupPoint) => {
    setPointId(next.id)
    setName(next.name ?? '')
    setStreet(next.street ?? '')
    setZip(next.zip ?? '')
    setCity(next.city ?? '')
    setWeekday(Number.isFinite(next.weekday) ? next.weekday : 6)
    setHandoverWindow(next.window ?? '')
    setDeadlineWeekday(
      next.orderDeadline ? String(next.orderDeadline.weekday) : ''
    )
    setDeadlineTime(next.orderDeadline ? next.orderDeadline.time : '')
    setNotes(next.notes ?? '')
    setActive(next.active !== false)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await fetchPickupPoints()
      setPoints(list)
      const first =
        list.find((p) => p.id === initialPickupPointId) ??
        list.find((p) => p.active !== false) ??
        list[0] ??
        null
      if (first) apply(first)
    } catch (err) {
      setLoadError(
        messageOf(err, 'Die Sammelstelle konnte nicht geladen werden')
      )
    } finally {
      setLoading(false)
    }
  }, [initialPickupPointId, apply])

  useEffect(() => {
    load()
  }, [load])

  const handleSubmit = async () => {
    setSaveError(null)
    setSaved(false)
    if (!pointId) return

    // Bestellschluss ist entweder ganz gesetzt oder gar nicht - ein halber
    // Eintrag ergäbe eine Uhrzeit ohne Tag.
    const hasDeadline = deadlineWeekday !== '' && deadlineTime !== ''
    const payload: PickupPointInput = {
      name: name.trim(),
      street: street.trim(),
      zip: zip.trim(),
      city: city.trim(),
      weekday,
      window: handoverWindow.trim() || null,
      orderDeadline: hasDeadline
        ? { weekday: Number(deadlineWeekday), time: deadlineTime }
        : null,
      notes: notes.trim() || null,
      active,
    }

    setSaving(true)
    try {
      const updated = await savePickupPoint(pointId, payload)
      setPoints((current) =>
        current.map((p) => (p.id === updated.id ? updated : p))
      )
      apply(updated)
      setSaved(true)
      router.refresh()
    } catch (err) {
      setSaveError(
        messageOf(err, 'Die Sammelstelle konnte nicht gespeichert werden')
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
        role="status"
        aria-label="Sammelstelle wird geladen"
      >
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
        <IconButton
          aria-label="Zurück zur Liste"
          onClick={() => router.push(LIST_HREF)}
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontSize: { xs: '1.35rem', md: '1.75rem' } }}
          >
            Sammelstelle
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {!point
              ? 'Keine Sammelstelle angelegt'
              : hasPickupAddress(point)
              ? formatPickupAddress(point)
              : `Straße noch nicht hinterlegt${
                  point.city ? ` · ${point.city}` : ''
                }`}
          </Typography>
        </Box>
      </Box>

      {loadError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={load}>
              Erneut versuchen
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {!loadError && !point && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Es ist keine Sammelstelle angelegt.
        </Alert>
      )}

      {saved && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSaved(false)}
        >
          Die Sammelstelle wurde gespeichert.
        </Alert>
      )}
      {!canEdit && point && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nur der Inhaber kann die Sammelstelle ändern.
        </Alert>
      )}
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveError}
        </Alert>
      )}

      {point && (
        <>
          {points.length > 1 && (
            <TextField
              select
              label="Sammelstelle"
              value={pointId}
              onChange={(event) => {
                const next = points.find((p) => p.id === event.target.value)
                if (next) apply(next)
              }}
              size="small"
              sx={{ mb: 2, minWidth: 240 }}
            >
              {points.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Straße und Hausnummer"
                  value={street}
                  onChange={(event) => setStreet(event.target.value)}
                  fullWidth
                  size="small"
                  helperText="Steht auf der Abholliste."
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField
                  label="PLZ"
                  value={zip}
                  onChange={(event) => setZip(event.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Ort"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  select
                  label="Liefertag"
                  value={String(weekday)}
                  onChange={(event) => setWeekday(Number(event.target.value))}
                  fullWidth
                  size="small"
                >
                  {Object.entries(DELIVERY_WEEKDAY_LABELS).map(
                    ([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    )
                  )}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Übergabefenster"
                  value={handoverWindow}
                  onChange={(event) => setHandoverWindow(event.target.value)}
                  fullWidth
                  size="small"
                  placeholder="09:00-09:30"
                  helperText="Format HH:MM-HH:MM"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  select
                  label="Bestellschluss am"
                  value={deadlineWeekday}
                  onChange={(event) => setDeadlineWeekday(event.target.value)}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="">Kein Bestellschluss</MenuItem>
                  {Object.entries(DELIVERY_WEEKDAY_LABELS).map(
                    ([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    )
                  )}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Bestellschluss um"
                  type="time"
                  value={deadlineTime}
                  onChange={(event) => setDeadlineTime(event.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Notizen"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  fullWidth
                  size="small"
                  multiline
                  minRows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={active}
                      onChange={(event) => setActive(event.target.checked)}
                    />
                  }
                  label="Aktiv"
                />
              </Grid>
            </Grid>
          </Paper>

          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
            <Button onClick={() => router.push(LIST_HREF)} disabled={saving}>
              Abbrechen
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSubmit}
              disabled={saving || !canEdit}
            >
              Speichern
            </Button>
          </Box>
        </>
      )}
    </Box>
  )
}
