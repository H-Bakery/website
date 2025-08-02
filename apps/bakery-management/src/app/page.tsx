'use client'
import React from 'react'
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Button,
  Card,
  CardContent,
  CardActions,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  ShoppingBasket as OrdersIcon,
  Inventory as InventoryIcon,
  LocalShipping as DeliveryIcon,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { Header, Footer, MetricCard } from '@bakery/shared/ui'

const QUICK_ACTIONS = [
  {
    title: 'Bestellungen verwalten',
    description: 'Neue Bestellungen anzeigen und bearbeiten',
    icon: <OrdersIcon fontSize="large" />,
    href: '/admin/orders',
    color: 'primary',
  },
  {
    title: 'Produktion planen',
    description: 'Backliste und Produktionsplanung',
    icon: <InventoryIcon fontSize="large" />,
    href: '/admin/production',
    color: 'secondary',
  },
  {
    title: 'Lieferungen',
    description: 'Lieferstatus und Routen verwalten',
    icon: <DeliveryIcon fontSize="large" />,
    href: '/admin/delivery',
    color: 'success',
  },
]

export default function AdminDashboard() {
  const router = useRouter()

  return (
    <Box>
      <Header />

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Dashboard Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            <DashboardIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
            Admin Dashboard
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Willkommen im Verwaltungsbereich der Bäckerei Heusser
          </Typography>
        </Box>

        {/* Metrics Overview */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Heute Bestellungen"
              value="12"
              change="+20%"
              trend="up"
              color="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Offene Bestellungen"
              value="5"
              change="-2"
              trend="down"
              color="warning"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Umsatz Heute"
              value="€234,50"
              change="+15%"
              trend="up"
              color="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Produktionsauslastung"
              value="85%"
              change="+5%"
              trend="up"
              color="info"
            />
          </Grid>
        </Grid>

        {/* Quick Actions */}
        <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3 }}>
          Schnellzugriff
        </Typography>

        <Grid container spacing={3}>
          {QUICK_ACTIONS.map((action, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  '&:hover': {
                    boxShadow: 6,
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
                onClick={() => router.push(action.href)}
              >
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Box
                    sx={{
                      color: `${action.color}.main`,
                      mb: 2,
                    }}
                  >
                    {action.icon}
                  </Box>
                  <Typography variant="h6" component="h3" gutterBottom>
                    {action.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {action.description}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
                  <Button variant="outlined" color={action.color as any}>
                    Öffnen
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Recent Activity */}
        <Box sx={{ mt: 6 }}>
          <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3 }}>
            Letzte Aktivitäten
          </Typography>

          <Paper sx={{ p: 3 }}>
            <Typography variant="body1" color="text.secondary">
              Hier werden die neuesten Bestellungen, Produktionsaktivitäten und
              andere wichtige Ereignisse angezeigt.
            </Typography>
          </Paper>
        </Box>
      </Container>

      <Footer />
    </Box>
  )
}
