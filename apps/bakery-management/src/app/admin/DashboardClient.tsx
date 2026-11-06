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
  Alert,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  ListAlt as BakingListIcon,
  Store as ProductsIcon,
  Assessment as ReportsIcon,
  Insights as AnalyticsIcon,
  Category as CategoryIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  PointOfSale as CashRegisterIcon,
  EventNote as PreordersIcon,
  FactCheck as AbhollisteIcon,
  Assignment as BackzettelIcon,
  Storefront as PartnerIcon,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@bakery/shared/data-access'
import {
  formatEuro,
  formatPercent,
  formatReportDateLong,
} from '../../lib/reportFormat'
import TargetsTile from '../../components/targets/TargetsTile'
import { isPilotMode, isPilotPathAllowed } from '../../lib/pilotMode'
import { useOptionalSession } from '../../lib/session'
import { isPathAllowedForRole } from '../../lib/roles'

/** Kennzahlen des jüngsten Kassentags, vom Server geladen. */
export interface LatestReportTile {
  date: string
  weekday: string
  revenue: number
  receiptCount: number
  avgReceipt: number
  cashShare: number
  cardShare: number
}

interface Props {
  latestReport: LatestReportTile | null
  /** false: das HQ-Berichtsverzeichnis fehlt auf diesem Rechner. */
  reportsAvailable: boolean
}

interface QuickLink {
  title: string
  description: string
  /** Text für Rollen, die nur lesen (W4-verify r2: Verkauf am Backzettel). */
  readOnly?: { roles: readonly string[]; description: string }
  icon: React.ReactNode
  href: string
  color: string
}

