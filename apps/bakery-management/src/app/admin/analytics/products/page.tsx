'use client'
import React, { useState } from 'react'
import {
  Typography,
  Box,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Grid,
  Button,
  LinearProgress,
  Alert,
} from '@mui/material'
import {
  Inventory as InventoryIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import {
  ProductRankingTable,
  DateRangePicker,
  ExportButton,
} from '@bakery/management/feature-analytics'
import { analyticsService } from '@bakery/shared/data-access'
import type {
  ProductAnalyticsPerformance,
  DateRange,
} from '@bakery/shared/types'

export default function ProductAnalyticsPage() {
  const [loading, setLoading] = useState(false)
  const [viewType, setViewType] = useState<'top' | 'all'>('top')
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
  })

  const [topProducts, setTopProducts] = useState<ProductAnalyticsPerformance[]>(
    []
  )
  const [bottomProducts, setBottomProducts] = useState<
    ProductAnalyticsPerformance[]
  >([])
  const [isMockData, setIsMockData] = useState(false)

  React.useEffect(() => {
    fetchProductData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange])

  function getDefaultStartDate() {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  }

  function getDefaultEndDate() {
    return new Date().toISOString().split('T')[0]
  }

  const fetchProductData = async () => {
    try {
      setLoading(true)
      const [top, bottom] = await Promise.all([
        analyticsService.getProductPerformanceWithSource({
          ...dateRange,
          type: 'top',
          limit: 20,
        }),
        analyticsService.getProductPerformanceWithSource({
          ...dateRange,
          type: 'bottom',
          limit: 10,
        }),
      ])
      setTopProducts(top.data)
      setBottomProducts(bottom.data)
      setIsMockData(top.isMock || bottom.isMock)
    } catch (error) {
      console.error('Error fetching product data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (products: ProductAnalyticsPerformance[]) => {
    if (products.length === 0)
      return { totalRevenue: 0, totalQuantity: 0, avgPrice: 0 }

    const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0)
    const totalQuantity = products.reduce((sum, p) => sum + p.quantitySold, 0)
    const avgPrice = totalQuantity > 0 ? totalRevenue / totalQuantity : 0

    return { totalRevenue, totalQuantity, avgPrice }
  }

  const topStats = calculateStats(topProducts)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          component={Link}
          href="/admin/analytics"
          startIcon={<ArrowBackIcon />}
          size="small"
          sx={{ mb: 1 }}
        >
          Zurück zur Analyse-Übersicht
        </Button>
        <Typography variant="h4" component="h1">
          <InventoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Produktanalyse
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Verkaufsleistung und Produktranking
        </Typography>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Controls */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={4}
        flexWrap="wrap"
        gap={2}
      >
        <Box display="flex" gap={2} alignItems="center">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <ToggleButtonGroup
            value={viewType}
            exclusive
            onChange={(_, value) => value && setViewType(value)}
            size="small"
          >
            <ToggleButton value="top">Top Produkte</ToggleButton>
            <ToggleButton value="all">Alle Produkte</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <ExportButton
          formats={['csv', 'pdf', 'excel']}
          analyticsParams={{ ...dateRange, granularity: 'daily' }}
        />
      </Box>

      {isMockData && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Die API liefert keine Produktdaten – die angezeigten Zahlen sind
          Beispieldaten und nicht die echten Verkaufszahlen.
        </Alert>
      )}

      {/* Statistics for Top Products */}
      {viewType === 'top' && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Gesamtumsatz Top 20
              </Typography>
              <Typography variant="h5">
                {formatCurrency(topStats.totalRevenue)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Verkaufte Menge
              </Typography>
              <Typography variant="h5">
                {topStats.totalQuantity} Stück
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Ø Verkaufspreis
              </Typography>
              <Typography variant="h5">
                {formatCurrency(topStats.avgPrice)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Bestseller
              </Typography>
              <Typography variant="h5" noWrap>
                {topProducts[0]?.productName ?? '–'}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Product Tables */}
      {viewType === 'top' ? (
        <Box>
          <ProductRankingTable
            products={topProducts}
            title="Top 20 Produkte"
            showRank={true}
            pageSize={20}
            height={600}
          />

          <Box mt={4}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h6" component="h2" gutterBottom>
                Schwache Produkte - Handlungsbedarf
              </Typography>
              {bottomProducts.length === 0 && !loading && (
                <Typography color="text.secondary">
                  Keine Daten für den gewählten Zeitraum.
                </Typography>
              )}
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {bottomProducts.map((product) => (
                  <Grid item xs={12} sm={6} md={4} key={product.productId}>
                    <Paper
                      elevation={1}
                      sx={{
                        p: 2,
                        bgcolor: 'error.light',
                        color: 'error.contrastText',
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight="bold">
                        {product.productName}
                      </Typography>
                      <Typography variant="body2">
                        Nur {product.quantitySold} Stück verkauft
                      </Typography>
                      <Typography variant="body2">
                        Umsatz: {formatCurrency(product.revenue)}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Box>
        </Box>
      ) : (
        <ProductRankingTable
          products={[...topProducts, ...bottomProducts]}
          title="Alle Produkte"
          showRank={true}
          pageSize={50}
          height={600}
        />
      )}
    </Box>
  )
}
