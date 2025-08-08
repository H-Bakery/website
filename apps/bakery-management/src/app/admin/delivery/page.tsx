'use client'
import React from 'react'
import {
  Box,
  Container,
  Typography,
  Grid,
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
  LinearProgress,
} from '@mui/material'
import {
  LocalShipping as DeliveryIcon,
  Map as MapIcon,
  DirectionsCar as CarIcon,
  Schedule as ScheduleIcon,
  Phone as PhoneIcon,
  Navigation as NavigationIcon,
} from '@mui/icons-material'

// Mock delivery data
const mockDeliveries = [
  {
    id: '1',
    orderId: '#1234',
    customer: 'Hans Müller',
    address: 'Hauptstraße 15, 80331 München',
    phone: '+49 89 12345678',
    status: 'in-transit',
    driver: 'Max Schmidt',
    estimatedTime: '10:30',
    items: 3,
  },
  {
    id: '2',
    orderId: '#1235',
    customer: 'Maria Weber',
    address: 'Marienplatz 8, 80331 München',
    phone: '+49 89 23456789',
    status: 'in-transit',
    driver: 'Max Schmidt',
    estimatedTime: '10:45',
    items: 2,
  },
  {
    id: '3',
    orderId: '#1236',
    customer: 'Peter Fischer',
    address: 'Sendlinger Str. 42, 80331 München',
    phone: '+49 89 34567890',
    status: 'pending',
    driver: 'Anna Klein',
    estimatedTime: '11:00',
    items: 5,
  },
  {
    id: '4',
    orderId: '#1237',
    customer: 'Lisa Bauer',
    address: 'Leopoldstraße 100, 80802 München',
    phone: '+49 89 45678901',
    status: 'pending',
    driver: 'Anna Klein',
    estimatedTime: '11:30',
    items: 1,
  },
  {
    id: '5',
    orderId: '#1238',
    customer: 'Thomas Meyer',
    address: 'Dachauer Str. 25, 80335 München',
    phone: '+49 89 56789012',
    status: 'delivered',
    driver: 'Max Schmidt',
    estimatedTime: '09:30',
    items: 4,
  },
]

const drivers = [
  {
    name: 'Max Schmidt',
    status: 'active',
    deliveries: 3,
    vehicle: 'VW Caddy (M-AB 1234)',
  },
  {
    name: 'Anna Klein',
    status: 'active',
    deliveries: 2,
    vehicle: 'Ford Transit (M-CD 5678)',
  },
  {
    name: 'Thomas Wagner',
    status: 'break',
    deliveries: 0,
    vehicle: 'Mercedes Sprinter (M-EF 9012)',
  },
]

export default function AdminDeliveryPage() {
  const activeDeliveries = mockDeliveries.filter(
    (d) => d.status === 'in-transit'
  ).length
  const pendingDeliveries = mockDeliveries.filter(
    (d) => d.status === 'pending'
  ).length
  const completedDeliveries = mockDeliveries.filter(
    (d) => d.status === 'delivered'
  ).length

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h4" component="h1">
            <DeliveryIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
            Lieferungen
          </Typography>
          <Button variant="contained" startIcon={<MapIcon />} color="primary">
            Karte anzeigen
          </Button>
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          Lieferstatus und Routen verwalten
        </Typography>
      </Box>

      {/* Delivery Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Aktive Lieferungen
            </Typography>
            <Typography variant="h3" color="primary">
              {activeDeliveries}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Unterwegs
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Wartende Bestellungen
            </Typography>
            <Typography variant="h3" color="warning.main">
              {pendingDeliveries}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Bereit für Lieferung
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Heute abgeschlossen
            </Typography>
            <Typography variant="h3" color="success.main">
              {completedDeliveries}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Erfolgreich zugestellt
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Active Drivers */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Aktive Fahrer
        </Typography>
        <Grid container spacing={2}>
          {drivers.map((driver) => (
            <Grid item xs={12} md={4} key={driver.name}>
              <Box
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={500}>
                    {driver.name}
                  </Typography>
                  <Chip
                    label={driver.status === 'active' ? 'Aktiv' : 'Pause'}
                    color={driver.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <CarIcon
                    sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }}
                  />
                  {driver.vehicle}
                </Typography>
                <Typography variant="body2">
                  {driver.deliveries} Lieferungen zugewiesen
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Delivery List */}
      <Paper elevation={2}>
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>Bestellung</TableCell>
                <TableCell>Kunde</TableCell>
                <TableCell>Adresse</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Fahrer</TableCell>
                <TableCell>Zeit</TableCell>
                <TableCell align="center">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockDeliveries.map((delivery) => (
                <TableRow
                  key={delivery.id}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {delivery.orderId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {delivery.items} Artikel
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{delivery.customer}</Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <PhoneIcon sx={{ fontSize: 14 }} />
                      <Typography variant="caption" color="text.secondary">
                        {delivery.phone}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{delivery.address}</TableCell>
                  <TableCell>
                    <Chip
                      label={
                        delivery.status === 'delivered'
                          ? 'Zugestellt'
                          : delivery.status === 'in-transit'
                          ? 'Unterwegs'
                          : 'Wartend'
                      }
                      color={
                        delivery.status === 'delivered'
                          ? 'success'
                          : delivery.status === 'in-transit'
                          ? 'primary'
                          : 'default'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{delivery.driver}</TableCell>
                  <TableCell>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <ScheduleIcon fontSize="small" color="action" />
                      {delivery.estimatedTime}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="primary"
                      aria-label="navigate"
                    >
                      <NavigationIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Route Optimization Info */}
      <Box sx={{ mt: 3, p: 3, bgcolor: 'info.light', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom color="info.dark">
          Routenoptimierung
        </Typography>
        <Typography variant="body2" color="info.dark">
          Die heutige Route wurde optimiert. Geschätzte Einsparung: 12 km und 25
          Minuten gegenüber der Standardroute.
        </Typography>
        <LinearProgress
          variant="determinate"
          value={65}
          sx={{ mt: 2, height: 8, borderRadius: 4 }}
        />
        <Typography
          variant="caption"
          color="info.dark"
          sx={{ mt: 1, display: 'block' }}
        >
          65% der heutigen Lieferungen abgeschlossen
        </Typography>
      </Box>
    </Box>
  )
}
