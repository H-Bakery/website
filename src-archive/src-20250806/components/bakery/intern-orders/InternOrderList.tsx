import React from 'react'
import { InternOrder } from '../../../types' // Assuming src/types/index.ts exports InternOrder
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
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
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined' // For bill image

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
          label="Pending"
          color="warning"
          size="small"
          variant="outlined"
        />
      )
    case 'in-progress':
      return (
        <Chip
          icon={<PlayCircleOutlineIcon />}
          label="In Progress"
          color="info"
          size="small"
          variant="outlined"
        />
      )
    case 'done':
      return (
        <Chip
          icon={<CheckCircleOutlineIcon />}
          label="Done"
          color="success"
          size="small"
          variant="outlined"
        />
      )
    case 'cancelled':
      return (
        <Chip
          icon={<CancelIcon />}
          label="Cancelled"
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
          No intern orders found.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create a new order to get started.
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
      <Table sx={{ minWidth: 650 }} aria-label="intern orders table">
        <TableHead sx={{ bgcolor: 'action.hover' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>Order Name</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Assigned To</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Created At</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Items/Qty</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Bill</TableCell>
            <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>
              Actions
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
              <TableCell>{order.assignedTo || 'N/A'}</TableCell>
              <TableCell>
                {new Date(order.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                {order.items && order.items.length > 0
                  ? `${order.items.length} item(s)`
                  : order.quantity
                  ? `${order.quantity} (general)`
                  : 'N/A'}
              </TableCell>
              <TableCell sx={{ textAlign: 'center' }}>
                {order.billImageUrl ? (
                  <Tooltip title="View Bill">
                    <IconButton
                      size="small"
                      onClick={() => window.open(order.billImageUrl, '_blank')}
                    >
                      <ImageOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Typography variant="caption" color="text.disabled">
                    No Bill
                  </Typography>
                )}
              </TableCell>
              <TableCell sx={{ textAlign: 'center' }}>
                <Box
                  sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}
                >
                  {onViewOrder && (
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => onViewOrder(order)}
                        color="primary"
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Edit Order">
                    <IconButton
                      size="small"
                      onClick={() => onEditOrder(order)}
                      color="secondary"
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  {order.status !== 'done' && order.status !== 'cancelled' && (
                    <Tooltip title="Mark as Done">
                      <IconButton
                        size="small"
                        onClick={() => onMarkAsDone(order.id)}
                        color="success"
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
