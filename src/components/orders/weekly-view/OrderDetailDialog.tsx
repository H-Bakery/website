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
  alpha,
  Card,
  CardContent,
  Tooltip,
} from '@mui/material'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'
import PrintIcon from '@mui/icons-material/Print'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PersonIcon from '@mui/icons-material/Person'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import NotesIcon from '@mui/icons-material/Notes'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
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

  const formatDate = (date: string | Date, formatString: string) => {
    try {
      if (typeof date === 'string') {
        return format(parseISO(date), formatString, { locale: de })
      }
      return format(date as Date, formatString, { locale: de })
    } catch (error) {
      console.error('Date formatting error:', error)
      return 'Ungültiges Datum'
    }
  }

  const formattedDate = formatDate(order.pickupDate, 'EEEE, dd. MMMM yyyy')
  const formattedTime = formatDate(order.pickupDate, 'HH:mm')
  const createdDate = order.createdAt ? formatDate(order.createdAt, 'dd.MM.yyyy HH:mm') : '-'

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
  const totalItems = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0
  const hasDiscount = order.totalPrice < order.items?.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || false

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: theme.shadows[10],
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          pr: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: alpha(theme.palette.primary.main, 0.03),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box 
            sx={{ 
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              borderRadius: '50%',
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingCartIcon />
          </Box>
          <Box>
            <Typography variant="h6" component="div" fontWeight={600}>
              Bestellung #{order.id}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Chip
                label={getStatusText(order.status)}
                color={getStatusColor(order.status) as any}
                size="small"
              />
              <Typography variant="caption" color="text.secondary">
                Erstellt am {createdDate}
              </Typography>
            </Box>
          </Box>
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            bgcolor: alpha(theme.palette.grey[500], 0.1),
            '&:hover': {
              bgcolor: alpha(theme.palette.grey[500], 0.2),
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Customer and Pickup Information Cards */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <PersonIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="subtitle1" fontWeight={600}>
                          Kundeninformationen
                        </Typography>
                      </Box>
                      <Typography variant="body1" fontWeight={500} sx={{ mb: 1 }}>
                        {order.customerName}
                      </Typography>
                      
                      {order.customerPhone && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                          <PhoneIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                          <Typography variant="body2">
                            {order.customerPhone}
                          </Typography>
                        </Box>
                      )}
                      
                      {order.customerEmail && (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <EmailIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                          <Typography variant="body2">
                            {order.customerEmail}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Card 
                    variant="outlined" 
                    sx={{ 
                      height: '100%',
                      borderColor: theme.palette.primary.main,
                      bgcolor: alpha(theme.palette.primary.main, 0.03)
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <AccessTimeIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="subtitle1" fontWeight={600}>
                          Abholungsinformationen
                        </Typography>
                      </Box>
                      <Typography variant="body1" fontWeight={500} sx={{ mb: 1 }}>
                        {formattedDate}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Chip 
                          label={`${formattedTime} Uhr`} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Notes Section */}
              {order.notes && (
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <NotesIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Notizen zur Bestellung
                      </Typography>
                    </Box>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        bgcolor: alpha(theme.palette.background.default, 0.7),
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body2">{order.notes}</Typography>
                    </Paper>
                  </CardContent>
                </Card>
              )}

              {/* Order Items Section */}
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <ShoppingCartIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Bestellte Artikel
                      </Typography>
                    </Box>
                    <Chip 
                      label={`${totalItems} ${totalItems === 1 ? 'Artikel' : 'Artikel'}`} 
                      size="small" 
                      color="primary"
                    />
                  </Box>
                  
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                          <TableCell sx={{ fontWeight: 600 }}>Produkt</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Anzahl</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Einzelpreis</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Gesamt</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {order.items && order.items.map((item: OrderItem, index: number) => (
                          <TableRow key={index} hover>
                            <TableCell component="th" scope="row">
                              <Typography variant="body2" fontWeight={500}>
                                {item.productName}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={item.quantity} 
                                size="small" 
                                variant="outlined"
                                sx={{ minWidth: '40px' }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {item.unitPrice.toFixed(2)} €
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 500 }}>
                              {(item.quantity * item.unitPrice).toFixed(2)} €
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                          <TableCell colSpan={2} />
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            Gesamtsumme
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                            {order.totalPrice.toFixed(2)} €
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card 
              variant="outlined" 
              sx={{ 
                bgcolor: alpha(theme.palette.primary.main, 0.03),
                height: '100%'
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Bestellübersicht
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Bestellnummer
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      #{order.id}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip
                      label={getStatusText(order.status)}
                      color={getStatusColor(order.status) as any}
                      size="small"
                    />
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Anzahl Artikel
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {totalItems}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Abholungsdatum
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {formatDate(order.pickupDate, 'dd.MM.yyyy')}
                    </Typography>
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 3, mb: 2 }}>
                  <Divider />
                </Box>
                
                <Box sx={{ bgcolor: theme.palette.background.paper, p: 2, borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Gesamtbetrag
                  </Typography>
                  <Typography variant="h5" fontWeight={600} color="primary.main">
                    {order.totalPrice.toFixed(2)} €
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'space-between', borderTop: `1px solid ${theme.palette.divider}` }}>
        <Tooltip title="Bestellung unwiderruflich löschen">
          <Button 
            startIcon={<DeleteIcon />}
            variant="outlined"
            color="error"
            onClick={() => {
              if (confirm('Möchten Sie diese Bestellung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
                onDelete(order.id)
                onClose()
              }
            }}
          >
            Löschen
          </Button>
        </Tooltip>

        <Box>
          <Button
            startIcon={<PrintIcon />}
            variant="outlined"
            sx={{ mr: 1 }}
            onClick={() => {
              // Print functionality would go here
              console.log('Print order:', order.id)
              alert('Druckfunktion wird implementiert...')
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
