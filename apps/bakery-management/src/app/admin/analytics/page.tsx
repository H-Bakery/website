'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import {
  Typography,
  Box,
  Grid,
  Paper,
  Button,
  Alert,
  Stack,
} from '@mui/material'
import {
  Insights as InsightsIcon,
  ShowChart as ShowChartIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material'
import {
  DateRangePicker,
  ExportButton,
  AnalyticsSummaryCard,
  RevenueTrendChart,
  PaymentMethodsChart,
  ProductRankingTable,
} from '@bakery/management/feature-analytics'
import { analyticsService } from '@bakery/shared/data-access'
import type {
  RevenueData,
  ProductAnalyticsPerformance,
  PaymentMethodData,
  AnalyticsSummary,
  DateRange,
} from '@bakery/shared/types'

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
  })

  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [topProducts, setTopProducts] = useState<ProductAnalyticsPerformance[]>(
    []
  )
  const [bottomProducts, setBottomProducts] = useState<
    ProductAnalyticsPerformance[]
  >([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodData[]>([])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)

  React.useEffect(() => {
    fetchAnalyticsData()
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

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [
        revenueRes,
        topProductsRes,
        bottomProductsRes,
        paymentRes,
        summaryRes,
      ] = await Promise.all([
        analyticsService.getRevenueTrends({
          ...dateRange,
          granularity: 'daily',
        }),
        analyticsService.getProductPerformance({
          ...dateRange,
          type: 'top',
          limit: 10,
        }),
        analyticsService.getProductPerformance({
          ...dateRange,
          type: 'bottom',
          limit: 5,
        }),
        analyticsService.getPaymentMethods(dateRange),
        analyticsService.getSummary(dateRange),
      ])

      setRevenueData(revenueRes)
      setTopProducts(topProductsRes)
      setBottomProducts(bottomProductsRes)
      setPaymentMethods(paymentRes)
      setSummary(summaryRes)
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError('Analysedaten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          <InsightsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Analysen
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Umsatz- und Verkaufsanalysen
        </Typography>
      </Box>

      {/* Sub pages */}
      <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap">
        <Button
          component={Link}
          href="/admin/analytics/revenue"
          variant="outlined"
          size="small"
          startIcon={<ShowChartIcon />}
        >
          Umsatzanalyse
        </Button>
        <Button
          component={Link}
          href="/admin/analytics/products"
          variant="outlined"
          size="small"
          startIcon={<InventoryIcon />}
        >
          Produktanalyse
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Liefert die API keine Analysedaten, werden Beispieldaten angezeigt.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Date Range and Export */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={4}
        flexWrap="wrap"
        gap={2}
      >
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <ExportButton
          formats={['csv', 'pdf', 'excel']}
          analyticsParams={{
            ...dateRange,
            granularity: 'daily',
          }}
          includeCharts={true}
        />
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <AnalyticsSummaryCard
            title="Gesamtumsatz"
            value={formatCurrency(summary?.totalRevenue || 0)}
            subtitle={`${summary?.totalTransactions || 0} Transaktionen`}
            loading={loading}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <AnalyticsSummaryCard
            title="Ø Transaktionswert"
            value={formatCurrency(summary?.avgTransactionValue || 0)}
            loading={loading}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <AnalyticsSummaryCard
            title="Meistverkauft"
            value={summary?.topSellingProduct?.productName || '-'}
            subtitle={`${summary?.topSellingProduct?.quantitySold || 0} Stück`}
            loading={loading}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <AnalyticsSummaryCard
            title="Bargeldanteil"
            value={`${summary?.cashPercentage?.toFixed(1) || 0}%`}
            subtitle="des Gesamtumsatzes"
            loading={loading}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Revenue Chart */}
      <Box mb={4}>
        <RevenueTrendChart
          data={revenueData}
          title="Umsatzentwicklung"
          height={400}
          showTransactions={true}
        />
      </Box>

      {/* Product Performance */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={8}>
          <ProductRankingTable
            products={topProducts}
            title="Top Produkte"
            showRank={true}
            pageSize={10}
            height={400}
          />
        </Grid>
        <Grid item xs={12} lg={4}>
          <Paper elevation={3} sx={{ p: 3, height: 500 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Schwache Produkte
            </Typography>
            <Box sx={{ mt: 2 }}>
              {bottomProducts.length === 0 && !loading && (
                <Typography color="text.secondary">
                  Keine Daten für den gewählten Zeitraum.
                </Typography>
              )}
              {bottomProducts.map((product) => (
                <Box
                  key={product.productId}
                  sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}
                >
                  <Typography variant="subtitle1">
                    {product.productName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {product.quantitySold} Stück -{' '}
                    {formatCurrency(product.revenue)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Payment Methods */}
      <PaymentMethodsChart
        data={paymentMethods}
        title="Zahlungsmethoden"
        height={400}
      />
    </Box>
  )
}
