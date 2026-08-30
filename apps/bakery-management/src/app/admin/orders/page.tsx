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
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
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
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { apiClient } from '@bakery/shared/data-access'

export interface OrderItem {
  productId: string
  name: string
  quantity: number
  price: number
}

export interface Order {
  id: string
  customerName: string
  items: OrderItem[]
  total: number
  status: string
  createdAt: string
  updatedAt: string
}

type ChipColor =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'error'
  | 'info'
  | 'success'
  | 'warning'

const STATUS_OPTIONS: { value: string; label: string; color: ChipColor }[] = [
  { value: 'pending', label: 'Ausstehend', color: 'warning' },
  { value: 'processing', label: 'In Bearbeitung', color: 'info' },
  { value: 'ready', label: 'Bereit', color: 'primary' },
  { value: 'completed', label: 'Abgeschlossen', color: 'success' },
  { value: 'delivered', label: 'Geliefert', color: 'success' },
  { value: 'cancelled', label: 'Storniert', color: 'error' },
]

const statusLabel = (status: string) =>
  STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
const statusColor = (status: string): ChipColor =>
  STATUS_OPTIONS.find((s) => s.value === status)?.color ?? 'default'

const formatDate = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatPrice = (value: number) =>
  `${Number(value ?? 0)
    .toFixed(2)
    .replace('.', ',')} €`

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Order | null>(null)
  const [updating, setUpdating] = useState(false)
  const [snackbar, setSnackbar] = useState<{
    message: string
    severity: 'success' | 'error'
  } | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<Order[]>('/api/orders')
      setOrders(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Bestellungen konnten nicht geladen werden'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const filtered = useMemo(
    () =>
      statusFilter === 'all'
        ? orders
        : orders.filter((o) => o.status === statusFilter),
    [orders, statusFilter]
  )

  const handleStatusChange = async (order: Order, status: string) => {
    setUpdating(true)
    try {
      const res = await apiClient.put<Order>(`/api/orders/${order.id}`, {
        status,
      })
      const updated = res.data ?? { ...order, status }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)))
      setSelected(updated)
      setSnackbar({ message: 'Status aktualisiert', severity: 'success' })
    } catch (err) {
      setSnackbar({
        message:
          err instanceof Error
            ? err.message
            : 'Status konnte nicht aktualisiert werden',
        severity: 'error',
      })
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Box>
      <Box
        sx={{
          mb: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: { xs: 1.5, sm: 2 },
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}
        >
          Bestellungen
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="order-status-filter-label">Status</InputLabel>
            <Select
              labelId="order-status-filter-label"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">Alle</MenuItem>
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Aktualisieren">
            <span>
              <IconButton
                aria-label="Bestellungen aktualisieren"
                onClick={loadOrders}
                disabled={loading}
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={loadOrders}>
              Erneut versuchen
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Paper elevation={2}>
        {loading ? (
          <Box
            sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
            role="status"
            aria-label="Bestellungen werden geladen"
          >
            <CircularProgress />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {orders.length === 0
                ? 'Keine Bestellungen vorhanden.'
                : 'Keine Bestellungen mit diesem Status.'}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nr.</TableCell>
                  <TableCell>Kunde</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    Datum
                  </TableCell>
                  <TableCell
                    sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                    align="right"
                  >
                    Artikel
                  </TableCell>
                  <TableCell align="right">Gesamt</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((order) => (
                  <TableRow
                    key={order.id}
                    hover
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell component="th" scope="row">
                      #{order.id}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ maxWidth: { xs: 100, sm: 200 } }}
                      >
                        {order.customerName}
                      </Typography>
                    </TableCell>
                    <TableCell
                      sx={{ display: { xs: 'none', md: 'table-cell' } }}
                    >
                      {formatDate(order.createdAt)}
                    </TableCell>
                    <TableCell
                      sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                      align="right"
                    >
                      {order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" noWrap>
                        {formatPrice(order.total)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabel(order.status)}
                        color={statusColor(order.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        aria-label={`Bestellung ${order.id} anzeigen`}
                        onClick={() => setSelected(order)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {!loading && !error && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Zeige {filtered.length} von {orders.length} Bestellungen
          </Typography>
        </Box>
      )}

      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="order-detail-title"
      >
        {selected && (
          <>
            <DialogTitle id="order-detail-title">
              Bestellung #{selected.id}
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="subtitle2" color="text.secondary">
                Kunde
              </Typography>
              <Typography gutterBottom>{selected.customerName}</Typography>
              <Typography variant="subtitle2" color="text.secondary">
                Bestellt am
              </Typography>
              <Typography gutterBottom>
                {formatDate(selected.createdAt)}
              </Typography>

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" color="text.secondary">
                Artikel
              </Typography>
              <List dense disablePadding>
                {(selected.items ?? []).map((item, idx) => (
                  <ListItem key={`${item.productId}-${idx}`} disableGutters>
                    <ListItemText
                      primary={`${item.quantity} × ${item.name}`}
                      secondary={formatPrice(item.price * item.quantity)}
                    />
                  </ListItem>
                ))}
              </List>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 1 }}>
                Gesamt: {formatPrice(selected.total)}
              </Typography>

              <Divider sx={{ my: 1.5 }} />
              <FormControl size="small" fullWidth disabled={updating}>
                <InputLabel id="order-status-label">Status</InputLabel>
                <Select
                  labelId="order-status-label"
                  label="Status"
                  value={
                    STATUS_OPTIONS.some((s) => s.value === selected.status)
                      ? selected.status
                      : ''
                  }
                  onChange={(e) =>
                    handleStatusChange(selected, String(e.target.value))
                  }
                >
                  {STATUS_OPTIONS.map((s) => (
                    <MenuItem key={s.value} value={s.value}>
                      {s.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelected(null)}>Schließen</Button>
            </DialogActions>
          </>
        )}
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
