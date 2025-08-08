'use client'
import React, { useState } from 'react'
import {
  Container,
  Typography,
  Box,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Grid,
} from '@mui/material'
import {
  Inventory as InventoryIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
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

  React.useEffect(() => {
    fetchProductData()
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
      const [topData, bottomData] = await Promise.all([
        analyticsService.getProductPerformance({
          ...dateRange,
          type: 'top',
          limit: 20,
        }),
        analyticsService.getProductPerformance({
          ...dateRange,
          type: 'bottom',
          limit: 10,
        }),
      ])
      setTopProducts(topData)
      setBottomProducts(bottomData)
    } catch (error) {
      console.error('Error fetching product data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (format: string) => {
    console.log('Export product data in format:', format)
    // TODO: Implement export functionality
  }

  const calculateStats = (products: ProductPerformance[]) => {
    if (products.length === 0)
      return { totalRevenue: 0, totalQuantity: 0, avgPrice: 0 }

    const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0)
    const totalQuantity = products.reduce((sum, p) => sum + p.quantitySold, 0)
    const avgPrice = totalRevenue / totalQuantity

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
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <ArrowBackIcon
            sx={{ cursor: 'pointer' }}
            onClick={() => router.back()}
          />
          <Typography variant="h3" component="h1">
            <InventoryIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
            Produktanalyse
          </Typography>
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          Verkaufsleistung und Produktranking
        </Typography>
      </Box>

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
          onExport={handleExport}
          formats={['csv', 'pdf', 'excel']}
        />
      </Box>

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
                Beste Kategorie
              </Typography>
              <Typography variant="h5">Backwaren</Typography>
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
    </Container>
  )
}
