'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Factory as ProductionIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  PlayArrow as PlayIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { apiClient } from '@bakery/shared/data-access'

export type ProductionStatus = 'planned' | 'in-progress' | 'completed'

export interface ProductionPlan {
  id: string
  date: string
  product: string
  quantity: number
  status: ProductionStatus | string
}

interface LowStockItem {
  id: string
  name: string
  stock: number
  minStock: number
  unit: string
}

const STATUS_LABELS: Record<string, string> = {
  planned: 'Geplant',
  'in-progress': 'In Produktion',
  completed: 'Abgeschlossen',
}

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'success'> = {
  planned: 'default',
  'in-progress': 'primary',
  completed: 'success',
}

const formatDate = (value: string) => {
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
}

const todayIso = () => new Date().toISOString().split('T')[0]

export default function AdminProductionPage() {
  const [plans, setPlans] = useState<ProductionPlan[]>([])
  const [lowStock, setLowStock] = useState<LowStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{
    message: string
    severity: 'success' | 'error'
  } | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [newProduct, setNewProduct] = useState('')
  const [newQuantity, setNewQuantity] = useState('')
  const [newDate, setNewDate] = useState(todayIso())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [plansRes, lowRes] = await Promise.all([
        apiClient.get<ProductionPlan[]>('/api/production'),
        apiClient
          .get<LowStockItem[]>('/api/inventory/low-stock')
          .catch(() => ({ data: [] as LowStockItem[] })),
      ])
      setPlans(Array.isArray(plansRes.data) ? plansRes.data : [])
      setLowStock(Array.isArray(lowRes.data) ? lowRes.data : [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Produktionsplan konnte nicht geladen werden'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const metrics = useMemo(() => {
    const total = plans.reduce((s, p) => s + (Number(p.quantity) || 0), 0)
    const completedUnits = plans
      .filter((p) => p.status === 'completed')
      .reduce((s, p) => s + (Number(p.quantity) || 0), 0)
    return {
      total,
      completedUnits,
      inProgress: plans.filter((p) => p.status === 'in-progress').length,
      planned: plans.filter((p) => p.status === 'planned').length,
      completed: plans.filter((p) => p.status === 'completed').length,
      progress: total > 0 ? Math.round((completedUnits / total) * 100) : 0,
    }
  }, [plans])

  const grouped = useMemo(() => {
    const map = new Map<string, ProductionPlan[]>()
    for (const p of plans) {
      const list = map.get(p.date) ?? []
      list.push(p)
      map.set(p.date, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : -1))
  }, [plans])

  const updateStatus = async (
    plan: ProductionPlan,
    status: ProductionStatus
  ) => {
    setBusyId(plan.id)
    try {
      const res = await apiClient.put<ProductionPlan>(
        `/api/production/${plan.id}`,
        { status }
      )
      const updated = res.data ?? { ...plan, status }
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)))
      setSnackbar({
        message: `${plan.product}: ${STATUS_LABELS[status]}`,
        severity: 'success',
      })
    } catch (err) {
      setSnackbar({
        message:
          err instanceof Error
            ? err.message
            : 'Status konnte nicht geändert werden',
        severity: 'error',
      })
    } finally {
      setBusyId(null)
    }
  }

  const removePlan = async (plan: ProductionPlan) => {
    if (!window.confirm(`Auftrag „${plan.product}“ wirklich löschen?`)) return
    setBusyId(plan.id)
    try {
      await apiClient.delete(`/api/production/${plan.id}`)
      setPlans((prev) => prev.filter((p) => p.id !== plan.id))
      setSnackbar({ message: 'Auftrag gelöscht', severity: 'success' })
    } catch (err) {
      setSnackbar({
        message: err instanceof Error ? err.message : 'Löschen fehlgeschlagen',
        severity: 'error',
      })
    } finally {
      setBusyId(null)
    }
  }

  const addPlan = async () => {
    const qty = Number(newQuantity)
    if (!newProduct.trim() || !qty || qty <= 0 || !newDate) return
    setSaving(true)
    try {
      const res = await apiClient.post<ProductionPlan>('/api/production', {
        product: newProduct.trim(),
        quantity: qty,
        date: newDate,
        status: 'planned',
      })
      if (res.data) setPlans((prev) => [...prev, res.data as ProductionPlan])
      setAddOpen(false)
      setNewProduct('')
      setNewQuantity('')
      setSnackbar({ message: 'Auftrag angelegt', severity: 'success' })
    } catch (err) {
      setSnackbar({
        message:
          err instanceof Error
            ? err.message
            : 'Auftrag konnte nicht angelegt werden',
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
            <ProductionIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Produktionsplanung
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title="Aktualisieren">
              <span>
                <IconButton
                  aria-label="Produktionsplan aktualisieren"
                  onClick={load}
                  disabled={loading}
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
            >
              Neuer Auftrag
            </Button>
          </Box>
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          Übersicht und Steuerung der Produktionsaufträge
        </Typography>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={load}>
              Erneut versuchen
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Production Metrics */}
      <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: { xs: 2, md: 3 }, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Fortschritt
            </Typography>
            <Typography variant="h3" component="div" sx={{ mb: 1 }}>
              {loading ? '–' : `${metrics.progress}%`}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={metrics.progress}
              sx={{ height: 10, borderRadius: 5 }}
              color="success"
              aria-label="Produktionsfortschritt"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {metrics.completedUnits} von {metrics.total} Stück produziert
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: { xs: 2, md: 3 }, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Aufträge
            </Typography>
            <Typography variant="h3" component="div" sx={{ mb: 1 }}>
              {loading ? '–' : plans.length}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={`${metrics.planned} geplant`}
                size="small"
                color="default"
              />
              <Chip
                label={`${metrics.inProgress} in Produktion`}
                size="small"
                color="primary"
              />
              <Chip
                label={`${metrics.completed} fertig`}
                size="small"
                color="success"
              />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: { xs: 2, md: 3 }, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Rohstoffe
            </Typography>
            {lowStock.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckIcon color="success" />
                <Typography variant="body2">
                  Alle Bestände über Mindestmenge
                </Typography>
              </Box>
            ) : (
              <>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
                >
                  <WarningIcon color="warning" />
                  <Typography variant="body2" fontWeight={600}>
                    {lowStock.length} Rohstoff
                    {lowStock.length === 1 ? '' : 'e'} unter Mindestbestand
                  </Typography>
                </Box>
                <List dense disablePadding>
                  {lowStock.map((item) => (
                    <ListItem key={item.id} disableGutters>
                      <ListItemText
                        primary={item.name}
                        secondary={`${item.stock} / min. ${item.minStock} ${item.unit}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Production Orders */}
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" gutterBottom>
          Produktionsaufträge
        </Typography>
        {loading ? (
          <Box
            sx={{ display: 'flex', justifyContent: 'center', p: 4 }}
            role="status"
            aria-label="Produktionsplan wird geladen"
          >
            <CircularProgress />
          </Box>
        ) : plans.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            Keine Produktionsaufträge vorhanden.
          </Typography>
        ) : (
          grouped.map(([date, dayPlans]) => (
            <Box key={date} sx={{ mb: 2 }}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mt: 1 }}
              >
                {formatDate(date)}
              </Typography>
              <List disablePadding>
                {dayPlans.map((plan) => {
                  const busy = busyId === plan.id
                  return (
                    <ListItem
                      key={plan.id}
                      divider
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {plan.status === 'planned' && (
                            <Tooltip title="Produktion starten">
                              <span>
                                <IconButton
                                  edge="end"
                                  aria-label={`${plan.product} starten`}
                                  disabled={busy}
                                  onClick={() =>
                                    updateStatus(plan, 'in-progress')
                                  }
                                >
                                  <PlayIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          {plan.status === 'in-progress' && (
                            <Tooltip title="Als fertig markieren">
                              <span>
                                <IconButton
                                  edge="end"
                                  color="success"
                                  aria-label={`${plan.product} abschließen`}
                                  disabled={busy}
                                  onClick={() =>
                                    updateStatus(plan, 'completed')
                                  }
                                >
                                  <CheckIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          <Tooltip title="Löschen">
                            <span>
                              <IconButton
                                edge="end"
                                aria-label={`${plan.product} löschen`}
                                disabled={busy}
                                onClick={() => removePlan(plan)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      }
                    >
                      <ListItemText
                        primaryTypographyProps={{ component: 'div' }}
                        secondaryTypographyProps={{ component: 'div' }}
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              flexWrap: 'wrap',
                              pr: 8,
                            }}
                          >
                            <Typography variant="subtitle1" component="span">
                              {plan.product}
                            </Typography>
                            <Chip
                              label={STATUS_LABELS[plan.status] ?? plan.status}
                              color={STATUS_COLORS[plan.status] ?? 'default'}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={`${plan.quantity} Stück`}
                      />
                    </ListItem>
                  )
                })}
              </List>
            </Box>
          ))
        )}
      </Paper>

      {/* Add plan dialog */}
      <Dialog
        open={addOpen}
        onClose={() => !saving && setAddOpen(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="add-production-title"
      >
        <DialogTitle id="add-production-title">
          Neuer Produktionsauftrag
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Produkt"
              value={newProduct}
              onChange={(e) => setNewProduct(e.target.value)}
              required
              autoFocus
              size="small"
            />
            <TextField
              label="Menge (Stück)"
              type="number"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              required
              size="small"
              inputProps={{ min: 1 }}
            />
            <TextField
              label="Datum"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={addPlan}
            disabled={
              saving || !newProduct.trim() || !(Number(newQuantity) > 0)
            }
          >
            {saving ? 'Speichern…' : 'Anlegen'}
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
