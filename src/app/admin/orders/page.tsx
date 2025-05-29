'use client'
import React, { useState, useEffect, useCallback } from 'react'
import {
  Alert,
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  CircularProgress,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tab,
  Tabs,
  Button as MuiButton,
  useTheme,
  alpha,
  Badge,
  useMediaQuery,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import { useRouter } from 'next/navigation'
import AddIcon from '@mui/icons-material/Add'
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek'
import TableViewIcon from '@mui/icons-material/TableView'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import FilterListIcon from '@mui/icons-material/FilterList'
import NotificationsIcon from '@mui/icons-material/Notifications'
import Button from '../../../components/button/Index'
import DataTable from '../../../components/dashboard/DataTable'
import bakeryAPI from '../../../services/bakeryAPI'
import OrderForm from '../../../components/orders/OrderForm'
import QuickOrderForm from '../../../components/orders/QuickOrderForm'
import WeeklyCalendar from '../../../components/orders/weekly-view/WeeklyCalendar'
import OrderDetailDialog from '../../../components/orders/weekly-view/OrderDetailDialog'
import OrderDetailView from '../../../components/orders/OrderDetailView'
import { Order, OrderItem, Product } from '../../../services/types'

// Define the order status type that the form expects
type OrderStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled'

// Define view modes
type ViewMode = 'weekly' | 'table' | 'form' | 'detail'

// Define the form-specific order type
interface FormOrder {
  id?: string | number
  customerName: string
  customerPhone?: string
  customerEmail?: string
  pickupDate: string | Date
  status: OrderStatus
  notes?: string
  totalPrice: number
  items: OrderItem[]
}

// Map API order to form order
const mapOrderToFormOrder = (Order: Order): FormOrder => {
  return {
    ...Order,
    status: Order.status as OrderStatus,
  }
}

// Create default order
const createDefaultOrder = (): FormOrder => {
  return {
    customerName: '',
    items: [],
    totalPrice: 0,
    status: 'Pending',
    pickupDate: new Date().toISOString(),
  }
}

interface TableRow {
  id: string | number
  customerName: string
  date: string
  status: string
  totalItems: number
  totalPrice: string
}

interface ColumnFormat {
  id: string
  label: string
  minWidth?: number
  align?: 'right' | 'left' | 'center'
  format?: (value: any) => React.ReactNode
}

const OrderManagement: React.FC = () => {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [loading, setLoading] = useState<boolean>(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('weekly')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [showQuickOrderForm, setShowQuickOrderForm] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState<boolean>(false)
  const [isDetailView, setIsDetailView] = useState<boolean>(false)

  // Fetch orders and products with useCallback
  const fetchData = useCallback(async () => {
    try {
      const [ordersData, productsData] = await Promise.all([
        bakeryAPI.getOrders(),
        bakeryAPI.getProducts(),
      ])

      setOrders(ordersData)
      setFilteredOrders(ordersData)
      setProducts(productsData)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred'
      console.error('Error fetching data:', errorMessage)
      setError(`Failed to load data: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // Filter orders when status filter changes
  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredOrders(orders)
    } else {
      setFilteredOrders(orders.filter((order) => order.status === statusFilter))
    }
  }, [statusFilter, orders])

  // Use the memoized fetchData in useEffect
  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleNavigateBack = useCallback(() => {
    router.push('/admin/dashboard')
  }, [router])

  const handleViewModeChange = (
    _event: React.SyntheticEvent,
    newMode: ViewMode
  ) => {
    setViewMode(newMode)
  }

  const handleAddOrder = useCallback(() => {
    setSelectedOrder(null)
    setViewMode('detail')
  }, [])

  const handleEditOrder = useCallback((order: Order) => {
    setSelectedOrder(order)
    setViewMode('form')
  }, [])

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date)
  }, [])

  const handleQuickAdd = useCallback((date: Date) => {
    setSelectedDate(date)
    setShowQuickOrderForm(true)
  }, [])

  const handleOrderClick = useCallback((order: Order) => {
    setSelectedOrder(order)
    setViewMode('detail')
  }, [])

  const handleShowDeleteDialog = useCallback(
    (orderId: string | number) => {
      const orderToRemove = orders.find((order) => order.id === orderId)
      if (orderToRemove) {
        setOrderToDelete(orderToRemove)
        setDeleteDialogOpen(true)
      }
    },
    [orders]
  )

  const handleCloseForm = useCallback(() => {
    setViewMode('weekly')
    setSelectedOrder(null)
    setShowQuickOrderForm(false)
    setIsDetailView(false)
  }, [])

  const handleSaveOrder = useCallback(
    async (orderData: Partial<Order>) => {
      // Convert FormOrder back to Order if needed
      const OrderData: Partial<Order> = orderData
      setLoading(true)
      setError(null)

      try {
        let updatedOrder: Order

        if (selectedOrder) {
          // Update existing order
          updatedOrder = (await bakeryAPI.updateOrder(
            selectedOrder.id,
            orderData
          )) as Order

          setOrders((prevOrders) =>
            prevOrders.map((order) =>
              order.id === selectedOrder.id ? updatedOrder : order
            )
          )
        } else {
          // Create new order
          updatedOrder = (await bakeryAPI.createOrder(orderData)) as Order
          setOrders((prevOrders) => [...prevOrders, updatedOrder])
        }

        setViewMode('weekly')
        setSelectedOrder(null)
        setShowQuickOrderForm(false)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred'
        setError(`Failed to save order: ${errorMessage}`)
      } finally {
        setLoading(false)
      }
    },
    [selectedOrder]
  )

  const handleDeleteOrder = useCallback(async (orderId: string | number) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      setLoading(true)
      setError(null)

      try {
        await bakeryAPI.deleteOrder(orderId)
        setOrders((prevOrders) =>
          prevOrders.filter((order) => order.id !== orderId)
        )
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred'
        console.error('Error deleting order:', errorMessage)
        setError(`Failed to delete order: ${errorMessage}`)
      } finally {
        setLoading(false)
      }
    }
  }, [])

  const handleGenerateBakingList = useCallback(() => {
    router.push('/admin/orders/baking-list')
  }, [router])

  const formatOrders = () => {
    return orders.map((order) => {
      // Safely calculate totalItems with fallback to 0
      const totalItems = order?.items
        ? order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
        : 0

      // Format the price with fallback
      const priceStr = order?.totalPrice
        ? `$${order.totalPrice.toFixed(2)}`
        : '$0.00'

      return {
        id: order?.id,
        customerName: order?.customerName || 'Unknown',
        date: order?.pickupDate
          ? new Date(order.pickupDate).toLocaleDateString()
          : 'No date',
        status: order?.status || 'Unknown',
        totalItems,
        totalPrice: priceStr,
      }
    })
  }

  if (loading) {
    return (
      <Container
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '60vh',
        }}
      >
        <CircularProgress />
      </Container>
    )
  }

  {
    /* Define table columns with proper typing */
  }
  const columns: ColumnFormat[] = [
    { id: 'id', label: 'Bestell-ID', minWidth: 80 },
    { id: 'customerName', label: 'Kunde', minWidth: 150 },
    { id: 'date', label: 'Abholung', minWidth: 120 },
    {
      id: 'status',
      label: 'Status',
      minWidth: 120,
      format: (value: string) => (
        <Chip
          label={
            value === 'Pending'
              ? 'Ausstehend'
              : value === 'Confirmed'
              ? 'Bestätigt'
              : value === 'Completed'
              ? 'Abgeschlossen'
              : value === 'Cancelled'
              ? 'Storniert'
              : value
          }
          color={
            value === 'Pending'
              ? 'warning'
              : value === 'Confirmed'
              ? 'primary'
              : value === 'Completed'
              ? 'success'
              : value === 'Cancelled'
              ? 'error'
              : 'default'
          }
          size="small"
        />
      ),
    },
    {
      id: 'totalItems',
      label: 'Artikel',
      minWidth: 80,
      align: 'right',
    },
    {
      id: 'totalPrice',
      label: 'Gesamt',
      minWidth: 100,
      align: 'right',
    },
    {
      id: 'actions',
      label: 'Aktionen',
      minWidth: 220,
      align: 'center',
      // Use type assertion to make TypeScript accept our format function
      format: ((value: any, row: any) => {
        // Make sure row exists
        if (!row) return null

        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={() => {
                // Use the row ID to find the original order
                const orderToView = orders.find((o) => o.id === row.id)
                if (orderToView) {
                  handleOrderClick(orderToView)
                }
              }}
            >
              Details
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                // Use the row ID to find the original order
                const orderToEdit = orders.find((o) => o.id === row.id)
                if (orderToEdit) {
                  handleEditOrder(orderToEdit)
                }
              }}
            >
              Bearbeiten
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => handleShowDeleteDialog(row.id)}
            >
              Löschen
            </Button>
          </Box>
        )
      }) as (value: any) => React.ReactNode,
    },
  ]

  return (
    <Container maxWidth="xl">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          mb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="h5"
            fontWeight={600}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            Bestellungen
            <Badge
              badgeContent={orders.length}
              color="primary"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.7rem',
                  height: '18px',
                  minWidth: '18px',
                },
              }}
            />
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {!isMobile && viewMode === 'weekly' && (
            <FormControl size="small" variant="outlined" sx={{ minWidth: 120 }}>
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
                size="small"
                startAdornment={
                  <FilterListIcon fontSize="small" sx={{ mr: 0.5 }} />
                }
              >
                <MenuItem value="all">Alle Status</MenuItem>
                <MenuItem value="Pending">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" color="warning" label="Ausstehend" />
                    <Typography variant="body2">Ausstehend</Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="Confirmed">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" color="primary" label="Bestätigt" />
                    <Typography variant="body2">Bestätigt</Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="Completed">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" color="success" label="Abgeschlossen" />
                    <Typography variant="body2">Abgeschlossen</Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="Cancelled">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" color="error" label="Storniert" />
                    <Typography variant="body2">Storniert</Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          )}

          <MuiButton
            variant="outlined"
            size="small"
            color="inherit"
            startIcon={<InsertDriveFileIcon />}
            onClick={handleGenerateBakingList}
          >
            Backliste
          </MuiButton>

          {viewMode !== 'form' && (
            <MuiButton
              variant="contained"
              size="small"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddOrder}
            >
              Neue Bestellung
            </MuiButton>
          )}
        </Box>
      </Box>

      <Box sx={{ width: '100%', mb: 3 }}>
        <Paper
          sx={{
            borderRadius: 1,
            bgcolor: alpha(theme.palette.background.paper, 0.7),
          }}
          elevation={0}
        >
          <Tabs
            value={viewMode}
            onChange={handleViewModeChange}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              icon={<CalendarViewWeekIcon />}
              label="Wochenübersicht"
              value="weekly"
              iconPosition="start"
              disabled={viewMode === 'detail'}
            />
            <Tab
              icon={<TableViewIcon />}
              label="Tabelle"
              value="table"
              iconPosition="start"
              disabled={viewMode === 'detail'}
            />
          </Tabs>
        </Paper>
      </Box>

      {showQuickOrderForm ? (
        <QuickOrderForm
          products={products}
          selectedDate={selectedDate}
          onSave={handleSaveOrder}
          onCancel={() => setShowQuickOrderForm(false)}
        />
      ) : viewMode === 'form' ? (
        <OrderForm
          products={products}
          order={
            selectedOrder
              ? mapOrderToFormOrder(selectedOrder)
              : createDefaultOrder()
          }
          onSave={handleSaveOrder}
          onCancel={handleCloseForm}
        />
      ) : viewMode === 'detail' && selectedOrder && isDetailView ? (
        <Box>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 3,
              bgcolor: alpha(theme.palette.info.main, 0.08),
              borderLeft: `4px solid ${theme.palette.info.main}`,
              borderRadius: 1,
            }}
          >
            <Typography>
              Sie sehen die detaillierte Ansicht für Bestellung #
              {selectedOrder.id} von Kunde{' '}
              <strong>{selectedOrder.customerName}</strong>.
            </Typography>
          </Paper>
          <OrderDetailView
            order={selectedOrder}
            products={products}
            onSave={handleSaveOrder}
            onDelete={handleShowDeleteDialog}
            onCancel={handleCloseForm}
          />
        </Box>
      ) : viewMode === 'weekly' ? (
        <WeeklyCalendar
          orders={filteredOrders}
          onDateSelect={handleDateSelect}
          onOrderClick={handleOrderClick}
          onAddOrder={handleQuickAdd}
          onDeleteOrder={handleShowDeleteDialog}
        />
      ) : (
        <>
          <Box sx={{ mb: 2, display: { xs: 'block', md: 'none' } }}>
            <FormControl size="small" variant="outlined" fullWidth>
              <InputLabel id="mobile-status-filter-label">
                Status Filter
              </InputLabel>
              <Select
                labelId="mobile-status-filter-label"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status Filter"
                size="small"
              >
                <MenuItem value="all">Alle Status</MenuItem>
                <MenuItem value="Pending">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" color="warning" label="Ausstehend" />
                    <Typography variant="body2">Ausstehend</Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="Confirmed">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" color="primary" label="Bestätigt" />
                    <Typography variant="body2">Bestätigt</Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="Completed">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" color="success" label="Abgeschlossen" />
                    <Typography variant="body2">Abgeschlossen</Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="Cancelled">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" color="error" label="Storniert" />
                    <Typography variant="body2">Storniert</Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>

          <DataTable
            title="Bestellungen"
            subtitle={`${filteredOrders.length} Kundenbestellung${
              filteredOrders.length !== 1 ? 'en' : ''
            } ${
              statusFilter !== 'all'
                ? `(Status: ${
                    statusFilter === 'Pending'
                      ? 'Ausstehend'
                      : statusFilter === 'Confirmed'
                      ? 'Bestätigt'
                      : statusFilter === 'Completed'
                      ? 'Abgeschlossen'
                      : statusFilter === 'Cancelled'
                      ? 'Storniert'
                      : statusFilter
                  })`
                : ''
            }`}
            columns={columns}
            data={formatOrders()}
            searchEnabled={true}
            emptyMessage="Keine Bestellungen vorhanden"
          />
        </>
      )}

      {/* Quick action button for mobile when in weekly view */}
      {viewMode === 'weekly' && isMobile && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 10,
          }}
        >
          <MuiButton
            variant="contained"
            color="primary"
            onClick={() => handleQuickAdd(selectedDate)}
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              boxShadow: theme.shadows[8],
            }}
          >
            <AddIcon />
          </MuiButton>
        </Box>
      )}

      {/* Row Action Instructions */}
      {viewMode === 'table' && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mt: 2,
            mb: 4,
            bgcolor: alpha(theme.palette.info.main, 0.08),
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <NotificationsIcon color="info" />
          <Typography variant="body2">
            Klicken Sie auf &quot;Details&quot;, um eine vollständige Ansicht
            der Bestellung zu sehen. Verwenden Sie &quot;Bearbeiten&quot;, um
            Änderungen vorzunehmen oder &quot;Löschen&quot;, um eine Bestellung
            zu entfernen.
          </Typography>
        </Paper>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Bestellung löschen</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Möchten Sie diese Bestellung wirklich löschen? Diese Aktion kann
            nicht rückgängig gemacht werden.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setDeleteDialogOpen(false)}>
            Abbrechen
          </MuiButton>
          <MuiButton
            onClick={() => {
              if (orderToDelete) {
                handleDeleteOrder(orderToDelete.id)
                setDeleteDialogOpen(false)
                setDetailDialogOpen(false)
              }
            }}
            color="error"
            autoFocus
          >
            Löschen
          </MuiButton>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default OrderManagement
