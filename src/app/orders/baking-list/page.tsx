'use client'
import React, { useState, useEffect } from 'react'
import BakeryLayout from '../../../layouts/BakeryLayout'

import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
} from '@mui/material'
import { useRouter } from 'next/navigation'
import PrintIcon from '@mui/icons-material/Print'
import Base from '../../../layouts/Base'
import Hero from '../../../components/Hero'
import Button from '../../../components/button/Index'
import bakeryAPI from '../../../services/bakeryAPI'
import {
  BakingItem,
  ShopItem,
  OrderForBakingList,
} from '../../../services/types'

const BakingList = () => {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bakingItems, setBakingItems] = useState<BakingItem[]>([])
  const [shopItems, setShopItems] = useState<ShopItem[]>([])
  const [orderItems, setOrderItems] = useState<OrderForBakingList[]>([])
  const [date, setDate] = useState(new Date())

  useEffect(() => {
    const fetchBakingList = async () => {
      try {
        setLoading(true)
        setError(null)
        // Get baking list from backend
        const bakingListData = await bakeryAPI.getBakingList(date)

        setBakingItems(bakingListData.allItems || [])
        setShopItems(bakingListData.shopItems || [])
        setOrderItems(bakingListData.orderItems || [])
      } catch (err) {
        console.error('Error fetching baking list:', err)
        setError('Failed to load the baking list. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchBakingList()
  }, [date])

  const handleNavigateBack = () => {
    router.push('/orders')
  }

  const handlePrint = () => {
    window.print()
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

  if (error) {
    return (
      <Base>
        <Hero title="Daily Baking List" />
        <Container maxWidth="xl">
          <Box
            sx={{
              mb: 3,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Button onClick={handleNavigateBack}>← Back to Orders</Button>
          </Box>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="error" variant="h6">
              {error}
            </Typography>
            <Button onClick={() => window.location.reload()} sx={{ mt: 2 }}>
              Try Again
            </Button>
          </Paper>
        </Container>
      </Base>
    )
  }

  return (
    <BakeryLayout>
      <Container maxWidth="xl">
        <Box
          sx={{
            mb: 3,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Button onClick={handleNavigateBack}>← Back to Orders</Button>
          <Button onClick={handlePrint} startIcon={<PrintIcon />}>
            Print Baking List
          </Button>
        </Box>

        <Paper sx={{ p: 3, mb: 4 }} className="print-content">
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4">Daily Baking List</Typography>
            <Typography variant="subtitle1">
              {date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Typography>
          </Box>

          {/* Combined Baking Summary */}
          <TableContainer sx={{ mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Complete Baking Summary
            </Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Product</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Quantity to Bake</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>For Shop</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>For Orders</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bakingItems.length > 0 ? (
                  bakingItems.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell align="right">
                        <Typography variant="h6">
                          {item.totalQuantity}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{item.shopQuantity}</TableCell>
                      <TableCell align="right">{item.orderQuantity}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      No items to bake today
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ my: 4 }} />

          {/* Shop Inventory */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Shop Inventory
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <strong>Product</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Daily Target</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Current Stock</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Quantity to Bake</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shopItems.length > 0 ? (
                    shopItems.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell align="right">{item.dailyTarget}</TableCell>
                        <TableCell align="right">{item.currentStock}</TableCell>
                        <TableCell align="right">{item.shopQuantity}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        No shop inventory needed
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Customer Orders */}
          <Box>
            <Typography variant="h5" gutterBottom>
              Customer Orders for {date.toLocaleDateString()}
            </Typography>
            {orderItems.length > 0 ? (
              orderItems.map((order, index) => (
                <Box
                  key={order.orderId}
                  sx={{
                    mb: 3,
                    pb: 2,
                    borderBottom:
                      index < orderItems.length - 1 ? '1px solid #eee' : 'none',
                  }}
                >
                  <Grid container spacing={2} sx={{ mb: 1 }}>
                    <Grid item xs={6}>
                      <Typography variant="subtitle1">
                        <strong>Order #{order.orderId}</strong>
                      </Typography>
                      <Typography>Customer: {order.customerName}</Typography>
                      <Typography>
                        Pickup Time:{' '}
                        {new Date(order.pickupDate).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} textAlign="right">
                      <Chip
                        label={order.status}
                        color={
                          order.status === 'Pending'
                            ? 'warning'
                            : order.status === 'Confirmed'
                            ? 'primary'
                            : order.status === 'Completed'
                            ? 'success'
                            : 'default'
                        }
                      />
                    </Grid>
                  </Grid>

                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {order.items.map((item, itemIndex) => (
                          <TableRow key={`${order.orderId}-${itemIndex}`}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell align="right">{item.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {order.notes && (
                    <Box
                      sx={{ mt: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}
                    >
                      <Typography variant="body2">
                        <strong>Notes:</strong> {order.notes}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ))
            ) : (
              <Typography>No customer orders for today</Typography>
            )}
          </Box>
        </Paper>
      </Container>
    </BakeryLayout>
  )
}

export default BakingList
