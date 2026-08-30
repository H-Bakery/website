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
  Tooltip,
} from '@mui/material'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import DeleteIcon from '@mui/icons-material/Delete'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'

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
  /** Disables the action buttons while a submission is in flight */
  isSubmitting?: boolean
}

const InternOrderForm: React.FC<InternOrderFormProps> = ({
  order,
  onSubmit,
  onCancel,
  isSubmitting = false,
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

  /**
   * The item row that has been typed into the input fields but not yet added
   * with the "+" button, or null if it is incomplete.
   */
  const pendingItem = (): FormItem | null =>
    newItemName && Number(newItemQuantity) > 0
      ? {
          itemName: newItemName,
          itemQuantity: Number(newItemQuantity),
          unit: newItemUnit,
        }
      : null

  const handleAddItem = () => {
    const item = pendingItem()
    if (!item) return
    setItems([...items, item])
    setNewItemName('')
    setNewItemQuantity('')
    setNewItemUnit('')
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

  // Revoke object URLs created for previews to avoid memory leaks
  useEffect(() => {
    if (!billImage || !billImageUrlPreview) return
    const url = billImageUrlPreview
    return () => URL.revokeObjectURL(url)
  }, [billImage, billImageUrlPreview])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    // Fold in a row that was typed but never added with "+", which would
    // otherwise be discarded silently.
    const pending = pendingItem()
    const allItems = pending ? [...items, pending] : items
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
      items: allItems.length > 0 ? allItems : undefined,
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
        {order ? 'Interne Bestellung bearbeiten' : 'Neue interne Bestellung'}
      </Typography>
      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Bezeichnung"
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
                <MenuItem value="pending">Offen</MenuItem>
                <MenuItem value="in-progress">In Bearbeitung</MenuItem>
                <MenuItem value="done">Erledigt</MenuItem>
                <MenuItem value="cancelled">Storniert</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Beschreibung"
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
              label="Zuständig (optional)"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              fullWidth
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Gesamtmenge (optional, falls keine Einzelposten)"
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
              Einzelposten (optional)
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
                    secondary={`Menge: ${item.itemQuantity} ${
                      item.unit || ''
                    }`.trim()}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Posten entfernen">
                      <IconButton
                        edge="end"
                        aria-label="Posten entfernen"
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
                flexWrap: 'wrap',
                gap: 1,
                mt: items.length > 0 ? 1 : 0,
                p: 1,
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: '4px',
              }}
            >
              <TextField
                label="Artikel"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                size="small"
                sx={{ flexGrow: 1, minWidth: 140 }}
              />
              <TextField
                label="Menge"
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
                label="Einheit"
                value={newItemUnit}
                onChange={(e) => setNewItemUnit(e.target.value)}
                size="small"
                sx={{ width: '100px' }}
              />
              <Tooltip title="Posten hinzufügen">
                <span>
                  <IconButton
                    onClick={handleAddItem}
                    color="primary"
                    aria-label="Posten hinzufügen"
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
              Rechnungsbeleg (optional)
            </Typography>
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
              sx={{ py: 1.5 }}
            >
              Beleg hochladen
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleFileChange}
              />
            </Button>
            {billImageUrlPreview && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="caption">Vorschau:</Typography>
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob/preview URL */}
                <img
                  src={billImageUrlPreview}
                  alt="Vorschau des Rechnungsbelegs"
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
              <Button
                variant="outlined"
                color="secondary"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isSubmitting}
              >
                {order ? 'Änderungen speichern' : 'Bestellung anlegen'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Paper>
  )
}

export default InternOrderForm
