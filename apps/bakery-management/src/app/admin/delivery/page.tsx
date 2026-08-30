'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
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
  Tooltip,
  Typography,
} from '@mui/material'
import {
  LocalShipping as DeliveryIcon,
  Refresh as RefreshIcon,
  TaskAlt as DeliveredIcon,
  Inventory as ReadyIcon,
} from '@mui/icons-material'
import { apiClient } from '@bakery/shared/data-access'

interface OrderItem {
  productId: string
  name: string
  quantity: number
  price: number
}

export interface DeliveryOrder {
  id: string
  customerName: string
  items: OrderItem[]
  total: number
  status: string
  createdAt: string
  updatedAt: string
}

type DeliveryStage = 'preparing' | 'ready' | 'delivered' | 'other'

const stageOf = (status: string): DeliveryStage => {
  switch (status) {
    case 'pending':
    case 'processing':
      return 'preparing'
    case 'ready':
      return 'ready'
    case 'delivered':
    case 'completed':
      return 'delivered'
    default:
      return 'other'
  }
}

const STAGE_LABELS: Record<DeliveryStage, string> = {
  preparing: 'In Vorbereitung',
  ready: 'Bereit zur Auslieferung',
  delivered: 'Zugestellt',
  other: 'Storniert',
}

const STAGE_COLORS: Record<
  DeliveryStage,
  'default' | 'primary' | 'success' | 'warning' | 'error'
> = {
  preparing: 'warning',
  ready: 'primary',
  delivered: 'success',
  other: 'error',
}

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
}

export default function AdminDeliveryPage() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{
    message: string
    severity: 'success' | 'error'
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<DeliveryOrder[]>('/api/orders')
      setOrders(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Lieferungen konnten nicht geladen werden'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const deliveries = useMemo(
    () => orders.filter((o) => stageOf(o.status) !== 'other'),
    [orders]
  )
  const counts = useMemo(
    () => ({
      preparing: deliveries.filter((o) => stageOf(o.status) === 'preparing')
        .length,
      ready: deliveries.filter((o) => stageOf(o.status) === 'ready').length,
      delivered: deliveries.filter((o) => stageOf(o.status) === 'delivered')
        .length,
    }),
    [deliveries]
  )
  const progress =
    deliveries.length > 0
      ? Math.round((counts.delivered / deliveries.length) * 100)
      : 0

  const setStatus = async (order: DeliveryOrder, status: string) => {
    setBusyId(order.id)
    try {
      const res = await apiClient.put<DeliveryOrder>(
        `/api/orders/${order.id}`,
        { status }
      )
      const updated = res.data ?? { ...order, status }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)))
      setSnackbar({
        message: `Bestellung #${order.id}: ${STAGE_LABELS[stageOf(status)]}`,
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
            <DeliveryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Lieferungen
          </Typography>
          <Tooltip title="Aktualisieren">
            <span>
              <IconButton
                aria-label="Lieferungen aktualisieren"
                onClick={load}
                disabled={loading}
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          Lieferstatus der Bestellungen verwalten
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

      {/* Delivery Overview */}
      <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: { xs: 2, md: 3 }, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              In Vorbereitung
            </Typography>
            <Typography variant="h3" color="warning.main">
              {loading ? '–' : counts.preparing}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Werden noch gepackt
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: { xs: 2, md: 3 }, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Bereit
            </Typography>
            <Typography variant="h3" color="primary">
              {loading ? '–' : counts.ready}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Bereit für Auslieferung
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: { xs: 2, md: 3 }, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Zugestellt
            </Typography>
            <Typography variant="h3" color="success.main">
              {loading ? '–' : counts.delivered}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Erfolgreich abgeschlossen
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Delivery List */}
      <Paper elevation={2}>
        {loading ? (
          <Box
            sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
            role="status"
            aria-label="Lieferungen werden geladen"
          >
            <CircularProgress />
          </Box>
        ) : deliveries.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              Keine Lieferungen vorhanden.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Bestellung</TableCell>
                  <TableCell>Kunde</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    Bestellt
                  </TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deliveries.map((order) => {
                  const stage = stageOf(order.status)
                  const busy = busyId === order.id
                  const itemCount = (order.items ?? []).reduce(
                    (s, i) => s + i.quantity,
                    0
                  )
                  return (
                    <TableRow
                      key={order.id}
                      hover
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          #{order.id}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {itemCount} Artikel
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {order.customerName}
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: 'none', md: 'table-cell' } }}
                      >
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={STAGE_LABELS[stage]}
                          color={STAGE_COLORS[stage]}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        {stage === 'preparing' && (
                          <Tooltip title="Als bereit markieren">
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                aria-label={`Bestellung ${order.id} als bereit markieren`}
                                disabled={busy}
                                onClick={() => setStatus(order, 'ready')}
                              >
                                <ReadyIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {stage === 'ready' && (
                          <Tooltip title="Als zugestellt markieren">
                            <span>
                              <IconButton
                                size="small"
                                color="success"
                                aria-label={`Bestellung ${order.id} als zugestellt markieren`}
                                disabled={busy}
                                onClick={() => setStatus(order, 'delivered')}
                              >
                                <DeliveredIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {stage === 'delivered' && (
                          <Typography variant="caption" color="text.secondary">
                            –
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {!loading && deliveries.length > 0 && (
        <Box
          sx={{
            mt: 3,
            p: { xs: 2, md: 3 },
            bgcolor: 'action.hover',
            borderRadius: 1,
          }}
        >
          <Typography variant="subtitle1" gutterBottom>
            Tagesfortschritt
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
            aria-label="Anteil zugestellter Lieferungen"
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: 'block' }}
          >
            {progress}% der Lieferungen zugestellt ({counts.delivered} von{' '}
            {deliveries.length})
          </Typography>
        </Box>
      )}

      <Alert severity="info" sx={{ mt: 3 }}>
        Fahrerzuordnung, Lieferadressen und Routenplanung sind noch nicht an das
        Backend angebunden. Hier lässt sich derzeit nur der Lieferstatus der
        Bestellungen pflegen.
      </Alert>

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
