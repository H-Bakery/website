'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Remove as RemoveIcon,
  Save as SaveIcon,
} from '@mui/icons-material'
import {
  createPreorder,
  fetchAvailableProducts,
  fetchPickupPoints,
  fetchPreorder,
  fetchPreorderSummary,
  updatePreorder,
} from './preorderApi'
import {
  DELIVERY_WEEKDAY_LABELS,
  PREORDER_STATUS_LABELS,
  PickupPoint,
  Preorder,
  PreorderPayload,
  PreorderProduct,
  PreorderStatus,
  deadlineNotice,
  deliveryWeekdayOf,
  formatCurrency,
  formatDate,
  formatPickupAddress,
  hasPickupAddress,
  isBusinessDate,
  nextDeliveryDate,
  previewLineTotal,
  previewTotal,
} from './preorderTypes'

/** Samstag - der Liefertag, solange keine Sammelstelle geladen ist. */
const DEFAULT_WEEKDAY = 6

/** Grenzen der API - hier gespiegelt, damit die Maske vorher warnt. */
const MAX_QTY_PER_ITEM = 99

const LIST_HREF = '/admin/delivery/preorders'

/** Die Status, die von Hand gesetzt werden - storniert wird in der Liste. */
const EDITABLE_STATUS: PreorderStatus[] = [
  'open',
  'handed_over',
  'not_collected',
]

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/** Eine Position der Maske. `known: false` = nicht mehr im HQ-Sortiment. */
interface RowState {
  productId: string
  name: string
  unitPrice: number
  qty: number
  known: boolean
}

export interface PreorderFormClientProps {
  /** Liefertag aus der URL. */
  initialDate?: string
  /** Sammelstelle aus der URL. */
  initialPickupPointId?: string
  /** Gesetzt, wenn eine bestehende Vorbestellung bearbeitet wird. */
  preorderId?: number
}

