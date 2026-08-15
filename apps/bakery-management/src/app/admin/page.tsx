'use client'
import React from 'react'
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Button,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
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
  Insights as AnalyticsIcon,
  Category as CategoryIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Circle as CircleIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@bakery/shared/data-access'
import { useNotifications } from '@bakery/shared/contexts'

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
    description: 'Berichte und Zeitpläne',
    icon: <ReportsIcon fontSize="large" />,
    href: '/admin/reports',
    color: '#795548',
  },
  {
    title: 'Analysen',
    description: 'Umsatz- und Produktanalysen',
    icon: <AnalyticsIcon fontSize="large" />,
    href: '/admin/analytics',
    color: '#607D8B',
  },
]

interface ProductSummary {
  available?: boolean
}

interface OrderSummary {
  status?: string
}

interface ProductionSummary {
  status?: string
}

interface DashboardStats {
  ordersTotal: number
  ordersOpen: number
  productsTotal: number
  productsAvailable: number
  productsUnavailable: number
  productionTotal: number
  productionCompleted: number
}

type ApiStatus = 'checking' | 'online' | 'offline'

const EMPTY_STATS: DashboardStats = {
  ordersTotal: 0,
  ordersOpen: 0,
  productsTotal: 0,
  productsAvailable: 0,
  productsUnavailable: 0,
  productionTotal: 0,
  productionCompleted: 0,
}

const OPEN_ORDER_STATES = new Set(['pending', 'confirmed', 'processing'])

const notificationColor: Record<string, string> = {
  success: 'success.main',
  warning: 'warning.main',
  error: 'error.main',
  info: 'info.main',
}

