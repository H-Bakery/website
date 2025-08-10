'use client'
import React from 'react'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
} from '@mui/material'
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  LocalShipping as ShippingIcon,
} from '@mui/icons-material'

// Mock data for demonstration
const mockOrders = [
  {
    id: '1234',
    customer: 'Hans Müller',
    date: '2025-08-05 08:30',
    total: 45.5,
    status: 'pending',
    items: 12,
  },
  {
    id: '1235',
    customer: 'Maria Schmidt',
    date: '2025-08-05 09:15',
    total: 28.75,
    status: 'processing',
    items: 8,
  },
  {
    id: '1236',
    customer: 'Thomas Weber',
    date: '2025-08-05 10:00',
    total: 62.3,
    status: 'ready',
    items: 15,
  },
  {
    id: '1237',
    customer: 'Anna Fischer',
    date: '2025-08-05 11:30',
    total: 35.2,
    status: 'delivered',
    items: 9,
  },
]

const statusColors: Record<
  string,
  'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
> = {
  pending: 'warning',
  processing: 'info',
  ready: 'primary',
  delivered: 'success',
  cancelled: 'error',
}

const statusLabels: Record<string, string> = {
  pending: 'Ausstehend',
  processing: 'In Bearbeitung',
  ready: 'Bereit',
  delivered: 'Geliefert',
  cancelled: 'Storniert',
}

export default function AdminOrdersPage() {
  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h4" component="h1">
          Bestellungen
        </Typography>
        <Button
          variant="contained"
          startIcon={<ShippingIcon />}
          sx={{ backgroundColor: '#4CAF50' }}
        >
          Neue Bestellung
        </Button>
      </Box>

      <Paper elevation={2}>
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>Bestell-Nr.</TableCell>
                <TableCell>Kunde</TableCell>
                <TableCell>Datum</TableCell>
                <TableCell>Artikel</TableCell>
                <TableCell align="right">Gesamt</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockOrders.map((order) => (
                <TableRow
                  key={order.id}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    #{order.id}
                  </TableCell>
                  <TableCell>{order.customer}</TableCell>
                  <TableCell>{order.date}</TableCell>
                  <TableCell>{order.items}</TableCell>
                  <TableCell align="right">€{order.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <Chip
                      label={statusLabels[order.status]}
                      color={statusColors[order.status]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="primary"
                      aria-label="view order"
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="primary"
                      aria-label="edit order"
                    >
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Zeige {mockOrders.length} von {mockOrders.length} Bestellungen
        </Typography>
      </Box>
    </Box>
  )
}
