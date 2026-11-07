'use client'
import React from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  ListAlt as BakingListIcon,
  Store as ProductsIcon,
  Assessment as ReportsIcon,
  Insights as AnalyticsIcon,
  Refresh as RefreshIcon,
  EventNote as PreordersIcon,
  FactCheck as AbhollisteIcon,
  Assignment as BackzettelIcon,
  Storefront as PartnerIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material'
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
import {
  KeyFigures,
  PageLayout,
  PageSection,
  type KeyFigure,
} from '../../components/layout'

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
}

const quickLinks: QuickLink[] = [
  // Pilot-Bildschirme zuerst (W4-Verifikation: Verkauf und Backstube hatten
  // keinen einzigen Schnellzugriff); `allowed()` filtert nach Rolle.
  {
    title: 'Vorbestellungen',
    description: 'Erfassen, Liste und Tagesübersicht',
    icon: <PreordersIcon />,
    href: '/admin/preorders',
  },
  {
    title: 'Abholliste',
    description: 'Übergeben und kassieren',
    icon: <AbhollisteIcon />,
    href: '/admin/preorders/abholliste',
  },
  {
    title: 'Backzettel',
    description: 'Planen, freigeben, drucken',
    readOnly: { roles: ['verkauf'], description: 'Tagesplan ansehen, drucken' },
    icon: <BackzettelIcon />,
    href: '/admin/backzettel',
  },
  {
    title: 'Backstube',
    description: 'Tablet-Ansicht zum Abhaken',
    icon: <BakingListIcon />,
    href: '/backstube',
  },
  {
    title: 'Backschrank',
    description: 'Besuche beim Verkaufspartner',
    icon: <PartnerIcon />,
    href: '/admin/partners',
  },
  {
    title: 'Produkte',
    description: 'Produktkatalog',
    icon: <ProductsIcon />,
    href: '/admin/products',
  },
  {
    title: 'Kassenberichte',
    description: 'Tagesabschlüsse der Kasse',
    icon: <ReportsIcon />,
    href: '/admin/reports',
  },
  {
    title: 'Analysen',
    description: 'Umsatz- und Produktanalysen',
    icon: <AnalyticsIcon />,
    href: '/admin/analytics',
  },
]

interface ProductSummary {
  available?: boolean
  seasonal?: boolean
}

/**
 * Sortiment wie in der Produktliste gezählt (`statusOf` in lib/products.ts):
 * nicht verfügbar schlägt saisonal, saisonal steht neben „verfügbar“ -
 * sonst hieß „Verfügbar“ hier 56 und dort 55 (UI-Audit).
 */
export interface DashboardStats {
  productsTotal: number
  productsActive: number
  productsSeasonal: number
  productsUnavailable: number
}

export function countProducts(products: ProductSummary[]): DashboardStats {
  let active = 0
  let seasonal = 0
  let unavailable = 0
  for (const product of products) {
    if (product.available === false) unavailable += 1
    else if (product.seasonal) seasonal += 1
    else active += 1
  }
  return {
    productsTotal: products.length,
    productsActive: active,
    productsSeasonal: seasonal,
    productsUnavailable: unavailable,
  }
}

type ApiStatus = 'checking' | 'online' | 'offline'

const API_STATUS_LABEL: Record<ApiStatus, string> = {
  checking: 'API wird geprüft …',
  online: 'API erreichbar',
  offline: 'API nicht erreichbar',
}