function formatRelativeTime(value: Date | string): string {
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.round(diffMs / 60000)
  if (Number.isNaN(minutes)) return ''
  if (minutes < 1) return 'gerade eben'
  if (minutes < 60) return `vor ${minutes} Min.`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `vor ${hours} Std.`
  return date.toLocaleDateString('de-DE')
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const { notifications, isLoading: notificationsLoading } = useNotifications()

  const [stats, setStats] = React.useState<DashboardStats>(EMPTY_STATS)
  const [loading, setLoading] = React.useState(true)
  const [apiStatus, setApiStatus] = React.useState<ApiStatus>('checking')
  const [lastCheck, setLastCheck] = React.useState<Date | null>(null)

  const loadDashboard = React.useCallback(async () => {
    setLoading(true)
    setApiStatus('checking')

    const safe = <T,>(request: Promise<T>) => request.catch(() => null)
    const [orders, products, production] = await Promise.all([
      safe(apiClient.get<OrderSummary[]>('/api/orders')),
      safe(apiClient.get<ProductSummary[]>('/api/products')),
      safe(apiClient.get<ProductionSummary[]>('/api/production')),
    ])

    // If none of the requests came back, the API is unreachable.
    const anySuccess = [orders, products, production].some((r) => r?.success)
    setApiStatus(anySuccess ? 'online' : 'offline')
    setLastCheck(new Date())

    const ordersData = Array.isArray(orders?.data) ? orders.data : []
    const productsData = Array.isArray(products?.data) ? products.data : []
    const productionData = Array.isArray(production?.data)
      ? production.data
      : []

    setStats({
      ordersTotal: ordersData.length,
      ordersOpen: ordersData.filter((o) =>
        OPEN_ORDER_STATES.has(o.status ?? '')
      ).length,
      productsTotal: productsData.length,
      productsAvailable: productsData.filter((p) => p.available === true)
        .length,
      productsUnavailable: productsData.filter((p) => p.available === false)
        .length,
      productionTotal: productionData.length,
      productionCompleted: productionData.filter(
        (p) => p.status === 'completed'
      ).length,
    })
    setLoading(false)
  }, [])

  React.useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const productionProgress =
    stats.productionTotal > 0
      ? Math.round((stats.productionCompleted / stats.productionTotal) * 100)
      : 0

  const recentNotifications = [...notifications]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5)

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

      {loading && <LinearProgress sx={{ mb: 2 }} />}

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
                  Produkte gesamt
                </Typography>
                <Typography
                  variant="h4"
                  sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' } }}
                >
                  {stats.productsTotal}
                </Typography>
              </Box>
              <CategoryIcon
                sx={{
                  color: '#E91E63',
                  fontSize: { xs: 28, md: 40 },
                }}
              />
            </Box>
            <Button size="small" onClick={() => router.push('/admin/products')}>
              Produkte verwalten
            </Button>
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
                  Verfügbar
                </Typography>
                <Typography
                  variant="h4"
                  color="success.main"
                  sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' } }}
                >
                  {stats.productsAvailable}
                </Typography>
              </Box>
              <CheckCircleIcon
                sx={{
                  color: 'success.main',
                  fontSize: { xs: 28, md: 40 },
                }}
              />
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              Im Sortiment aktiv
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
                  Nicht verfügbar
                </Typography>
                <Typography
                  variant="h4"
                  color="error.main"
                  sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' } }}
                >
                  {stats.productsUnavailable}
                </Typography>
              </Box>
              <CancelIcon
                sx={{
                  color: 'error.main',
                  fontSize: { xs: 28, md: 40 },
                }}
              />
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              Derzeit deaktiviert
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
                  Offene Bestellungen
                </Typography>
                <Typography
                  variant="h4"
                  sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' } }}
                >
                  {stats.ordersOpen}
                </Typography>
              </Box>
              <OrdersIcon
                sx={{
                  color: 'primary.main',
                  fontSize: { xs: 28, md: 40 },
                }}
              />
            </Box>
            <Button size="small" onClick={() => router.push('/admin/orders')}>
              {stats.ordersTotal} Bestellungen gesamt
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

      {/* Production overview & recent activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Produktionsübersicht
            </Typography>
            {stats.productionTotal === 0 && !loading ? (
              <Typography variant="body2" color="text.secondary">
                Keine Produktionsaufträge vorhanden.
              </Typography>
            ) : (
              <>
                <Box sx={{ mb: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <Typography variant="body2">
                      Abgeschlossene Aufträge
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {productionProgress}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={productionProgress}
                    sx={{ height: 10, borderRadius: 5 }}
                    color="success"
                    aria-label="Produktionsfortschritt"
                  />
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Aufträge gesamt
                    </Typography>
                    <Typography variant="h6">
                      {stats.productionTotal}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Abgeschlossen
                    </Typography>
                    <Typography variant="h6">
                      {stats.productionCompleted}
                    </Typography>
                  </Grid>
                </Grid>
              </>
            )}
            <Button
              size="small"
              sx={{ mt: 2 }}
              onClick={() => router.push('/admin/production')}
            >
              Zur Produktion
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Letzte Aktivitäten
            </Typography>
            {notificationsLoading && recentNotifications.length === 0 ? (
              <LinearProgress sx={{ my: 2 }} />
            ) : recentNotifications.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Keine aktuellen Benachrichtigungen.
              </Typography>
            ) : (
              <List dense disablePadding>
                {recentNotifications.map((n) => (
                  <ListItem key={n.id} disableGutters>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <CircleIcon
                        sx={{
                          fontSize: 12,
                          color: notificationColor[n.type] ?? 'text.disabled',
                        }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={n.title}
                      secondary={`${n.message} · ${formatRelativeTime(
                        n.createdAt
                      )}`}
                      primaryTypographyProps={{
                        fontWeight: n.read ? 'normal' : 'bold',
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
            <Button
              size="small"
              sx={{ mt: 2 }}
              component={Link}
              href="/admin/notifications"
            >
              Alle Benachrichtigungen
            </Button>
          </Paper>
        </Grid>

        {/* System status – real reachability check of the API */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="h6">Systemstatus</Typography>
                <Chip
                  size="small"
                  label={
                    apiStatus === 'checking'
                      ? 'API wird geprüft …'
                      : apiStatus === 'online'
                      ? 'API erreichbar'
                      : 'API nicht erreichbar'
                  }
                  color={
                    apiStatus === 'online'
                      ? 'success'
                      : apiStatus === 'offline'
                      ? 'error'
                      : 'default'
                  }
                />
                {lastCheck && (
                  <Typography variant="caption" color="text.secondary">
                    Zuletzt geprüft:{' '}
                    {lastCheck.toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                )}
              </Box>
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={loadDashboard}
                disabled={loading}
              >
                Aktualisieren
              </Button>
            </Box>
            {apiStatus === 'offline' && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Die API antwortet nicht. Die angezeigten Zahlen sind
                möglicherweise unvollständig.
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
