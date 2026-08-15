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
  CircularProgress,
  Alert,
  Snackbar,
  LinearProgress,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

type InternOrderInput = Omit<InternOrder, 'id' | 'createdAt' | 'updatedAt'>

export default function InternOrdersPage() {
  const [orders, setOrders] = useState<InternOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
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
      setError(
        'Interne Bestellungen konnten nicht geladen werden. Bitte versuchen Sie es später erneut.'
      )
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

  const handleSubmitForm = async (formData: InternOrderInput) => {
    try {
      setIsSaving(true)
      setError(null)
      if (editingOrder) {
        await internOrderService.updateInternOrder(editingOrder.id, formData)
        setSuccessMessage('Bestellung aktualisiert')
      } else {
        await internOrderService.addInternOrder(formData)
        setSuccessMessage('Bestellung angelegt')
      }
      setShowForm(false)
      setEditingOrder(null)
      await fetchOrders()
    } catch (err) {
      console.error('Failed to save intern order:', err)
      // Keep the form open so the user does not lose their input
      setError(
        'Bestellung konnte nicht gespeichert werden. Bitte prüfen Sie die Angaben und versuchen Sie es erneut.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleMarkAsDone = async (orderId: string) => {
    try {
      setIsSaving(true)
      setError(null)
      await internOrderService.updateInternOrder(orderId, { status: 'done' })
      setSuccessMessage('Bestellung als erledigt markiert')
      await fetchOrders()
    } catch (err) {
      console.error('Failed to mark order as done:', err)
      setError('Status konnte nicht aktualisiert werden.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading && orders.length === 0 && !error) {
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
        <CircularProgress aria-label="Lade interne Bestellungen" />
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

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      </Snackbar>

      {showForm ? (
        <InternOrderForm
          order={editingOrder}
          onSubmit={handleSubmitForm}
          onCancel={handleCancelForm}
          isSubmitting={isSaving}
        />
      ) : (
        <Box>
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
            <Box>
              <Typography
                variant="h4"
                component="h1"
                sx={{ fontWeight: 'medium' }}
              >
                Interne Bestellungen
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Besorgungen und Einkäufe des Teams verwalten
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleShowAddForm}
              disabled={isSaving}
            >
              Neue Bestellung
            </Button>
          </Box>
          {(isLoading || isSaving) && (
            <LinearProgress sx={{ mb: 1 }} aria-label="Wird verarbeitet" />
          )}
          <InternOrderList
            orders={orders}
            onEditOrder={handleShowEditForm}
            onMarkAsDone={handleMarkAsDone}
          />
        </Box>
      )}
    </Container>
  )
}