function formatToday(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function QuickLinkCard({
  link,
  description,
}: {
  link: QuickLink
  description: string
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea
        component={Link}
        href={link.href}
        sx={{
          height: '100%',
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 1.5,
          px: 2,
          py: 1.5,
        }}
      >
        <Box
          aria-hidden
          sx={{ color: 'primary.main', display: 'flex', flexShrink: 0 }}
        >
          {link.icon}
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{ fontWeight: 600, lineHeight: 1.3 }}
          >
            {link.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
        <ChevronRightIcon
          aria-hidden
          sx={{ color: 'text.secondary', flexShrink: 0 }}
        />
      </CardActionArea>
    </Card>
  )
}

export default function DashboardClient({
  latestReport,
  reportsAvailable,
}: Props) {
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
  const showProductsLink = allowed('/admin/products')

  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [apiStatus, setApiStatus] = React.useState<ApiStatus>('checking')
  const [lastCheck, setLastCheck] = React.useState<Date | null>(null)
  // Erst im Browser: Server und Gerät können in verschiedenen Zeitzonen
  // stehen, ein Datum aus dem Server-HTML widerspräche dann der Hydration.
  const [today, setToday] = React.useState<string | null>(null)
  React.useEffect(() => setToday(formatToday(new Date())), [])

  const loadDashboard = React.useCallback(async () => {
    setLoading(true)
    setApiStatus('checking')

    // B12: Bestellungen und Produktion (Mock-Daten) gibt es nicht mehr; der
    // Produktkatalog ist zugleich die Erreichbarkeitsprüfung der API.
    const products = await apiClient
      .get<ProductSummary[]>('/api/products')
      .catch(() => null)
    const online = Boolean(products?.success)
    setApiStatus(online ? 'online' : 'offline')
    setLastCheck(new Date())
    // Ohne Antwort keine Nullen: „0 Produkte“ läse sich wie ein leerer Katalog.
    setStats(
      online && Array.isArray(products?.data)
        ? countProducts(products.data)
        : null
    )
    setLoading(false)
  }, [])

  React.useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const figure = (value: number | undefined) =>
    loading || value === undefined ? '–' : String(value)

  const productFigures: KeyFigure[] = [
    {
      label: 'Produkte gesamt',
      value: figure(stats?.productsTotal),
      // Wie die Produktliste: verfügbar und saisonal getrennt gezählt.
      hint: stats
        ? `${stats.productsActive} verfügbar · ${stats.productsSeasonal} saisonal`
        : 'Freigegebener Stand',
      'data-testid': 'dashboard-products-total',
    },
    {
      label: 'Nicht verfügbar',
      value: figure(stats?.productsUnavailable),
      hint: 'Derzeit deaktiviert',
    },
  ]

  const cashFigures: KeyFigure[] = latestReport
    ? [
        {
          label: 'Tagesumsatz',
          value: formatEuro(latestReport.revenue),
          hint: latestReport.weekday,
        },
        {
          label: 'Bons',
          value: latestReport.receiptCount.toLocaleString('de-DE'),
          hint: `Kassenbons am ${latestReport.weekday}`,
        },
        {
          label: 'Ø Bon',
          value: formatEuro(latestReport.avgReceipt),
          hint: 'Umsatz je Bon',
        },
        {
          label: 'Zahlungsmix',
          value: `${formatPercent(latestReport.cashShare)} bar`,
          hint: `${formatPercent(latestReport.cardShare)} Karte`,
        },
      ]
    : []

  const statusChip = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Tooltip
        title={
          lastCheck
            ? `Zuletzt geprüft: ${lastCheck.toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : ''
        }
      >
        <Chip
          size="small"
          variant="outlined"
          label={API_STATUS_LABEL[apiStatus]}
          color={
            apiStatus === 'online'
              ? 'success'
              : apiStatus === 'offline'
              ? 'error'
              : 'default'
          }
          data-testid="api-status"
        />
      </Tooltip>
      {/* Neben dem Status statt im Aktionsbereich: am Handy stünde der
          Knopf sonst allein in einer eigenen Zeile. */}
      <Tooltip title="Aktualisieren">
        <span>
          <IconButton
            aria-label="Aktualisieren"
            onClick={loadDashboard}
            disabled={loading}
            size="small"
            sx={{ '@media print': { display: 'none' } }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  )

  const quickLinkSection = visibleQuickLinks.length > 0 && (
    <PageSection title="Schnellzugriff" variant="plain">
      <Box
        component="nav"
        aria-label="Schnellzugriff"
        sx={{
          display: 'grid',
          gap: { xs: 1, md: 2 },
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
          },
        }}
      >
        {visibleQuickLinks.map((link) => (
          <QuickLinkCard
            key={link.href}
            link={link}
            description={
              role && link.readOnly?.roles.includes(role)
                ? link.readOnly.description
                : link.description
            }
          />
        ))}
      </Box>
    </PageSection>
  )

  return (
    <PageLayout
      title="Dashboard"
      subtitle={today ?? undefined}
      status={statusChip}
    >
      {apiStatus === 'offline' && (
        <Alert severity="warning">
          Die API antwortet nicht. Produktzahlen und Tagesziel fehlen, bis sie
          wieder erreichbar ist.
        </Alert>
      )}

      {showCash && (
        <PageSection
          title="Kasse"
          description={
            latestReport
              ? `Stand: ${formatReportDateLong(
                  latestReport.date,
                  latestReport.weekday
                )}`
              : undefined
          }
          actions={
            latestReport ? (
              <Button
                size="small"
                component={Link}
                href={`/admin/reports/${latestReport.date}`}
              >
                Tagesbericht öffnen
              </Button>
            ) : undefined
          }
          variant="plain"
        >
          {latestReport ? (
            <KeyFigures items={cashFigures} aria-label="Kasse" />
          ) : (
            <Alert severity={reportsAvailable ? 'info' : 'warning'}>
              {reportsAvailable
                ? 'Noch kein Kassenbericht im HQ-Archiv.'
                : 'Das HQ-Berichtsverzeichnis ist auf diesem Rechner nicht erreichbar - Kassenzahlen werden nicht angezeigt.'}
            </Alert>
          )}
        </PageSection>
      )}

      {/* Tagesziel-Ampel (TASK-039): nur nach Anmeldung als Admin */}
      {showTargets && (
        // Die Kachel (components/targets) bringt eigenen Abstand und eine
        // h5-Überschrift mit Symbol mit; hier an die Abschnitte des
        // Layout-Kits angeglichen (Abstand macht PageLayout, Überschrift wie h2).
        <Box
          sx={(theme) => ({
            '& > [data-testid="targets-tile"]': { mb: 0 },
            '& > [data-testid="targets-tile"] > h5': {
              ...theme.typography.h2,
              mb: 1.5,
            },
            '& > [data-testid="targets-tile"] > h5 > svg': { display: 'none' },
          })}
        >
          <TargetsTile />
        </Box>
      )}

      {quickLinkSection}

      <PageSection
        title="Sortiment"
        variant="plain"
        actions={
          showProductsLink ? (
            <Button size="small" component={Link} href="/admin/products">
              {role === null || role === 'inhaber'
                ? 'Produkte verwalten'
                : 'Produkte ansehen'}
            </Button>
          ) : undefined
        }
      >
        <KeyFigures items={productFigures} aria-label="Sortiment" />
      </PageSection>
    </PageLayout>
  )
}
