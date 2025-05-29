import React, { useState, useEffect } from 'react'
import {
  Paper,
  Typography,
  Box,
  Grid,
  TextField,
  MenuItem,
  IconButton,
  Button as MuiButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import Button from '../button/Index'

// Type definitions
interface Product {
  id: string | number
  name: string
  price: number
}

interface OrderItem {
  productId: string | number
  productName: string
  quantity: number
  unitPrice: number
}

interface OrderData {
  customerName: string
  customerPhone: string
  customerEmail: string
  pickupDate: string
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled'
  notes: string
  items: OrderItem[]
  totalPrice: number
}

interface OrderFormProps {
  products: Product[]
  order?: {
    customerName?: string
    customerPhone?: string
    customerEmail?: string
    pickupDate?: string | Date
    status?: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled'
    notes?: string
    items?: OrderItem[]
    totalPrice?: number
  }
  onSave: (orderData: OrderData) => void
  onCancel: () => void
}

const OrderForm: React.FC<OrderFormProps> = ({
  products,
  order,
  onSave,
  onCancel,
}) => {
  // Format the date properly
  const formatPickupDate = (date?: string | Date): string => {
    if (!date) {
      // Default to tomorrow
      return new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16)
    }

    const dateObj = date instanceof Date ? date : new Date(date)
    return dateObj.toISOString().slice(0, 16)
  }

  const [orderData, setOrderData] = useState<OrderData>({
    customerName: order?.customerName || '',
    customerPhone: order?.customerPhone || '',
    customerEmail: order?.customerEmail || '',
    pickupDate: formatPickupDate(order?.pickupDate),
    status: order?.status || 'Pending',
    notes: order?.notes || '',
    items: order?.items ? [...order.items] : [], // Fixed: Safely spread items
    totalPrice: order?.totalPrice || 0,
  })

  const [currentItem, setCurrentItem] = useState<OrderItem>({
    productId: '',
    productName: '',
    quantity: 1,
    unitPrice: 0,
  })

  // Calculate total price whenever items change
  useEffect(() => {
    // Make sure items is an array before calling reduce
    const items = Array.isArray(orderData.items) ? orderData.items : []
    const total = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    )

    setOrderData((prev) => ({
      ...prev,
      totalPrice: parseFloat(total.toFixed(2)),
    }))
  }, [orderData.items])

  // Fixed: Separate handlers for text inputs and select inputs
  const handleTextChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setOrderData({
      ...orderData,
      [name]: value,
    })
  }

  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target
    setOrderData({
      ...orderData,
      [name]: value,
    })
  }

  // Handle numeric input specifically
  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const numericValue = parseInt(value, 10)
    if (!isNaN(numericValue)) {
      setCurrentItem({
        ...currentItem,
        [name]: numericValue,
      })
    }
  }

  // Handler for product selection
  const handleProductSelect = (e: SelectChangeEvent) => {
    const selectedProductId = e.target.value
    const selectedProduct = products.find(
      (p) => p.id.toString() === selectedProductId.toString()
    )

    if (selectedProduct) {
      setCurrentItem({
        ...currentItem,
        productId: selectedProductId,
        productName: selectedProduct.name,
        unitPrice: selectedProduct.price,
      })
    }
  }

  const handleAddItem = () => {
    if (!currentItem.productId) return

    setOrderData({
      ...orderData,
      items: [...orderData.items, { ...currentItem }],
    })

    // Reset current item
    setCurrentItem({
      productId: '',
      productName: '',
      quantity: 1,
      unitPrice: 0,
    })
  }

  const handleRemoveItem = (index: number) => {
    const updatedItems = [...orderData.items]
    updatedItems.splice(index, 1)

    setOrderData({
      ...orderData,
      items: updatedItems,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(orderData)
  }

  return (
    <Paper sx={{ p: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>
        {order ? 'Edit Order' : 'New Order'}
      </Typography>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Customer Details */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Customer Information
            </Typography>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              required
              fullWidth
              label="Customer Name"
              name="customerName"
              value={orderData.customerName}
              onChange={handleTextChange}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Phone Number"
              name="customerPhone"
              value={orderData.customerPhone}
              onChange={handleTextChange}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Email"
              name="customerEmail"
              type="email"
              value={orderData.customerEmail}
              onChange={handleTextChange}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Pickup Date"
              name="pickupDate"
              type="datetime-local"
              value={orderData.pickupDate}
              onChange={handleTextChange}
              InputLabelProps={{
                shrink: true,
              }}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth required>
              <InputLabel>Order Status</InputLabel>
              <Select
                name="status"
                value={orderData.status}
                onChange={handleSelectChange}
                label="Order Status"
              >
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Confirmed">Confirmed</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Order Notes"
              name="notes"
              value={orderData.notes}
              onChange={handleTextChange}
            />
          </Grid>

          {/* Order Items */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" sx={{ mb: 2 }}>
              Order Items
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={5}>
                <FormControl fullWidth>
                  <InputLabel>Product</InputLabel>
                  <Select
                    value={currentItem.productId.toString()}
                    onChange={handleProductSelect}
                    label="Product"
                  >
                    {products.map((product) => (
                      <MenuItem key={product.id} value={product.id.toString()}>
                        {product.name} - ${product.price.toFixed(2)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Quantity"
                  name="quantity"
                  value={currentItem.quantity}
                  onChange={handleNumberInput}
                  inputProps={{ min: 1 }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <MuiButton
                  variant="contained"
                  startIcon={<AddCircleIcon />}
                  onClick={handleAddItem}
                  disabled={!currentItem.productId}
                  fullWidth
                  sx={{ height: '100%' }}
                >
                  Add Item
                </MuiButton>
              </Grid>
            </Grid>

            <Paper
              variant="outlined"
              sx={{ maxHeight: '300px', overflow: 'auto' }}
            >
              <List>
                {orderData.items.length > 0 ? (
                  orderData.items.map((item, index) => (
                    <ListItem
                      key={index}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <DeleteIcon color="error" />
                        </IconButton>
                      }
                      divider={index < orderData.items.length - 1}
                    >
                      <ListItemText
                        primary={item.productName}
                        secondary={`${
                          item.quantity
                        } × $${item.unitPrice.toFixed(2)} = $${(
                          item.quantity * item.unitPrice
                        ).toFixed(2)}`}
                      />
                    </ListItem>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText primary="No items added to this order yet." />
                  </ListItem>
                )}
              </List>
            </Paper>

            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Typography variant="h6">
                Total: ${orderData.totalPrice.toFixed(2)}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button onClick={onCancel} type="button" color="secondary">
                Cancel
              </Button>
              <Button type="submit">Save Order</Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Paper>
  )
}

export default OrderForm