export default function PreorderFormClient({
  initialDate,
  initialPickupPointId,
  preorderId,
}: PreorderFormClientProps) {
  const router = useRouter()
  const isEditing = typeof preorderId === 'number'

  const [points, setPoints] = useState<PickupPoint[]>([])
  const [pointId, setPointId] = useState(initialPickupPointId ?? '')
  const [products, setProducts] = useState<PreorderProduct[]>([])

  // Leer starten: der Vorgabetag kommt aus der Uhr und stünde sonst schon im
  // SSR-HTML - das bricht die Hydration.
  const [date, setDate] = useState(initialDate ?? '')
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<PreorderStatus>('open')
  const [rows, setRows] = useState<RowState[]>([])
  const [picked, setPicked] = useState<PreorderProduct | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState<Preorder | null>(null)
  const [now, setNow] = useState<Date | null>(null)
  const [deadline, setDeadline] = useState<string | null>(null)

  const point = useMemo(
    () => points.find((p) => p.id === pointId) ?? null,
    [points, pointId]
  )

  /* ------------------------------------------------------------------ *
   * Sammelstellen, Sortiment und - beim Bearbeiten - die Bestellung.
   * ------------------------------------------------------------------ */
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [pointList, productList, preorder] = await Promise.all([
        fetchPickupPoints(),
        fetchAvailableProducts(),
        isEditing ? fetchPreorder(preorderId) : Promise.resolve(null),
      ])
      setPoints(pointList)
      setProducts(productList)

      const known = new Map(productList.map((p) => [p.productId, p]))

      if (preorder) {
        setExisting(preorder)
        setPointId(preorder.pickupPointId)
        setDate(preorder.date)
        setCustomer(preorder.customer)
        setPhone(preorder.phone ?? '')
        setNote(preorder.note ?? '')
        setStatus(preorder.status)
        // Positionen mit ihrem gespeicherten Preis-Snapshot anzeigen. Ein
        // Produkt, das es in `hq` nicht mehr gibt, bleibt sichtbar - sonst
        // verschwände seine Menge beim Speichern stillschweigend.
        setRows(
          (preorder.items ?? []).map((item) => ({
            productId: item.productId,
            name: item.name,
            unitPrice: item.unitPrice,
            qty: item.qty,
            known: known.has(item.productId),
          }))
        )
      } else {
        const first =
          pointList.find((p) => p.id === initialPickupPointId) ??
          pointList.find((p) => p.active !== false) ??
          pointList[0] ??
          null
        if (first) setPointId(first.id)
        setDate((current) =>
          isBusinessDate(current)
            ? current
            : nextDeliveryDate(first ? first.weekday : DEFAULT_WEEKDAY)
        )
      }
      setNow(new Date())
    } catch (err) {
      setLoadError(messageOf(err, 'Die Maske konnte nicht geladen werden'))
    } finally {
      setLoading(false)
    }
  }, [isEditing, preorderId, initialPickupPointId])

  useEffect(() => {
    load()
  }, [load])

  /* ------------------------------------------------------------------ *
   * Positionen
   * ------------------------------------------------------------------ */
  const addProduct = (product: PreorderProduct | null) => {
    if (!product) return
    setFormError(null)
    setRows((current) => {
      const index = current.findIndex((r) => r.productId === product.productId)
      if (index >= 0) {
        // Zweimal dasselbe Produkt ergibt keine zweite Zeile, sondern eins mehr.
        const next = [...current]
        next[index] = {
          ...next[index],
          qty: Math.min(MAX_QTY_PER_ITEM, next[index].qty + 1),
        }
        return next
      }
      return [
        ...current,
        {
          productId: product.productId,
          name: product.name,
          unitPrice: product.price,
          qty: 1,
          known: true,
        },
      ]
    })
    setPicked(null)
  }

  const changeQty = (productId: string, value: number) => {
    setRows((current) =>
      current.map((row) =>
        row.productId === productId
          ? { ...row, qty: Math.max(0, Math.min(MAX_QTY_PER_ITEM, value)) }
          : row
      )
    )
  }

  const removeRow = (productId: string) => {
    setRows((current) => current.filter((row) => row.productId !== productId))
  }

  /* ------------------------------------------------------------------ *
   * Bestellschluss des gewählten Liefertags
   * ------------------------------------------------------------------ */
  // Er wird auf dem Server gerechnet (`deadlineFor()`) und kommt mit der
  // Tagesauswertung - auch beim Neuanlegen, wo es noch keine Bestellung gibt,
  // aus der man ihn ablesen könnte. Genau dann wird er gebraucht: bei der
  // Telefonbestellung am Samstagmorgen ist er längst vorbei.
  useEffect(() => {
    if (!isBusinessDate(date)) {
      setDeadline(null)
      return
    }
    let active = true
    fetchPreorderSummary(date, pointId || undefined)
      .then((sum) => {
        if (!active) return
        setDeadline(sum?.deadline ?? null)
        setNow(new Date())
      })
      // Der Bestellschluss ist ein Hinweis, kein Hindernis - fällt der Aufruf
      // aus, bleibt die Maske ohne ihn bedienbar.
      .catch(() => {
        if (active) setDeadline(null)
      })
    return () => {
      active = false
    }
  }, [date, pointId])

  const total = previewTotal(rows)
  const weekday = isBusinessDate(date) ? deliveryWeekdayOf(date) : null
  const wrongWeekday =
    point != null && weekday != null && weekday !== point.weekday
  const notice = now ? deadlineNotice(deadline, now) : null

  // Aus einer stornierten Bestellung führt nur der Weg zurück auf „Offen":
  // sie direkt auf „Übergeben" zu setzen, lehnt der Server ab.
  const statusOptions: PreorderStatus[] =
    existing?.status === 'cancelled' ? ['open', 'cancelled'] : EDITABLE_STATUS

  const options = useMemo(
    () =>
      products.filter(
        (product) => !rows.some((row) => row.productId === product.productId)
      ),
    [products, rows]
  )

  /* ------------------------------------------------------------------ *
   * Speichern
   * ------------------------------------------------------------------ */
  const handleSubmit = async () => {
    setFormError(null)
    setSaveError(null)

    if (!customer.trim()) {
      setFormError('Der Name des Kunden ist erforderlich.')
      return
    }
    if (!isBusinessDate(date)) {
      setFormError('Das Datum muss im Format JJJJ-MM-TT angegeben werden.')
      return
    }
    const items = rows
      .filter((row) => row.qty > 0)
      .map((row) => ({ productId: row.productId, qty: row.qty }))
    if (items.length === 0) {
      setFormError('Eine Vorbestellung braucht mindestens eine Position.')
      return
    }

    const payload: PreorderPayload = {
      date,
      customer: customer.trim(),
      phone: phone.trim() || null,
      note: note.trim() || null,
      items,
    }

    setSaving(true)
    try {
      if (isEditing) {
        // Den Status nur mitschicken, wenn er in dieser Maske geändert wurde.
        // Sonst überschriebe ein Speichern um 09:05 das „Übergeben", das der
        // Fahrer um 09:03 abgehakt hat - der Wert stammt vom Seitenaufruf.
        await updatePreorder(
          preorderId,
          status === existing?.status ? payload : { ...payload, status }
        )
      } else {
        await createPreorder({
          ...payload,
          pickupPointId: pointId || undefined,
        })
      }
      // Zurück auf den Liefertag der Bestellung, nicht auf heute - sonst sucht
      // das Team die eben erfasste Bestellung in der falschen Liste.
      // `saving` bleibt absichtlich stehen: der Knopf ist bis zum Seitenwechsel
      // gesperrt, eine zweite Bestellung kann so nicht entstehen.
      router.push(`${LIST_HREF}?date=${date}&saved=1`)
      router.refresh()
    } catch (err) {
      setSaveError(
        messageOf(err, 'Die Vorbestellung konnte nicht gespeichert werden')
      )
      setSaving(false)
    }
  }

  const backHref = `${LIST_HREF}${isBusinessDate(date) ? `?date=${date}` : ''}`

  if (loading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
        role="status"
        aria-label="Maske wird geladen"
      >
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Kopf */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
        <IconButton
          aria-label="Zurück zur Liste"
          onClick={() => router.push(backHref)}
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
            {isEditing ? 'Vorbestellung bearbeiten' : 'Vorbestellung erfassen'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {existing ? `${existing.reference} · ` : ''}
            {point ? point.name : 'Sammelstelle'}
            {isBusinessDate(date)
              ? ` · ${
                  weekday != null ? `${DELIVERY_WEEKDAY_LABELS[weekday]}, ` : ''
                }${formatDate(date)}`
              : ''}
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

      {point && !hasPickupAddress(point) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Für {point.name} ist noch keine Straße hinterlegt - die Bestellung
          lässt sich trotzdem erfassen, die Fahrer-App findet aber keinen
          Kartenpunkt.
        </Alert>
      )}

      {notice && (
        <Alert severity={notice.passed ? 'warning' : 'info'} sx={{ mb: 2 }}>
          {notice.text}
          {notice.passed
            ? ' Später erfasste Bestellungen sind trotzdem gültig - sie werden als „Nach Bestellschluss" markiert.'
            : ''}
        </Alert>
      )}

      {wrongWeekday && point && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Der {formatDate(date)} ist kein{' '}
          {DELIVERY_WEEKDAY_LABELS[point.weekday] ?? 'Liefertag'} - an diesem
          Tag wird nicht zu {point.name} geliefert.
        </Alert>
      )}

      {/* Kunde */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Kunde
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Name"
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
              required
              fullWidth
              size="small"
              autoFocus
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Telefon"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              fullWidth
              size="small"
              inputProps={{ inputMode: 'tel' }}
              helperText="Für den Rückruf, wenn etwas fehlt"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Liefertag"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          {points.length > 1 && (
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Sammelstelle"
                value={pointId}
                onChange={(event) => setPointId(event.target.value)}
                fullWidth
                size="small"
                disabled={isEditing}
                helperText={
                  isEditing
                    ? 'Die Sammelstelle einer erfassten Bestellung bleibt stehen.'
                    : undefined
                }
              >
                {points.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
          {isEditing && (
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as PreorderStatus)
                }
                fullWidth
                size="small"
              >
                {statusOptions.map((value) => (
                  <MenuItem key={value} value={value}>
                    {PREORDER_STATUS_LABELS[value]}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
          <Grid item xs={12}>
            <TextField
              label="Anmerkung"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={2}
            />
          </Grid>
        </Grid>
        {point && formatPickupAddress(point) && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1.5, display: 'block' }}
          >
            Übergabe: {formatPickupAddress(point)}
            {point.window ? ` · ${point.window} Uhr` : ''}
          </Typography>
        )}
      </Paper>

      {/* Positionen */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Positionen
        </Typography>

        <Autocomplete
          options={options}
          value={picked}
          onChange={(_event, value) => addProduct(value)}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) =>
            option.productId === value.productId
          }
          noOptionsText="Kein Produkt gefunden"
          renderInput={(params) => (
            <TextField
              {...params}
              label="Artikel suchen und hinzufügen"
              size="small"
              placeholder="z. B. Bauernbrot"
            />
          )}
          sx={{ mb: 2 }}
        />

        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Noch keine Position - oben ein Produkt suchen.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {rows.map((row) => (
              <Box
                key={row.productId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Box sx={{ flexGrow: 1, minWidth: 140 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {row.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatCurrency(row.unitPrice)} / Stück
                    {row.known ? '' : ' · nicht mehr im Sortiment'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <IconButton
                    aria-label={`Menge verringern: ${row.name}`}
                    onClick={() => changeQty(row.productId, row.qty - 1)}
                    sx={{
                      minWidth: 44,
                      minHeight: 44,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <TextField
                    value={String(row.qty)}
                    onChange={(event) =>
                      changeQty(
                        row.productId,
                        Number(event.target.value.replace(/\D/g, '') || 0)
                      )
                    }
                    size="small"
                    sx={{ width: 72 }}
                    inputProps={{
                      inputMode: 'numeric',
                      pattern: '[0-9]*',
                      'aria-label': `Menge in Stück: ${row.name}`,
                      style: { textAlign: 'center' },
                    }}
                  />
                  <IconButton
                    aria-label={`Menge erhöhen: ${row.name}`}
                    onClick={() => changeQty(row.productId, row.qty + 1)}
                    sx={{
                      minWidth: 44,
                      minHeight: 44,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Typography
                  variant="body2"
                  sx={{ minWidth: 90, textAlign: 'right', fontWeight: 600 }}
                >
                  {formatCurrency(previewLineTotal(row.qty, row.unitPrice))}
                </Typography>
                <Tooltip title="Position entfernen">
                  <IconButton
                    aria-label={`Position entfernen: ${row.name}`}
                    onClick={() => removeRow(row.productId)}
                    sx={{ minWidth: 44, minHeight: 44 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      {formError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {formError}
        </Alert>
      )}
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveError}
        </Alert>
      )}

      {/* Summe und Speichern */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          position: 'sticky',
          bottom: 0,
          zIndex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 160 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Summe
          </Typography>
          <Typography variant="h6" data-testid="preorder-total">
            {formatCurrency(total)}
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={() => router.push(backHref)} disabled={saving}>
          Abbrechen
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSubmit}
          disabled={saving}
        >
          {isEditing ? 'Änderungen speichern' : 'Vorbestellung speichern'}
        </Button>
      </Paper>
    </Box>
  )
}
