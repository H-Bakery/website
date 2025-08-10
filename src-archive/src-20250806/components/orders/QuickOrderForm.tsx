import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Grid,
  MenuItem,
  Button,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Divider,
  Autocomplete,
} from '@mui/material'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import DeleteIcon from '@mui/icons-material/Delete'
import { Product } from '../../types/product'
import { OrderItem } from '../../services/types'
import { format, addDays, setHours, setMinutes } from 'date-fns'

interface QuickOrderFormProps {
  products: Product[]
  selectedDate: Date
  onSave: (orderData: any) => void
  onCancel: () => void
}

const QuickOrderForm: React.FC<QuickOrderFormProps> = ({
  products,
  selectedDate,
  onSave,
  onCancel,
}) => {
  // Set default pickup time to 12:00 on selected date
  const defaultPickupTime = setMinutes(setHours(selectedDate, 12), 0)

  const [orderData, setOrderData] = useState({
    customerName: '',
    customerPhone: '',
    pickupDate: format(defaultPickupTime, "yyyy-MM-dd'T'HH:mm"),
    status: 'Confirmed',
    notes: '',
    items: [] as OrderItem[],
    totalPrice: 0,
  })

  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)

  // Calculate total price whenever items change
  useEffect(() => {
    const total = orderData.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    )
    setOrderData((prev) => ({
      ...prev,
      totalPrice: parseFloat(total.toFixed(2)),
    }))
  }, [orderData.items])

  // Handle text field changes
  const handleTextChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setOrderData({
      ...orderData,
      [name]: value,
    })
  }

  // Handle status change
  const handleStatusChange = (e: SelectChangeEvent) => {
    setOrderData({
      ...orderData,
      status: e.target.value,
    })
  }

  // Add current product to order items
  const handleAddItem = () => {
    if (!currentProduct) return

    const newItem: OrderItem = {
      productId: currentProduct.id,
      productName: currentProduct.name,
      quantity: quantity,
      unitPrice: currentProduct.price,
    }

    setOrderData({
      ...orderData,
      items: [...orderData.items, newItem],
    })

    // Reset inputs
    setCurrentProduct(null)
    setQuantity(1)
  }

  // Remove item from order
  const handleRemoveItem = (index: number) => {
    const updatedItems = [...orderData.items]
    updatedItems.splice(index, 1)

    setOrderData({
      ...orderData,
      items: updatedItems,
    })
  }

  // Submit order
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(orderData)
  }

  // Pre-defined pickup times (every 30 minutes from 6:00 to 18:00)
  const pickupTimes = []
  for (let hour = 6; hour <= 18; hour++) {
    pickupTimes.push(`${hour}:00`)
    pickupTimes.push(`${hour}:30`)
  }

  return (
    <Paper sx={{ p: 3, borderRadius: 2 }} elevation={2}>
      <Typography variant="h6" gutterBottom>
        Neue Bestellung für {format(selectedDate, 'dd.MM.yyyy')}
      </Typography>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={2}>
          {/* Customer Information */}
          <Grid item xs={12} md={6}>
            <TextField
              required
              fullWidth
              label="Kundenname"
              name="customerName"
              value={orderData.customerName}
              onChange={handleTextChange}
              autoFocus
              variant="outlined"
              size="small"
              margin="dense"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Telefonnummer"
              name="customerPhone"
              value={orderData.customerPhone}
              onChange={handleTextChange}
              variant="outlined"
              size="small"
              margin="dense"
            />
          </Grid>

          <Grid item xs={6} md={3}>
            <TextField
              fullWidth
              label="Abholdatum"
              type="date"
              name="pickupDate"
              value={orderData.pickupDate.split('T')[0]}
              onChange={handleTextChange}
              InputLabelProps={{ shrink: true }}
              variant="outlined"
              size="small"
              margin="dense"
            />
          </Grid>

          <Grid item xs={6} md={3}>
            <TextField
              fullWidth
              label="Uhrzeit"
              name="pickupTime"
              select
              value={orderData.pickupDate.split('T')[1].substring(0, 5)}
              onChange={(e) => {
                const [hours, minutes] = e.target.value.split(':')
                const date = new Date(orderData.pickupDate)
                date.setHours(parseInt(hours, 10))
                date.setMinutes(parseInt(minutes, 10))
                setOrderData({
                  ...orderData,
                  pickupDate: format(date, "yyyy-MM-dd'T'HH:mm"),
                })
              }}
              variant="outlined"
              size="small"
              margin="dense"
            >
              {pickupTimes.map((time) => (
                <MenuItem key={time} value={time}>
                  {time}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl
              fullWidth
              variant="outlined"
              size="small"
              margin="dense"
            >
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={orderData.status}
                onChange={handleStatusChange}
                label="Status"
              >
                <MenuItem value="Pending">Ausstehend</MenuItem>
                <MenuItem value="Confirmed">Bestätigt</MenuItem>
                <MenuItem value="Completed">Abgeschlossen</MenuItem>
                <MenuItem value="Cancelled">Storniert</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Artikel hinzufügen
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={products}
                  getOptionLabel={(option) =>
                    `${option.name} (${option.price.toFixed(2)} €)`
                  }
                  value={currentProduct}
                  onChange={(_, newValue) => setCurrentProduct(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Produkt"
                      variant="outlined"
                      size="small"
                      margin="dense"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={4} sm={2}>
                <TextField
                  fullWidth
                  label="Menge"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  inputProps={{ min: 1 }}
                  variant="outlined"
                  size="small"
                  margin="dense"
                />
              </Grid>

              <Grid item xs={8} sm={4}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleAddItem}
                  disabled={!currentProduct}
                  startIcon={<AddCircleIcon />}
                  fullWidth
                  size="medium"
                >
                  Hinzufügen
                </Button>
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mt: 1,
                bgcolor: 'background.default',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {orderData.items.length === 0 ? (
                <Typography color="text.secondary">
                  Keine Artikel hinzugefügt
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {orderData.items.map((item, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        p: 1,
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Box>
                        <Typography variant="body2">
                          {item.productName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.quantity} × {item.unitPrice.toFixed(2)} € ={' '}
                          {(item.quantity * item.unitPrice).toFixed(2)} €
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>

            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}
            >
              <TextField
                label="Notizen"
                name="notes"
                value={orderData.notes}
                onChange={handleTextChange}
                variant="outlined"
                size="small"
                sx={{ width: '70%' }}
              />
              <Typography variant="h6" sx={{ pt: 1 }}>
                Gesamt: {orderData.totalPrice.toFixed(2)} €
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 1,
                mt: 1,
              }}
            >
              <Button variant="outlined" color="inherit" onClick={onCancel}>
                Abbrechen
              </Button>
              <Button
                variant="contained"
                color="primary"
                type="submit"
                disabled={
                  orderData.items.length === 0 || !orderData.customerName
                }
              >
                Bestellung speichern
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Paper>
  )
}

export default QuickOrderForm
