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
  Description as ReportsIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'

const QUICK_ACTIONS = [
  {
    title: 'Bestellungen verwalten',
    description: 'Neue Bestellungen anzeigen und bearbeiten',
    icon: <OrdersIcon fontSize="large" />,
    href: '/admin/orders',
    color: '#4CAF50',
  },
  {
    title: 'Lagerbestand',
    description: 'Inventar und Bestände verwalten',
    icon: <InventoryIcon fontSize="large" />,
    href: '/admin/inventory',
    color: '#FF9800',
  },
  {
    title: 'Lieferungen',
    description: 'Lieferstatus und Routen verwalten',
    icon: <DeliveryIcon fontSize="large" />,
    href: '/admin/delivery',
    color: '#2196F3',
  },
  {
    title: 'Berichte',
    description: 'Umsatz und Leistungsberichte anzeigen',
    icon: <ReportsIcon fontSize="large" />,
    href: '/admin/reports',
    color: '#9C27B0',
  },
]

export default function AdminDashboard() {
  const router = useRouter()

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ flexGrow: 1 }}>
        <Typography
          variant="h3"
          component="h1"
          gutterBottom
          sx={{
            color: 'primary.main',
            fontWeight: 'bold',
            mb: 3,
          }}
        >
          <DashboardIcon sx={{ mr: 2, fontSize: 'inherit' }} />
          Verwaltungs-Dashboard
        </Typography>

        <Grid container spacing={3}>
          {/* Quick Actions */}
          <Grid item xs={12}>
            <Paper
              elevation={3}
              sx={{
                p: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
              }}
            >
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                Schnellzugriff
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {QUICK_ACTIONS.map((action, index) => (
                  <Grid item xs={12} sm={6} md={3} key={index}>
                    <Card
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'transform 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4,
                        },
                      }}
                    >
                      <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                        <Box
                          sx={{
                            color: action.color,
                            mb: 2,
                          }}
                        >
                          {action.icon}
                        </Box>
                        <Typography
                          variant="h6"
                          component="h2"
                          gutterBottom
                          sx={{ fontWeight: 'bold' }}
                        >
                          {action.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {action.description}
                        </Typography>
                      </CardContent>
                      <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => router.push(action.href)}
                          sx={{
                            backgroundColor: action.color,
                            '&:hover': {
                              backgroundColor: action.color,
                              opacity: 0.8,
                            },
                          }}
                        >
                          Öffnen
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>

          {/* System Status */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                System Status
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: '#4CAF50',
                      mr: 1,
                    }}
                  />
                  <Typography variant="body2">API Server: Online</Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: '#4CAF50',
                      mr: 1,
                    }}
                  />
                  <Typography variant="body2">Database: Connected</Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: '#4CAF50',
                      mr: 1,
                    }}
                  />
                  <Typography variant="body2">Cache: Active</Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* Recent Activity */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Letzte Aktivitäten
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  • Neue Bestellung #1234 erhalten
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  • Lagerbestand für Brot aktualisiert
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  • Lieferung #5678 abgeschlossen
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  • Wochenbericht generiert
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  )
}
