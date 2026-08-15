'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Inventory2 as InventoryIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  SwapVert as AdjustIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { apiClient } from '@bakery/shared/data-access'

export interface InventoryItem {
  id: string
  name: string
  category: string
  unit: string
  stock: number
  minStock: number
  supplier?: string
  lastRestocked?: string
}

interface NewItemForm {
  name: string
  category: string
  unit: string
  stock: string
  minStock: string
  supplier: string
}

const EMPTY_FORM: NewItemForm = {
  name: '',
  category: '',
  unit: 'kg',
  stock: '0',
  minStock: '0',
  supplier: '',
}

const formatDate = (value?: string) => {
  if (!value) return '–'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('de-DE')
}

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{
    message: string
    severity: 'success' | 'error'
  } | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<NewItemForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null)
  const [adjustment, setAdjustment] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<InventoryItem[]>('/api/inventory')
      setItems(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Lagerbestand konnte nicht geladen werden'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const lowStockItems = useMemo(
    () => items.filter((i) => i.stock <= i.minStock),
    [items]
  )

  const lastUpdate = useMemo(() => {
    const dates = items
      .map((i) => i.lastRestocked)
      .filter((d): d is string => !!d)
      .sort()
    return dates.length ? formatDate(dates[dates.length - 1]) : '–'
  }, [items])

  const handleAdd = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await apiClient.post<InventoryItem>('/api/inventory', {
        name: form.name.trim(),
        category: form.category.trim(),
        unit: form.unit.trim() || 'kg',
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 0,
        supplier: form.supplier.trim(),
      })
      if (res.data) setItems((prev) => [...prev, res.data as InventoryItem])
      setAddOpen(false)
      setForm(EMPTY_FORM)
      setSnackbar({ message: 'Artikel angelegt', severity: 'success' })
    } catch (err) {
      setSnackbar({
        message:
          err instanceof Error
            ? err.message
            : 'Artikel konnte nicht angelegt werden',
        severity: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAdjust = async () => {
    if (!adjustItem) return
    const delta = Number(adjustment)
    if (!delta) return
    setSaving(true)
    try {
      const res = await apiClient.post<InventoryItem>(
        `/api/inventory/${adjustItem.id}/adjust`,
        { adjustment: delta, reason: adjustReason }
      )
      const updated = res.data ?? {
        ...adjustItem,
        stock: adjustItem.stock + delta,
      }
      setItems((prev) =>
        prev.map((i) => (i.id === adjustItem.id ? updated : i))
      )
      setAdjustItem(null)
      setAdjustment('')
      setAdjustReason('')
      setSnackbar({ message: 'Bestand angepasst', severity: 'success' })
    } catch (err) {
      setSnackbar({
        message:
          err instanceof Error
            ? err.message
            : 'Bestand konnte nicht angepasst werden',
        severity: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: { xs: 2, md: 4 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 1.5,
            mb: 1,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}
          >
            <InventoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Inventar & Lagerbestand
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title="Aktualisieren">
              <span>
                <IconButton
                  aria-label="Lagerbestand aktualisieren"
                  onClick={loadItems}
                  disabled={loading}
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              color="primary"
              onClick={() => setAddOpen(true)}
            >
              Neuer Artikel
            </Button>
          </Box>
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          Übersicht und Verwaltung der Lagerbestände und Rohstoffe
        </Typography>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={loadItems}>
              Erneut versuchen
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 2,
          mb: { xs: 2, md: 4 },
        }}
      >
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" gutterBottom>
            Gesamtartikel
          </Typography>
          <Typography variant="h3" color="primary">
            {loading ? '–' : items.length}
          </Typography>
        </Paper>
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" gutterBottom>
            Niedrige Bestände
          </Typography>
          <Typography variant="h3" color="warning.main">
            {loading ? '–' : lowStockItems.length}
          </Typography>
        </Paper>
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" gutterBottom>
            Letzte Lieferung
          </Typography>
          <Typography variant="h5" color="text.secondary">
            {loading ? '–' : lastUpdate}
          </Typography>
        </Paper>
      </Box>

      {/* Inventory Table */}
      <Paper elevation={2}>
        {loading ? (
          <Box
            sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
            role="status"
            aria-label="Lagerbestand wird geladen"
          >
            <CircularProgress />
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              Keine Artikel im Lager. Legen Sie mit „Neuer Artikel“ den ersten
              Artikel an.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Artikel</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    Kategorie
                  </TableCell>
                  <TableCell align="right">Bestand</TableCell>
                  <TableCell
                    align="right"
                    sx={{ display: { xs: 'none', md: 'table-cell' } }}
                  >
                    Min. Bestand
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                    Lieferant
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                    Letzte Lieferung
                  </TableCell>
                  <TableCell align="center">Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  const isLow = item.stock <= item.minStock
                  const percentage =
                    item.minStock > 0
                      ? (item.stock / (item.minStock * 2)) * 100
                      : 100

                  return (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        {item.name}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: { xs: 'block', sm: 'none' } }}
                        >
                          {item.category}
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                      >
                        {item.category}
                      </TableCell>
                      <TableCell align="right">
                        <Box
                          component="span"
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            color: isLow ? 'warning.main' : 'inherit',
                            fontWeight: isLow ? 600 : 400,
                          }}
                        >
                          {isLow && (
                            <WarningIcon
                              fontSize="small"
                              color="warning"
                              titleAccess="Niedriger Bestand"
                            />
                          )}
                          {item.stock} {item.unit}
                        </Box>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ display: { xs: 'none', md: 'table-cell' } }}
                      >
                        {item.minStock} {item.unit}
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: 'none', md: 'table-cell' } }}
                      >
                        <Box sx={{ width: 100 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(Math.max(percentage, 0), 100)}
                            color={isLow ? 'warning' : 'success'}
                            sx={{ height: 8, borderRadius: 4 }}
                            aria-label={`Bestandsstand ${item.name}`}
                          />
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: 'none', lg: 'table-cell' } }}
                      >
                        {item.supplier || '–'}
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: 'none', lg: 'table-cell' } }}
                      >
                        {formatDate(item.lastRestocked)}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Bestand anpassen">
                          <IconButton
                            size="small"
                            color="primary"
                            aria-label={`Bestand von ${item.name} anpassen`}
                            onClick={() => {
                              setAdjustItem(item)
                              setAdjustment('')
                              setAdjustReason('')
                            }}
                          >
                            <AdjustIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Low Stock Alert */}
      {!loading && lowStockItems.length > 0 && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          {lowStockItems.length === 1
            ? `1 Artikel (${lowStockItems[0].name}) hat einen niedrigen Lagerbestand.`
            : `${
                lowStockItems.length
              } Artikel haben einen niedrigen Lagerbestand: ${lowStockItems
                .map((i) => i.name)
                .join(', ')}.`}{' '}
          Bitte rechtzeitig nachbestellen.
        </Alert>
      )}

      {/* Add Item Dialog */}
      <Dialog
        open={addOpen}
        onClose={() => !saving && setAddOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="add-inventory-title"
      >
        <DialogTitle id="add-inventory-title">Neuer Artikel</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              mt: 1,
            }}
          >
            <TextField
              label="Bezeichnung"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
              size="small"
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
            <TextField
              label="Kategorie"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              size="small"
            />
            <TextField
              label="Einheit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              size="small"
            />
            <TextField
              label="Bestand"
              type="number"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              size="small"
              inputProps={{ min: 0, step: 'any' }}
            />
            <TextField
              label="Mindestbestand"
              type="number"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              size="small"
              inputProps={{ min: 0, step: 'any' }}
            />
            <TextField
              label="Lieferant"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              size="small"
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={saving || !form.name.trim()}
          >
            {saving ? 'Speichern…' : 'Anlegen'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog
        open={adjustItem !== null}
        onClose={() => !saving && setAdjustItem(null)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="adjust-inventory-title"
      >
        <DialogTitle id="adjust-inventory-title">
          Bestand anpassen{adjustItem ? `: ${adjustItem.name}` : ''}
        </DialogTitle>
        <DialogContent>
          {adjustItem && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Aktueller Bestand: {adjustItem.stock} {adjustItem.unit}
            </Typography>
          )}
          <TextField
            label="Änderung (+ Zugang / − Abgang)"
            type="number"
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            fullWidth
            size="small"
            autoFocus
            inputProps={{ step: 'any' }}
            sx={{ mb: 2 }}
            helperText={
              adjustItem && adjustment
                ? `Neuer Bestand: ${adjustItem.stock + Number(adjustment)} ${
                    adjustItem.unit
                  }`
                : ' '
            }
          />
          <TextField
            label="Grund (optional)"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            fullWidth
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustItem(null)} disabled={saving}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={handleAdjust}
            disabled={saving || !Number(adjustment)}
          >
            {saving ? 'Speichern…' : 'Übernehmen'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert
            severity={snackbar.severity}
            variant="filled"
            onClose={() => setSnackbar(null)}
          >
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}
