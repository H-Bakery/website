import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Divider,
  Button,
  IconButton,
  TextField,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Card,
  CardContent,
  useTheme,
  alpha,
  Autocomplete
} from '@mui/material'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Cancel'
import DeleteIcon from '@mui/icons-material/Delete'
import PrintIcon from '@mui/icons-material/Print'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle'
import { Order, OrderItem, Product } from '../../services/types'

interface OrderDetailViewProps {
  order: Order
  products: Product[]
  onSave: (updatedOrder: Order) => void
  onDelete: (orderId: string | number) => void
  onCancel: () => void
}

const OrderDetailView: React.FC<OrderDetailViewProps> = ({
  order,
  products,
  onSave,
  onDelete,
  onCancel
}) => {
  // Form validation state
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({})
  const theme = useTheme()
  const [editMode, setEditMode] = useState(false)
  const [editedOrder, setEditedOrder] = useState<Order>({ ...order })
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState<number>(1)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  // Update local state when order changes
  useEffect(() => {
    setEditedOrder({ ...order })
  }, [order])

  // Calculate total items and price
  const totalItems = editedOrder.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  )

  // Format date for display
  const formatDate = (date: string | Date) => {
    if (typeof date === 'string') {
      return format(parseISO(date), 'EEEE, dd. MMMM yyyy', { locale: de })
    }
    return format(date, 'EEEE, dd. MMMM yyyy', { locale: de })
  }

  // Format time for display
  const formatTime = (date: string | Date) => {
    if (typeof date === 'string') {
      return format(parseISO(date), 'HH:mm', { locale: de })
    }
    return format(date, 'HH:mm', { locale: de })
  }

  // Handle text field changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setEditedOrder({
      ...editedOrder,
      [name]: value
    })
  }

  // Handle status change
  const handleStatusChange = (e: any) => {
    setEditedOrder({
      ...editedOrder,
      status: e.target.value
    })
  }

  // Handle adding a product to the order
  const handleAddProduct = () => {
    if (!selectedProduct) return

    const existingItemIndex = editedOrder.items.findIndex(
      item => item.productId === selectedProduct.id
    )

    let newItems
    if (existingItemIndex !== -1) {
      // Update existing item quantity
      newItems = [...editedOrder.items]
      newItems[existingItemIndex].quantity += quantity
    } else {
      // Add new item
      const newItem: OrderItem = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity,
        unitPrice: selectedProduct.price
      }
      newItems = [...editedOrder.items, newItem]
    }

    // Calculate new total price
    const newTotalPrice = newItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    )

    setEditedOrder({
      ...editedOrder,
      items: newItems,
      totalPrice: newTotalPrice
    })

    // Reset selection
    setSelectedProduct(null)
    setQuantity(1)
  }

  // Handle removing a product from the order
  const handleRemoveProduct = (index: number) => {
    const newItems = [...editedOrder.items]
    newItems.splice(index, 1)

    // Calculate new total price
    const newTotalPrice = newItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    )

    setEditedOrder({
      ...editedOrder,
      items: newItems,
      totalPrice: newTotalPrice
    })
  }

  // Handle updating item quantity
  const handleUpdateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return

    const newItems = [...editedOrder.items]
    newItems[index].quantity = newQuantity

    // Calculate new total price
    const newTotalPrice = newItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    )

    setEditedOrder({
      ...editedOrder,
      items: newItems,
      totalPrice: newTotalPrice
    })
  }

  // Handle save changes
  const handleSave = () => {
    // Validate required fields
    const errors: {[key: string]: string} = {}
    
    if (!editedOrder.customerName) {
      errors.customerName = 'Kundenname ist erforderlich'
    }
    
    if (!editedOrder.pickupDate) {
      errors.pickupDate = 'Abholdatum ist erforderlich'
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    
    onSave(editedOrder)
    setEditMode(false)
    setFormErrors({})
  }

  // Get color for status chip
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'warning'
      case 'Confirmed':
        return 'primary'
      case 'Completed':
        return 'success'
      case 'Cancelled':
        return 'error'
      default:
        return 'default'
    }
  }

  // Get German text for status
  const getStatusText = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'Ausstehend'
      case 'Confirmed':
        return 'Bestätigt'
      case 'Completed':
        return 'Abgeschlossen'
      case 'Cancelled':
        return 'Storniert'
      default:
        return status
    }
  }

  // Create pickup times list (every 30 minutes from 6:00 to 18:00)
  const pickupTimes = []
  for (let hour = 6; hour <= 18; hour++) {
    pickupTimes.push(`${hour}:00`)
    pickupTimes.push(`${hour}:30`)
  }

  return (
    <Box sx={{ mb: 4 }}>
      {editMode && (
        <Paper 
          elevation={0}
          sx={{ 
            p: 2, 
            mb: 3, 
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            borderLeft: `4px solid ${theme.palette.primary.main}`,
            borderRadius: 1
          }}
        >
          <Typography variant="subtitle1" fontWeight={500}>
            Sie bearbeiten diese Bestellung. Bitte klicken Sie auf Speichern, um Ihre Änderungen zu übernehmen.
          </Typography>
        </Paper>
      )}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          Bestellung #{editedOrder.id}
        </Typography>
        <Box>
          {editMode ? (
            <>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<CancelIcon />}
                onClick={() => {
                  setEditMode(false)
                  setEditedOrder({ ...order })
                }}
                sx={{ mr: 1 }}
              >
                Abbrechen
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSave}
              >
                Speichern
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setConfirmDeleteOpen(true)}
                sx={{ mr: 1 }}
              >
                Löschen
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<PrintIcon />}
                sx={{ mr: 1 }}
                onClick={() => {
                  console.log('Print order:', order.id)
                }}
              >
                Drucken
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<EditIcon />}
                onClick={() => setEditMode(true)}
              >
                Bearbeiten
              </Button>
            </>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper
            elevation={theme.palette.mode === 'dark' ? 2 : 1}
            sx={{ p: 3, borderRadius: 2, height: '100%' }}
          >
            <Typography variant="h6" gutterBottom>
              Bestelldetails
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2}>
              {/* Customer Information */}
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Kunde
                </Typography>
                {editMode ? (
                  <TextField
                    name="customerName"
                    value={editedOrder.customerName}
                    onChange={handleChange}
                    fullWidth
                    margin="dense"
                    size="small"
                    label="Name"
                    required
                    error={!!formErrors.customerName}
                    helperText={formErrors.customerName}
                  />
                ) : (
                  <Typography variant="body1" fontWeight={500}>
                    {editedOrder.customerName}
                  </Typography>
                )}

                {editMode ? (
                  <TextField
                    name="customerPhone"
                    value={editedOrder.customerPhone || ''}
                    onChange={handleChange}
                    fullWidth
                    margin="dense"
                    size="small"
                    label="Telefon"
                  />
                ) : (
                  editedOrder.customerPhone && (
                    <Typography variant="body2" color="text.secondary">
                      {editedOrder.customerPhone}
                    </Typography>
                  )
                )}

                {editMode ? (
                  <TextField
                    name="customerEmail"
                    value={editedOrder.customerEmail || ''}
                    onChange={handleChange}
                    fullWidth
                    margin="dense"
                    size="small"
                    label="Email"
                  />
                ) : (
                  editedOrder.customerEmail && (
                    <Typography variant="body2" color="text.secondary">
                      {editedOrder.customerEmail}
                    </Typography>
                  )
                )}
              </Grid>

              {/* Pickup Information */}
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Abholung
                </Typography>

                {editMode ? (
                  <>
                    <TextField
                      type="date"
                      name="pickupDate"
                      value={
                        typeof editedOrder.pickupDate === 'string'
                          ? editedOrder.pickupDate.split('T')[0]
                          : format(editedOrder.pickupDate, 'yyyy-MM-dd')
                      }
                      onChange={handleChange}
                      fullWidth
                      margin="dense"
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      label="Datum"
                      required
                      error={!!formErrors.pickupDate}
                      helperText={formErrors.pickupDate}
                    />
                    <FormControl fullWidth margin="dense" size="small">
                      <InputLabel>Uhrzeit</InputLabel>
                      <Select
                        value={
                          typeof editedOrder.pickupDate === 'string'
                            ? editedOrder.pickupDate.split('T')[1].substring(0, 5)
                            : format(editedOrder.pickupDate, 'HH:mm')
                        }
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':')
                          const date = new Date(editedOrder.pickupDate)
                          date.setHours(parseInt(hours, 10))
                          date.setMinutes(parseInt(minutes, 10))
                          setEditedOrder({
                            ...editedOrder,
                            pickupDate: format(date, "yyyy-MM-dd'T'HH:mm")
                          })
                        }}
                        label="Uhrzeit"
                      >
                        {pickupTimes.map((time) => (
                          <MenuItem key={time} value={time}>
                            {time}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </>
                ) : (
                  <>
                    <Typography variant="body1" fontWeight={500}>
                      {formatDate(editedOrder.pickupDate)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatTime(editedOrder.pickupDate)} Uhr
                    </Typography>
                  </>
                )}

                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Status
                  </Typography>
                  {editMode ? (
                    <FormControl fullWidth margin="dense" size="small">
                      <Select
                        value={editedOrder.status}
                        onChange={handleStatusChange}
                      >
                        <MenuItem value="Pending">Ausstehend</MenuItem>
                        <MenuItem value="Confirmed">Bestätigt</MenuItem>
                        <MenuItem value="Completed">Abgeschlossen</MenuItem>
                        <MenuItem value="Cancelled">Storniert</MenuItem>
                      </Select>
                    </FormControl>
                  ) : (
                    <Chip
                      label={getStatusText(editedOrder.status)}
                      color={getStatusColor(editedOrder.status) as any}
                      size="small"
                    />
                  )}
                </Box>
              </Grid>

              {/* Notes */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Notizen
                </Typography>
                {editMode ? (
                  <TextField
                    name="notes"
                    value={editedOrder.notes || ''}
                    onChange={handleChange}
                    fullWidth
                    multiline
                    rows={2}
                    margin="dense"
                  />
                ) : (
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, bgcolor: 'background.default', mt: 1 }}
                  >
                    <Typography variant="body2">
                      {editedOrder.notes || 'Keine Notizen'}
                    </Typography>
                  </Paper>
                )}
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper
            elevation={theme.palette.mode === 'dark' ? 2 : 1}
            sx={{
              p: 3,
              borderRadius: 2,
              bgcolor:
                theme.palette.mode === 'dark'
                  ? theme.palette.background.paper
                  : alpha(theme.palette.primary.main, 0.03)
            }}
          >
            <Typography variant="h6" gutterBottom>
              Zusammenfassung
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ mb: 2 }}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Bestellnummer
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    #{editedOrder.id}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Artikel
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {totalItems}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Gesamtbetrag
                  </Typography>
                  <Typography variant="h5" fontWeight={600} color="primary.main">
                    {editedOrder.totalPrice.toFixed(2)} €
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper
            elevation={theme.palette.mode === 'dark' ? 2 : 1}
            sx={{ p: 3, borderRadius: 2 }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
              }}
            >
              <Typography variant="h6">Bestellte Artikel</Typography>
              {editMode && (
                <Typography variant="body2" color="primary">
                  {editedOrder.items.length} Artikel
                </Typography>
              )}
            </Box>
            <Divider sx={{ mb: 3 }} />

            {/* Add Product Form (Only in Edit Mode) */}
            {editMode && (
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 3, 
                  mb: 3, 
                  bgcolor: theme.palette.mode === 'dark' 
                    ? alpha(theme.palette.primary.main, 0.1)
                    : alpha(theme.palette.primary.main, 0.03)
                }}
              >
                <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 2 }}>
                  Produkt zur Bestellung hinzufügen
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <Autocomplete
                      options={products}
                      getOptionLabel={(option) => 
                        `${option.name} (${option.price.toFixed(2)} €)`
                      }
                      value={selectedProduct}
                      onChange={(_, newValue) => setSelectedProduct(newValue)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Produkt auswählen"
                          variant="outlined"
                          size="small"
                        />
                      )}
                      renderOption={(props, option) => (
                        <li {...props}>
                          <Box>
                            <Typography variant="body1">{option.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {option.price.toFixed(2)} € pro Stück
                            </Typography>
                          </Box>
                        </li>
                      )}
                    />
                  </Grid>
                  <Grid item xs={4} sm={2}>
                    <TextField
                      label="Menge"
                      type="number"
                      value={quantity}
                      onChange={(e) => 
                        setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      InputProps={{ 
                        inputProps: { min: 1 },
                        startAdornment: <Box sx={{ mr: 1 }}>×</Box>
                      }}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={8} sm={4}>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<AddCircleIcon />}
                      onClick={handleAddProduct}
                      disabled={!selectedProduct}
                      fullWidth
                    >
                      Hinzufügen
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            )}

            {/* Order Items Table */}
            <TableContainer component={Paper} variant="outlined">
              <Table size={editMode ? "medium" : "small"}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.default' }}>
                    <TableCell width="40%">Produkt</TableCell>
                    <TableCell align="center">Anzahl</TableCell>
                    <TableCell align="right">Einzelpreis</TableCell>
                    <TableCell align="right">Gesamt</TableCell>
                    {editMode && <TableCell align="center">Aktionen</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {editedOrder.items.length > 0 ? (
                    editedOrder.items.map((item, index) => (
                      <TableRow 
                        key={index}
                        sx={{ 
                          bgcolor: editMode ? alpha(theme.palette.primary.main, 0.03) : 'inherit',
                          '&:hover': {
                            bgcolor: editMode ? alpha(theme.palette.primary.main, 0.05) : 'inherit'
                          }
                        }}
                      >
                        <TableCell>
                          <Typography variant="body1">{item.productName}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          {editMode ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => 
                                  handleUpdateQuantity(index, item.quantity - 1)
                                }
                                disabled={item.quantity <= 1}
                                sx={{ border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}` }}
                              >
                                <RemoveCircleIcon fontSize="small" />
                              </IconButton>
                              <Typography 
                                sx={{ 
                                  mx: 1,
                                  minWidth: '30px',
                                  textAlign: 'center',
                                  fontWeight: 600
                                }}
                              >
                                {item.quantity}
                              </Typography>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => 
                                  handleUpdateQuantity(index, item.quantity + 1)
                                }
                                sx={{ border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}` }}
                              >
                                <AddCircleIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ) : (
                            <Typography variant="body1" fontWeight={500}>{item.quantity}</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {item.unitPrice.toFixed(2)} €
                        </TableCell>
                        <TableCell align="right">
                          {(item.quantity * item.unitPrice).toFixed(2)} €
                        </TableCell>
                        {editMode && (
                          <TableCell align="center">
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              onClick={() => handleRemoveProduct(index)}
                              startIcon={<DeleteIcon />}
                              sx={{ minWidth: '120px' }}
                            >
                              Entfernen
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={editMode ? 5 : 4} align="center">
                        <Typography color="text.secondary">
                          Keine Artikel in dieser Bestellung
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow sx={{ bgcolor: 'background.default' }}>
                    <TableCell colSpan={2} />
                    <TableCell align="right">
                      <Typography fontWeight={600}>Gesamtsumme</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={600}>
                        {editedOrder.totalPrice.toFixed(2)} €
                      </Typography>
                    </TableCell>
                    {editMode && <TableCell />}
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
      >
        <DialogTitle>Bestellung löschen</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Möchten Sie diese Bestellung wirklich löschen? Diese Aktion kann nicht
            rückgängig gemacht werden.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={() => {
              onDelete(editedOrder.id)
              setConfirmDeleteOpen(false)
            }}
            color="error"
          >
            Löschen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel/Back Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        {editMode ? (
          <Button 
            variant="outlined" 
            color="inherit" 
            startIcon={<CancelIcon />}
            onClick={() => {
              if (confirm('Möchten Sie den Bearbeitungsmodus verlassen? Ungespeicherte Änderungen gehen verloren.')) {
                setEditMode(false)
                setEditedOrder({ ...order })
                setFormErrors({})
              }
            }}
            sx={{ mr: 1 }}
          >
            Bearbeitung abbrechen
          </Button>
        ) : (
          <Button 
            variant="outlined" 
            color="inherit" 
            onClick={onCancel}
          >
            Zurück zur Übersicht
          </Button>
        )}
      </Box>
    </Box>
  )
}

export default OrderDetailView