'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { InternOrder } from '../../../../types'
import { internOrderService } from '../../../../services/internOrderService'
import InternOrderList from '../../../../components/bakery/intern-orders/InternOrderList'
import InternOrderForm from '../../../../components/bakery/intern-orders/InternOrderForm'
import {
  Container,
  Button,
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

export default function InternOrdersPage() {
  const [orders, setOrders] = useState<InternOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingOrder, setEditingOrder] = useState<InternOrder | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const fetchedOrders = await internOrderService.getAllInternOrders()
      setOrders(fetchedOrders)
    } catch (err) {
      console.error('Failed to fetch intern orders:', err)
      setError('Failed to load intern orders. Please try again later.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleShowAddForm = () => {
    setEditingOrder(null)
    setShowForm(true)
  }

  const handleShowEditForm = (order: InternOrder) => {
    setEditingOrder(order)
    setShowForm(true)
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingOrder(null)
  }

  const handleSubmitForm = async (
    formData: Omit<InternOrder, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    try {
      setIsLoading(true) // Show loading indicator during submission
      if (editingOrder) {
        await internOrderService.updateInternOrder(editingOrder.id, formData)
      } else {
        await internOrderService.addInternOrder(formData)
      }
      setShowForm(false)
      setEditingOrder(null)
      await fetchOrders() // Refresh the list
    } catch (err) {
      console.error('Failed to save intern order:', err)
      setError(
        'Failed to save intern order. Please check the details and try again.'
      )
      // Keep form open if there was an error and isLoading was set to true
      // If you want to hide loading on error, setIsLoading(false) here.
    } finally {
      // Ensure loading is false if not handled by another fetchOrders call or error persistence
      if (!error) setIsLoading(false)
    }
  }

  const handleMarkAsDone = async (orderId: string) => {
    try {
      setIsLoading(true)
      await internOrderService.updateInternOrder(orderId, { status: 'done' })
      await fetchOrders() // Refresh the list
    } catch (err) {
      console.error('Failed to mark order as done:', err)
      setError('Failed to update order status.')
    } finally {
      setIsLoading(false)
    }
  }

  // Optional: Implement Delete Handler if needed in the future
  // const handleDeleteOrder = async (orderId: string) => {
  //   try {
  //     setIsLoading(true);
  //     await internOrderService.deleteInternOrder(orderId);
  //     await fetchOrders(); // Refresh the list
  //   } catch (err) {
  //     console.error('Failed to delete order:', err);
  //     setError('Failed to delete order.');
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  if (isLoading && orders.length === 0) {
    // Show loader only on initial load or full processing
    return (
      <Container
        maxWidth="lg"
        sx={{
          py: 4,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <CircularProgress />
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {showForm ? (
        <InternOrderForm
          order={editingOrder}
          onSubmit={handleSubmitForm}
          onCancel={handleCancelForm}
        />
      ) : (
        <Paper
          elevation={0}
          sx={{ p: { xs: 1, md: 2 }, backgroundColor: 'transparent' }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: { xs: 2, md: 3 },
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 'medium' }}
            >
              Intern Orders
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleShowAddForm}
              disabled={isLoading}
            >
              New Intern Order
            </Button>
          </Box>
          {isLoading && (
            <CircularProgress
              size={24}
              sx={{ position: 'absolute', top: '90px', right: '40px' }}
            />
          )}
          <InternOrderList
            orders={orders}
            onEditOrder={handleShowEditForm}
            onMarkAsDone={handleMarkAsDone}
            // Pass other handlers like onDeleteOrder if implemented
          />
        </Paper>
      )}
    </Container>
  )
}
