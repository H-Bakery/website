import React, { useState, useEffect } from 'react'
import { InternOrder } from '../../../types'
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Tooltip,
} from '@mui/material'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import DeleteIcon from '@mui/icons-material/Delete'
import CloudUploadIcon from '@mui/icons-material/CloudUpload' // For file input

// Define a type for the item within the form state
interface FormItem {
  itemName: string
  itemQuantity: number
  unit?: string
}

interface InternOrderFormProps {
  order?: InternOrder | null // For editing, null for new order
  onSubmit: (
    formData: Omit<InternOrder, 'id' | 'createdAt' | 'updatedAt'>
  ) => void
  onCancel: () => void
}

const InternOrderForm: React.FC<InternOrderFormProps> = ({
  order,
  onSubmit,
  onCancel,
}) => {
  const [orderName, setOrderName] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [status, setStatus] = useState<InternOrder['status']>('pending')
  const [assignedTo, setAssignedTo] = useState('')
  const [billImage, setBillImage] = useState<File | null>(null)
  const [billImageUrlPreview, setBillImageUrlPreview] = useState<string | null>(
    null
  )
  const [items, setItems] = useState<FormItem[]>([])
  const [newItemName, setNewItemName] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState<number | ''>('')
  const [newItemUnit, setNewItemUnit] = useState('')

  useEffect(() => {
    if (order) {
      setOrderName(order.orderName)
      setDescription(order.description)
      setQuantity(order.quantity || '')
      setStatus(order.status)
      setAssignedTo(order.assignedTo || '')
      setBillImageUrlPreview(order.billImageUrl || null)
      setItems(order.items || [])
    } else {
      // Reset form for new order
      setOrderName('')
      setDescription('')
      setQuantity('')
      setStatus('pending')
      setAssignedTo('')
      setBillImage(null)
      setBillImageUrlPreview(null)
      setItems([])
    }
  }, [order])

  const handleAddItem = () => {
    if (newItemName && newItemQuantity > 0) {
      setItems([
        ...items,
        {
          itemName: newItemName,
          itemQuantity: Number(newItemQuantity),
          unit: newItemUnit,
        },
      ])
      setNewItemName('')
      setNewItemQuantity('')
      setNewItemUnit('')
    }
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]
      setBillImage(file)
      setBillImageUrlPreview(URL.createObjectURL(file)) // Show preview
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const formData: Omit<InternOrder, 'id' | 'createdAt' | 'updatedAt'> = {
      orderName,
      description,
      status,
      assignedTo: assignedTo || undefined,
      // For mock purposes, we'll just pass the preview URL or existing URL.
      // A real backend would handle the file upload and return a URL.
      billImageUrl: billImage
        ? billImageUrlPreview || undefined
        : order?.billImageUrl || undefined,
      items: items.length > 0 ? items : undefined,
      quantity: quantity ? Number(quantity) : undefined,
      // createdBy will be handled by the service/backend
    }
    onSubmit(formData)
  }

  return (
    <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: '12px' }}>
      <Typography
        variant="h5"
        component="h2"
        gutterBottom
        sx={{ fontWeight: 'bold', mb: 3 }}
      >
        {order ? 'Edit Intern Order' : 'Create New Intern Order'}
      </Typography>
      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Order Name"
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              fullWidth
              required
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="status-label">Status</InputLabel>
              <Select
                labelId="status-label"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as InternOrder['status'])
                }
                label="Status"
                required
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="done">Done</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              required
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Assigned To (Optional)"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              fullWidth
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="General Quantity (Optional, if no specific items)"
              type="number"
              value={quantity}
              onChange={(e) =>
                setQuantity(e.target.value === '' ? '' : Number(e.target.value))
              }
              fullWidth
              variant="outlined"
              inputProps={{ min: 1 }}
            />
          </Grid>

          {/* Itemized List Section */}
          <Grid item xs={12}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ mt: 2, fontWeight: 500 }}
            >
              Items (Optional)
            </Typography>
            <List dense>
              {items.map((item, index) => (
                <ListItem
                  key={index}
                  divider
                  sx={{
                    bgcolor: index % 2 ? 'action.hover' : 'transparent',
                    borderRadius: '4px',
                    mb: 0.5,
                    p: 1,
                  }}
                >
                  <ListItemText
                    primary={item.itemName}
                    secondary={`Qty: ${item.itemQuantity} ${item.unit || ''}`}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Remove Item">
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleRemoveItem(index)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mt: items.length > 0 ? 1 : 0,
                p: 1,
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: '4px',
              }}
            >
              <TextField
                label="Item Name"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                size="small"
                sx={{ flexGrow: 1 }}
              />
              <TextField
                label="Qty"
                type="number"
                value={newItemQuantity}
                onChange={(e) =>
                  setNewItemQuantity(
                    e.target.value === '' ? '' : Number(e.target.value)
                  )
                }
                size="small"
                sx={{ width: '80px' }}
                inputProps={{ min: 1 }}
              />
              <TextField
                label="Unit"
                value={newItemUnit}
                onChange={(e) => setNewItemUnit(e.target.value)}
                size="small"
                sx={{ width: '100px' }}
              />
              <Tooltip title="Add Item">
                <span>
                  <IconButton
                    onClick={handleAddItem}
                    color="primary"
                    disabled={
                      !newItemName ||
                      !newItemQuantity ||
                      Number(newItemQuantity) <= 0
                    }
                  >
                    <AddCircleOutlineIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Grid>

          {/* Bill Image Upload Section */}
          <Grid item xs={12}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ mt: 2, fontWeight: 500 }}
            >
              Bill Image (Optional)
            </Typography>
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
              sx={{ py: 1.5 }}
            >
              Upload Bill Image
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleFileChange}
              />
            </Button>
            {billImageUrlPreview && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="caption">Image Preview:</Typography>
                <img
                  src={billImageUrlPreview}
                  alt="Bill preview"
                  style={{
                    maxHeight: '150px',
                    maxWidth: '100%',
                    marginTop: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                  }}
                />
              </Box>
            )}
            {!billImage && order?.billImageUrl && !billImageUrlPreview && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="caption">Current Bill Image:</Typography>
                <img
                  src={order.billImageUrl}
                  alt="Current bill"
                  style={{
                    maxHeight: '150px',
                    maxWidth: '100%',
                    marginTop: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                  }}
                />
              </Box>
            )}
          </Grid>

          <Grid item xs={12} sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined" color="secondary" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" color="primary">
                {order ? 'Save Changes' : 'Create Order'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Paper>
  )
}

export default InternOrderForm
