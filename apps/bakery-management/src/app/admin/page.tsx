'use client'
import React from 'react'
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  CardActions,
  Button,
  LinearProgress,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  ShoppingBasket as OrdersIcon,
  Inventory as InventoryIcon,
  LocalShipping as DeliveryIcon,
  Factory as ProductionIcon,
  ListAlt as BakingListIcon,
  Store as ProductsIcon,
  Assessment as ReportsIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Euro as EuroIcon,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'

// Mock data for dashboard statistics
const dashboardStats = {
  todayOrders: 23,
  todayRevenue: 1847.5,
  activeDeliveries: 8,
  lowStockItems: 3,
  productionEfficiency: 87,
  customerCount: 156,
}

const quickLinks = [
  {
    title: 'Bestellungen',
    description: 'Bestellungen verwalten und bearbeiten',
    icon: <OrdersIcon fontSize="large" />,
    href: '/admin/orders',
    color: '#4CAF50',
  },
  {
    title: 'Inventar',
    description: 'Lagerbestände und Rohstoffe verwalten',
    icon: <InventoryIcon fontSize="large" />,
    href: '/admin/inventory',
    color: '#FF9800',
  },
  {
    title: 'Produktion',
    description: 'Produktionsplanung und -steuerung',
    icon: <ProductionIcon fontSize="large" />,
    href: '/admin/production',
    color: '#2196F3',
  },
  {
    title: 'Lieferungen',
    description: 'Lieferstatus und Routen verwalten',
    icon: <DeliveryIcon fontSize="large" />,
    href: '/admin/delivery',
    color: '#9C27B0',
  },
  {
    title: 'Backliste',
    description: 'Tägliche Produktion planen',
    icon: <BakingListIcon fontSize="large" />,
    href: '/admin/baking-list',
    color: '#00BCD4',
  },
  {
    title: 'Produkte',
    description: 'Produktkatalog verwalten',
    icon: <ProductsIcon fontSize="large" />,
    href: '/admin/products',
    color: '#E91E63',
  },
  {
    title: 'Berichte',
    description: 'Analysen und Berichte anzeigen',
    icon: <ReportsIcon fontSize="large" />,
    href: '/admin/reports',
    color: '#795548',
  },
]

export default function AdminDashboardPage() {
  const router = useRouter()

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: { xs: 2, md: 4 } }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}
        >
          <DashboardIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Dashboard
        </Typography>
        <Typography
          variant="subtitle1"
          color="text.secondary"
          sx={{ display: { xs: 'none', sm: 'block' } }}
        >
          Willkommen im Verwaltungsbereich Ihrer Bäckerei
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid
        container
        spacing={{ xs: 1.5, md: 3 }}
        sx={{ mb: { xs: 2, md: 4 } }}
      >
        <Grid item xs={6} sm={6} md={3}>
          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Box>
                <Typography color="text.secondary" variant="body2">
                  Bestellungen
                </Typography>
                <Typography
                  variant="h4"
                  sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' } }}
                >
                  {dashboardStats.todayOrders}
                </Typography>
              </Box>
              <OrdersIcon
                sx={{
                  color: 'primary.main',
                  fontSize: { xs: 28, md: 40 },
                }}
              />
            </Box>
            <Box
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 1,
              }}
            >
              <TrendingUpIcon sx={{ color: 'success.main', fontSize: 20 }} />
              <Typography variant="body2" color="success.main">
                +12% gegenüber gestern
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={6} sm={6} md={3}>
          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Box>
                <Typography color="text.secondary" variant="body2">
                  Umsatz
                </Typography>
                <Typography
                  variant="h4"
                  sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' } }}
                >
                  {dashboardStats.todayRevenue.toFixed(0)}€
                </Typography>
              </Box>
              <EuroIcon
                sx={{
                  color: 'success.main',
                  fontSize: { xs: 28, md: 40 },
                }}
              />
            </Box>
            <Box
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 1,
              }}
            >
              <TrendingUpIcon sx={{ color: 'success.main', fontSize: 20 }} />
              <Typography variant="body2" color="success.main">
                +8% gegenüber gestern
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={6} sm={6} md={3}>
          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Box>
                <Typography color="text.secondary" variant="body2">
                  Lieferungen
                </Typography>
                <Typography
                  variant="h4"
                  sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' } }}
                >
                  {dashboardStats.activeDeliveries}
                </Typography>
              </Box>
              <DeliveryIcon
                sx={{
                  color: 'info.main',
                  fontSize: { xs: 28, md: 40 },
                }}
              />
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              3 unterwegs, 5 in Vorbereitung
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} sm={6} md={3}>
          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Box>
                <Typography color="text.secondary" variant="body2">
                  Niedrig im Lager
                </Typography>
                <Typography
                  variant="h4"
                  color="warning.main"
                  sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' } }}
                >
                  {dashboardStats.lowStockItems}
                </Typography>
              </Box>
              <InventoryIcon
                sx={{
                  color: 'warning.main',
                  fontSize: { xs: 28, md: 40 },
                }}
              />
            </Box>
            <Button
              size="small"
              color="warning"
              onClick={() => router.push('/admin/inventory')}
            >
              Inventar prüfen
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Quick Links */}
      <Typography
        variant="h5"
        gutterBottom
        sx={{
          mb: { xs: 1.5, md: 3 },
          fontSize: { xs: '1.25rem', md: '1.5rem' },
        }}
      >
        Schnellzugriff
      </Typography>
      <Grid
        container
        spacing={{ xs: 1.5, md: 3 }}
        sx={{ mb: { xs: 2, md: 4 } }}
      >
        {quickLinks.map((link) => (
          <Grid item xs={6} sm={6} md={4} lg={3} key={link.href}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition:
                  'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
              onClick={() => router.push(link.href)}
            >
              <CardContent
                sx={{ flexGrow: 1, textAlign: 'center', p: { xs: 1.5, md: 2 } }}
              >
                <Box
                  sx={{
                    color: link.color,
                    mb: { xs: 1, md: 2 },
                  }}
                >
                  {link.icon}
                </Box>
                <Typography
                  variant="h6"
                  component="h2"
                  gutterBottom
                  sx={{ fontSize: { xs: '0.95rem', md: '1.25rem' } }}
                >
                  {link.title}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ display: { xs: 'none', sm: 'block' } }}
                >
                  {link.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Production Overview */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Produktionsübersicht
            </Typography>
            <Box sx={{ mb: 3 }}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
              >
                <Typography variant="body2">Produktionseffizienz</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {dashboardStats.productionEfficiency}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={dashboardStats.productionEfficiency}
                sx={{ height: 10, borderRadius: 5 }}
                color="success"
              />
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Aktive Linien
                </Typography>
                <Typography variant="h6">3 von 4</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Heutige Produktion
                </Typography>
                <Typography variant="h6">1,250 Einheiten</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Kundenübersicht
            </Typography>
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PeopleIcon sx={{ color: 'primary.main', fontSize: 48 }} />
                <Box>
                  <Typography variant="h4">
                    {dashboardStats.customerCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Registrierte Kunden
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Neue diese Woche
                </Typography>
                <Typography variant="h6">12</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Aktive heute
                </Typography>
                <Typography variant="h6">48</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
