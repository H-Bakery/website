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
          mb: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: { xs: 1.5, sm: 0 },
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}
        >
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
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nr.</TableCell>
                <TableCell>Kunde</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                  Datum
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  Artikel
                </TableCell>
                <TableCell align="right">Gesamt</TableCell>
                <TableCell>Status</TableCell>
                <TableCell
                  align="center"
                  sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                >
                  Aktionen
                </TableCell>
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
                  <TableCell>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ maxWidth: { xs: 100, sm: 200 } }}
                    >
                      {order.customer}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    {order.date}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    {order.items}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" noWrap>
                      {order.total.toFixed(2)} €
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusLabels[order.status]}
                      color={statusColors[order.status]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                  >
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

      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Zeige {mockOrders.length} von {mockOrders.length} Bestellungen
        </Typography>
      </Box>
    </Box>
  )
}
