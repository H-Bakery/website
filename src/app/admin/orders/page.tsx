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
  Fab,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import { useRouter } from 'next/navigation'
import AddIcon from '@mui/icons-material/Add'
import Base from '../../../layouts/Base'
import Button from '../../../components/button/Index'
import DataTable from '../../../components/dashboard/DataTable'
import bakeryAPI from '../../../services/bakeryAPI'
import OrderForm from '../../../components/orders/OrderForm'
import { Order as ApiOrder, OrderItem, Product } from '../../../services/types'

// Define the order status type that the form expects
type OrderStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled'

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
const mapApiOrderToFormOrder = (apiOrder: ApiOrder): FormOrder => {
  return {
    ...apiOrder,
    status: apiOrder.status as OrderStatus,
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
  const [loading, setLoading] = useState<boolean>(true)
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [showAddForm, setShowAddForm] = useState<boolean>(false)
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch orders and products with useCallback
  const fetchData = useCallback(async () => {
    try {
      const [ordersData, productsData] = await Promise.all([
        bakeryAPI.getOrders(),
        bakeryAPI.getProducts(),
      ])

      setOrders(ordersData)
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

  // Use the memoized fetchData in useEffect
  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleNavigateBack = useCallback(() => {
    router.push('/dashboard')
  }, [router])

  const handleAddOrder = useCallback(() => {
    setSelectedOrder(null)
    setShowAddForm(true)
  }, [])

  const handleEditOrder = useCallback((order: ApiOrder) => {
    setSelectedOrder(order)
    setShowAddForm(true)
  }, [])

  const handleCloseForm = useCallback(() => {
    setShowAddForm(false)
    setSelectedOrder(null)
  }, [])

  const handleSaveOrder = useCallback(
    async (orderData: Partial<FormOrder>) => {
      // Convert FormOrder back to ApiOrder if needed
      const apiOrderData: Partial<ApiOrder> = orderData
      setLoading(true)
      setError(null)

      try {
        let updatedOrder: ApiOrder

        if (selectedOrder) {
          // Update existing order
          updatedOrder = (await bakeryAPI.updateOrder(
            selectedOrder.id,
            orderData
          )) as ApiOrder

          setOrders((prevOrders) =>
            prevOrders.map((order) =>
              order.id === selectedOrder.id ? updatedOrder : order
            )
          )
        } else {
          // Create new order
          updatedOrder = (await bakeryAPI.createOrder(orderData)) as ApiOrder
          setOrders((prevOrders) => [...prevOrders, updatedOrder])
        }

        setShowAddForm(false)
        setSelectedOrder(null)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred'
        console.error('Error saving order:', errorMessage)
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
    router.push('/dashboard/orders/baking-list')
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
      <Base>
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
      </Base>
    )
  }

  // Define table columns with proper typing
  const columns: ColumnFormat[] = [
    { id: 'id', label: 'Order ID', minWidth: 80 },
    { id: 'customerName', label: 'Customer', minWidth: 150 },
    { id: 'date', label: 'Pickup Date', minWidth: 120 },
    {
      id: 'status',
      label: 'Status',
      minWidth: 120,
      format: (value: string) => (
        <Chip
          label={value}
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
      label: 'Items',
      minWidth: 80,
      align: 'right',
    },
    {
      id: 'totalPrice',
      label: 'Total',
      minWidth: 100,
      align: 'right',
    },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 150,
      align: 'center',
      // Use type assertion to make TypeScript accept our format function
      format: ((value: any, row: any) => {
        // Make sure row exists
        if (!row) return null

        return (
          <Box>
            <Button
              size="small"
              onClick={() => {
                // Use the row ID to find the original order
                const orderToEdit = orders.find((o) => o.id === row.id)
                if (orderToEdit) {
                  handleEditOrder(orderToEdit)
                }
              }}
              style={{ marginRight: '8px' }}
            >
              Edit
            </Button>
            <Button
              size="small"
              color="error"
              onClick={() => handleDeleteOrder(row.id)}
            >
              Delete
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
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Button onClick={handleNavigateBack}>← Back to Dashboard</Button>
        <Box>
          <Button
            onClick={handleGenerateBakingList}
            style={{ marginRight: '10px' }}
          >
            Generate Baking List
          </Button>
          <Fab
            color="primary"
            size="medium"
            onClick={handleAddOrder}
            aria-label="add order"
          >
            <AddIcon />
          </Fab>
        </Box>
      </Box>

      {showAddForm ? (
        <OrderForm
          products={products}
          order={
            selectedOrder
              ? mapApiOrderToFormOrder(selectedOrder)
              : createDefaultOrder()
          }
          onSave={handleSaveOrder}
          onCancel={handleCloseForm}
        />
      ) : (
        <DataTable
          title="Orders"
          subtitle="Manage customer orders"
          columns={columns}
          data={formatOrders()}
          searchEnabled={true}
          emptyMessage="No orders available"
        />
      )}
    </Container>
  )
}

export default OrderManagement
