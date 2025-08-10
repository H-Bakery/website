'use client'
import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  CircularProgress,
} from '@mui/material'
import { Dashboard as DashboardIcon } from '@mui/icons-material'
import {
  DateRangePicker,
  ExportButton,
  AnalyticsSummaryCard,
} from '@bakery/management/feature-analytics'
import { analyticsService } from '@bakery/shared/data-access'
import type {
  RevenueData,
  ProductAnalyticsPerformance,
  PaymentMethodData,
  AnalyticsSummary,
  DateRange,
} from '@bakery/shared/types'

// Lazy load heavy chart components
const RevenueTrendChart = dynamic(
  () =>
    import('@bakery/management/feature-analytics').then((mod) => ({
      default: mod.RevenueTrendChart,
    })),
  {
    loading: () => (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height={400}
      >
        <CircularProgress />
      </Box>
    ),
  }
)

const PaymentMethodsChart = dynamic(
  () =>
    import('@bakery/management/feature-analytics').then((mod) => ({
      default: mod.PaymentMethodsChart,
    })),
  {
    loading: () => (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height={400}
      >
        <CircularProgress />
      </Box>
    ),
  }
)

const ProductRankingTable = dynamic(
  () =>
    import('@bakery/management/feature-analytics').then((mod) => ({
      default: mod.ProductRankingTable,
    })),
  {
    loading: () => (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height={400}
      >
        <CircularProgress />
      </Box>
    ),
  }
)

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false)
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
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (format: string) => {
    // For PNG export (screenshot), handle it manually
    if (format === 'png') {
      console.log('PNG export not yet implemented')
      // TODO: Implement screenshot functionality
    }
    // PDF, Excel, CSV exports are handled by the ExportButton component
  }

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
        <Typography variant="h3" component="h1" gutterBottom>
          <DashboardIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Analytics Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Detaillierte Umsatz- und Verkaufsanalysen
        </Typography>
      </Box>

      {/* Date Range and Export */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={4}
      >
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <ExportButton
          onExport={handleExport}
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
              {bottomProducts.map((product, index) => (
                <Box
                  key={product.productId}
                  sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}
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
    </Container>
  )
}