const quickLinks: QuickLink[] = [
  // Pilot-Bildschirme zuerst (W4-Verifikation: Verkauf und Backstube hatten
  // keinen einzigen Schnellzugriff); `allowed()` filtert nach Rolle.
  {
    title: 'Vorbestellungen',
    description: 'Erfassen, Liste und Tagesübersicht',
    icon: <PreordersIcon fontSize="large" />,
    href: '/admin/preorders',
    color: '#3F51B5',
  },
  {
    title: 'Abholliste',
    description: 'Übergeben und kassieren',
    icon: <AbhollisteIcon fontSize="large" />,
    href: '/admin/preorders/abholliste',
    color: '#009688',
  },
  {
    title: 'Backzettel',
    description: 'Planen, freigeben, drucken',
    readOnly: { roles: ['verkauf'], description: 'Tagesplan ansehen, drucken' },
    icon: <BackzettelIcon fontSize="large" />,
    href: '/admin/backzettel',
    color: '#8D6E63',
  },
  {
    title: 'Backstube',
    description: 'Tablet-Ansicht zum Abhaken',
    icon: <BakingListIcon fontSize="large" />,
    href: '/backstube',
    color: '#FF7043',
  },
  {
    title: 'Backschrank',
    description: 'Besuche beim Verkaufspartner',
    icon: <PartnerIcon fontSize="large" />,
    href: '/admin/partners',
    color: '#7CB342',
  },
  {
    title: 'Produkte',
    description: 'Produktkatalog',
    icon: <ProductsIcon fontSize="large" />,
    href: '/admin/products',
    color: '#E91E63',
  },
  {
    title: 'Kassenberichte',
    description: 'Tagesabschlüsse der Kasse',
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

interface DashboardStats {
  productsTotal: number
  productsAvailable: number
  productsUnavailable: number
}

type ApiStatus = 'checking' | 'online' | 'offline'

const EMPTY_STATS: DashboardStats = {
  productsTotal: 0,
  productsAvailable: 0,
  productsUnavailable: 0,
}

export default function DashboardClient({
  latestReport,
  reportsAvailable,
}: Props) {
  const router = useRouter()
  // Pilotbetrieb (F2): Schnellzugriffe auf gesperrte Seiten entfallen.
  const pilot = isPilotMode()
  // F1: das Dashboard ist auch Ausweich-Startseite für Verkauf und Backstube
  // - Kasse, Tagesziel und Schnellzugriffe nur, wenn die Rolle die Seite
  // dahinter öffnen darf (ROLE_ACCESS). Ohne Sitzung (Specs) wie bisher.
  const session = useOptionalSession()
  const role = session?.user?.role ?? null
  const sessionKind = session?.sessionKind ?? null
  const allowed = (href: string) =>
    isPilotPathAllowed(href, pilot) &&
    (role === null || isPathAllowedForRole(href, role, sessionKind))
  const visibleQuickLinks = quickLinks.filter((link) => allowed(link.href))
  const showCash = allowed('/admin/reports')
  const showTargets = allowed('/admin/finance/tagesziel')

  const [stats, setStats] = React.useState<DashboardStats>(EMPTY_STATS)
  const [loading, setLoading] = React.useState(true)
  const [apiStatus, setApiStatus] = React.useState<ApiStatus>('checking')
  const [lastCheck, setLastCheck] = React.useState<Date | null>(null)

  const loadDashboard = React.useCallback(async () => {
    setLoading(true)
    setApiStatus('checking')

    // B12: Bestellungen und Produktion (Mock-Daten) gibt es nicht mehr; der
    // Produktkatalog ist zugleich die Erreichbarkeitsprüfung der API.
    const products = await apiClient
      .get<ProductSummary[]>('/api/products')
      .catch(() => null)
    setApiStatus(products?.success ? 'online' : 'offline')
    setLastCheck(new Date())

    const productsData = Array.isArray(products?.data) ? products.data : []

    setStats({
      productsTotal: productsData.length,
      productsAvailable: productsData.filter((p) => p.available === true)
        .length,
      productsUnavailable: productsData.filter((p) => p.available === false)
        .length,
    })
    setLoading(false)
  }, [])

  React.useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

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

      {/* Produktkatalog: drei Kacheln */}
      <Grid
        container
        spacing={{ xs: 1.5, md: 3 }}
        sx={{ mb: { xs: 2, md: 4 } }}
      >
        <Grid item xs={6} sm={6} md={4}>
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
            {/* Nur für Rollen, die die Produktliste öffnen dürfen (Backstube
                landete sonst auf „Kein Zugriff“). */}
            {allowed('/admin/products') ? (
              <Button
                size="small"
                onClick={() => router.push('/admin/products')}
              >
                {role === null || role === 'inhaber'
                  ? 'Produkte verwalten'
                  : 'Produkte ansehen'}
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Freigegebener Stand
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={6} sm={6} md={4}>
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
              Freigegeben, inkl. Saisonware
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} sm={6} md={4}>
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
      </Grid>

      {showCash && (
        <>
          {/* Kasse: jüngster Tagesabschluss aus hq/data/reports */}
          <Typography
            variant="h5"
            gutterBottom
            sx={{
              mb: { xs: 1.5, md: 2 },
              fontSize: { xs: '1.25rem', md: '1.5rem' },
            }}
          >
            Kasse
            {latestReport && (
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
                sx={{ ml: 1.5 }}
              >
                Stand:{' '}
                {formatReportDateLong(latestReport.date, latestReport.weekday)}
              </Typography>
            )}
          </Typography>
          {latestReport ? (
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
                        Tagesumsatz
                      </Typography>
                      <Typography
                        variant="h4"
                        sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' } }}
                      >
                        {formatEuro(latestReport.revenue)}
                      </Typography>
                    </Box>
                    <CashRegisterIcon
                      sx={{
                        color: 'success.main',
                        fontSize: { xs: 28, md: 40 },
                      }}
                    />
                  </Box>
                  <Button
                    size="small"
                    component={Link}
                    href={`/admin/reports/${latestReport.date}`}
                  >
                    Tagesbericht öffnen
                  </Button>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={6} md={3}>
                <Paper sx={{ p: { xs: 2, md: 3 } }}>
                  <Typography color="text.secondary" variant="body2">
                    Bons
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' }, mb: 2 }}
                  >
                    {latestReport.receiptCount}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ display: { xs: 'none', sm: 'block' } }}
                  >
                    Kassenbons am {latestReport.weekday}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={6} md={3}>
                <Paper sx={{ p: { xs: 2, md: 3 } }}>
                  <Typography color="text.secondary" variant="body2">
                    Ø Bon
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' }, mb: 2 }}
                  >
                    {formatEuro(latestReport.avgReceipt)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ display: { xs: 'none', sm: 'block' } }}
                  >
                    Umsatz je Bon
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={6} md={3}>
                <Paper sx={{ p: { xs: 2, md: 3 } }}>
                  <Typography color="text.secondary" variant="body2">
                    Zahlungsmix
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' }, mb: 2 }}
                  >
                    {formatPercent(latestReport.cashShare)} bar
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ display: { xs: 'none', sm: 'block' } }}
                  >
                    {formatPercent(latestReport.cardShare)} Karte
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          ) : (
            <Alert
              severity={reportsAvailable ? 'info' : 'warning'}
              sx={{ mb: 4 }}
            >
              {reportsAvailable
                ? 'Noch kein Kassenbericht im HQ-Archiv.'
                : 'Das HQ-Berichtsverzeichnis ist auf diesem Rechner nicht erreichbar - Kassenzahlen werden nicht angezeigt.'}
            </Alert>
          )}
        </>
      )}

      {/* Tagesziel-Ampel (TASK-039): nur nach Anmeldung als Admin */}
      {showTargets && <TargetsTile />}

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
        {visibleQuickLinks.map((link) => (
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
                  {role && link.readOnly?.roles.includes(role)
                    ? link.readOnly.description
                    : link.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
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
