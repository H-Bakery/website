import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Chip,
  Divider,
  Grid,
  useTheme,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'
import PrintIcon from '@mui/icons-material/Print'
import { Order, OrderItem } from '../../../services/types'

interface OrderDetailDialogProps {
  order: Order | null
  open: boolean
  onClose: () => void
  onEdit: (order: Order) => void
  onDelete: (orderId: string | number) => void
}

const OrderDetailDialog: React.FC<OrderDetailDialogProps> = ({
  order,
  open,
  onClose,
  onEdit,
  onDelete,
}) => {
  const theme = useTheme()

  if (!order) {
    return null
  }

  const formattedDate =
    typeof order.pickupDate === 'string'
      ? format(parseISO(order.pickupDate), 'EEEE, dd. MMMM yyyy', {
          locale: de,
        })
      : format(order.pickupDate as Date, 'EEEE, dd. MMMM yyyy', { locale: de })

  const formattedTime =
    typeof order.pickupDate === 'string'
      ? format(parseISO(order.pickupDate), 'HH:mm', { locale: de })
      : format(order.pickupDate as Date, 'HH:mm', { locale: de })

  // Helper to get status color
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

  // Helper to get status text in German
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

  // Calculate total items and price
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: theme.shadows[10],
        },
      }}
    >
      <DialogTitle
        sx={{
          pr: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography variant="h6" component="div" fontWeight={600}>
            Bestellung #{order.id}
          </Typography>
          <Chip
            label={getStatusText(order.status)}
            color={getStatusColor(order.status) as any}
            size="small"
            sx={{ mt: 1 }}
          />
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Kunde
            </Typography>
            <Typography variant="body1" fontWeight={500}>
              {order.customerName}
            </Typography>
            {order.customerPhone && (
              <Typography variant="body2" color="text.secondary">
                {order.customerPhone}
              </Typography>
            )}
            {order.customerEmail && (
              <Typography variant="body2" color="text.secondary">
                {order.customerEmail}
              </Typography>
            )}
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Abholung
            </Typography>
            <Typography variant="body1" fontWeight={500}>
              {formattedDate}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formattedTime} Uhr
            </Typography>
          </Grid>

          {order.notes && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Notizen
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  mt: 0.5,
                }}
              >
                <Typography variant="body2">{order.notes}</Typography>
              </Paper>
            </Grid>
          )}

          <Grid item xs={12}>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mt: 1, mb: 1 }}
            >
              Bestellte Artikel
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.default' }}>
                    <TableCell>Produkt</TableCell>
                    <TableCell align="right">Anzahl</TableCell>
                    <TableCell align="right">Preis</TableCell>
                    <TableCell align="right">Gesamt</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {order.items.map((item: OrderItem, index: number) => (
                    <TableRow key={index}>
                      <TableCell component="th" scope="row">
                        {item.productName}
                      </TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">
                        {item.unitPrice.toFixed(2)} €
                      </TableCell>
                      <TableCell align="right">
                        {(item.quantity * item.unitPrice).toFixed(2)} €
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} />
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      Gesamtsumme
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {order.totalPrice.toFixed(2)} €
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button
          startIcon={<DeleteIcon />}
          variant="outlined"
          color="error"
          onClick={() => {
            onDelete(order.id)
            onClose()
          }}
        >
          Löschen
        </Button>

        <Box>
          <Button
            startIcon={<PrintIcon />}
            variant="outlined"
            sx={{ mr: 1 }}
            onClick={() => {
              // Print functionality would go here
              console.log('Print order:', order.id)
            }}
          >
            Drucken
          </Button>
          <Button
            startIcon={<EditIcon />}
            variant="contained"
            onClick={() => {
              onEdit(order)
              onClose()
            }}
          >
            Bearbeiten
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}

export default OrderDetailDialog
