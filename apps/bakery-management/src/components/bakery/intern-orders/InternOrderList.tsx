import React from 'react'
import { InternOrder } from '../../../types'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  Box,
  IconButton,
  Tooltip,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityIcon from '@mui/icons-material/Visibility'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import CancelIcon from '@mui/icons-material/Cancel'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'

interface InternOrderListProps {
  orders: InternOrder[]
  onEditOrder: (order: InternOrder) => void
  onViewOrder?: (order: InternOrder) => void // Optional: if a separate detail view is implemented
  onMarkAsDone: (orderId: string) => void
  // Add other handlers as needed, e.g., onDeleteOrder
}

const getStatusChip = (status: InternOrder['status']) => {
  switch (status) {
    case 'pending':
      return (
        <Chip
          icon={<HourglassEmptyIcon />}
          label="Offen"
          color="warning"
          size="small"
          variant="outlined"
        />
      )
    case 'in-progress':
      return (
        <Chip
          icon={<PlayCircleOutlineIcon />}
          label="In Bearbeitung"
          color="info"
          size="small"
          variant="outlined"
        />
      )
    case 'done':
      return (
        <Chip
          icon={<CheckCircleOutlineIcon />}
          label="Erledigt"
          color="success"
          size="small"
          variant="outlined"
        />
      )
    case 'cancelled':
      return (
        <Chip
          icon={<CancelIcon />}
          label="Storniert"
          color="error"
          size="small"
          variant="outlined"
        />
      )
    default:
      return <Chip label={status} size="small" variant="outlined" />
  }
}

const InternOrderList: React.FC<InternOrderListProps> = ({
  orders,
  onEditOrder,
  onViewOrder,
  onMarkAsDone,
}) => {
  if (orders.length === 0) {
    return (
      <Paper elevation={1} sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Keine internen Bestellungen vorhanden.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Legen Sie eine neue Bestellung an, um zu beginnen.
        </Typography>
      </Paper>
    )
  }

  return (
    <TableContainer
      component={Paper}
      elevation={1}
      sx={{ borderRadius: '8px' }}
    >
      <Table aria-label="Interne Bestellungen">
        <TableHead sx={{ bgcolor: 'action.hover' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>Bezeichnung</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
            <TableCell
              sx={{
                fontWeight: 'bold',
                display: { xs: 'none', sm: 'table-cell' },
              }}
            >
              Zuständig
            </TableCell>
            <TableCell
              sx={{
                fontWeight: 'bold',
                display: { xs: 'none', md: 'table-cell' },
              }}
            >
              Erstellt am
            </TableCell>
            <TableCell
              sx={{
                fontWeight: 'bold',
                display: { xs: 'none', sm: 'table-cell' },
              }}
            >
              Posten/Menge
            </TableCell>
            <TableCell
              sx={{
                fontWeight: 'bold',
                display: { xs: 'none', md: 'table-cell' },
              }}
            >
              Beleg
            </TableCell>
            <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>
              Aktionen
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.id}
              sx={{
                '&:last-child td, &:last-child th': { border: 0 },
                '&:hover': { backgroundColor: 'action.selected' },
              }}
            >
              <TableCell component="th" scope="row">
                <Typography variant="subtitle2" component="div">
                  {order.orderName}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', maxWidth: 250, whiteSpace: 'normal' }}
                >
                  {order.description}
                </Typography>
              </TableCell>
              <TableCell>{getStatusChip(order.status)}</TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                {order.assignedTo || '–'}
              </TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                {new Date(order.createdAt).toLocaleDateString('de-DE')}
              </TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                {order.items && order.items.length > 0
                  ? `${order.items.length} Posten`
                  : order.quantity
                  ? `${order.quantity} (gesamt)`
                  : '–'}
              </TableCell>
              <TableCell
                sx={{
                  textAlign: 'center',
                  display: { xs: 'none', md: 'table-cell' },
                }}
              >
                {order.billImageUrl ? (
                  <Tooltip title="Beleg anzeigen">
                    <IconButton
                      size="small"
                      component="a"
                      href={order.billImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Beleg anzeigen"
                    >
                      <ImageOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Typography variant="caption" color="text.disabled">
                    Kein Beleg
                  </Typography>
                )}
              </TableCell>
              <TableCell sx={{ textAlign: 'center' }}>
                <Box
                  sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}
                >
                  {onViewOrder && (
                    <Tooltip title="Details anzeigen">
                      <IconButton
                        size="small"
                        onClick={() => onViewOrder(order)}
                        color="primary"
                        aria-label="Details anzeigen"
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Bearbeiten">
                    <IconButton
                      size="small"
                      onClick={() => onEditOrder(order)}
                      color="secondary"
                      aria-label="Bearbeiten"
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  {order.status !== 'done' && order.status !== 'cancelled' && (
                    <Tooltip title="Als erledigt markieren">
                      <IconButton
                        size="small"
                        onClick={() => onMarkAsDone(order.id)}
                        color="success"
                        aria-label="Als erledigt markieren"
                      >
                        <CheckCircleOutlineIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default InternOrderList
