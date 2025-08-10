// src/app/dashboard/management/page.tsx
'use client'
import React, { useState } from 'react'
import {
  Container,
  Typography,
  Box,
  Grid,
  CircularProgress,
  Paper,
  Alert,
  Snackbar,
  Skeleton,
} from '@mui/material'
import { useRouter } from 'next/navigation'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'

import {
  DateRangeSelector,
  MetricCard,
  ChartComponent,
  DataTable,
  StatsComparison,
  type TimeRange,
} from '@bakery/bakery-management/feature-dashboard'

import {
  useManagementDashboardData,
  useSummaryData,
  useProductData,
} from '../../../../hooks/useDashboard'
import { useAuth } from '../../../../context/AuthContext'
import { FinancialData } from '../../../../services/types'

const ManagementDashboard: React.FC = () => {
  const router = useRouter()
  const [timeRange, setTimeRange] = useState<TimeRange>('day')
  const { token } = useAuth()

  // Fetch management dashboard data
  const { financialData, summary, salesTrend, isLoading, error, refetch } =
    useManagementDashboardData(timeRange)

  // Get product data separately
  const { data: productData } = useProductData()

  // Get previous period summary for comparison
  const previousTimeRange = timeRange // In real implementation, calculate previous period
  const { data: previousSummary } = useSummaryData(previousTimeRange)

  // Calculate profit trend from sales trend (35% margin assumption)
  const profitTrend = salesTrend.map((item) => ({
    ...item,
    value: item.value * 0.35,
  }))

  // Check for authentication errors
  React.useEffect(() => {
    if (error && error.message && error.message.includes('Authentication')) {
      // Redirect to login or show auth error
      console.error('Authentication error:', error)
    }
  }, [error])

  // Calculate percentage changes
  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  // Handle time range change
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range)
  }

  // Format financial data for table display
  const formatFinancialData = (data: FinancialData[]) => {
    return data.map((item) => ({
      id: item.id,
      date: new Date(item.date).toLocaleDateString(),
      category: item.category,
      amount: `${item.amount < 0 ? '-' : ''}${Math.abs(item.amount).toFixed(
        2
      )} €`,
      description: item.description,
    }))
  }

  // Get product performance data
  const getProductPerformanceData = () => {
    if (!productData) return []

    const products = productData
      .filter((product) => product.cost && product.cost > 0) // Filter out products without cost data
      .map((product) => ({
        name: product.name,
        profit: product.price - (product.cost || 0),
        margin: product.cost
          ? ((product.price - product.cost) / product.price) * 100
          : 0,
      }))
      .sort((a, b) => b.margin - a.margin) // Sort by margin
      .slice(0, 5) // Top 5 products

    return products
  }

  // Handle close error alert
  const handleCloseError = () => {
    // Error is managed by React Query
    refetch()
  }

  return (
    <>
      {isLoading ? (
        <Container
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '60vh',
          }}
        >
          <CircularProgress />
        </Container>
      ) : (
        <Container maxWidth="xl">
          <Box
            sx={{
              mb: 3,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="h4" component="h1">
              Verwaltung: Finanzkennzahlen
            </Typography>
            <DateRangeSelector
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
            />
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 4 }} onClose={handleCloseError}>
              {error.message ||
                'Beim Laden der Daten ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.'}
            </Alert>
          )}

          {!isLoading && (
            <>
              {/* KPI Summary Cards */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={2.4}>
                  <MetricCard
                    title="Gesamtumsatz"
                    value={summary ? `${summary.revenue.toFixed(2)} €` : '0 €'}
                    icon={<AttachMoneyIcon />}
                    percentageChange={
                      summary && previousSummary
                        ? calculatePercentageChange(
                            summary.revenue,
                            previousSummary.revenue || 0
                          )
                        : 0
                    }
                    color="#4caf50"
                    tooltip="Gesamtumsatz im ausgewählten Zeitraum"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <MetricCard
                    title="Nettogewinn"
                    value={summary ? `${summary.profit.toFixed(2)} €` : '0 €'}
                    icon={<TrendingUpIcon />}
                    percentageChange={
                      summary && previousSummary
                        ? calculatePercentageChange(
                            summary.profit,
                            previousSummary.profit || 0
                          )
                        : 0
                    }
                    color="#2196f3"
                    tooltip="Nettogewinn nach allen Ausgaben im ausgewählten Zeitraum"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <MetricCard
                    title="Transaktionen"
                    value={summary?.transactions || 0}
                    icon={<ShoppingCartIcon />}
                    percentageChange={
                      summary && previousSummary
                        ? calculatePercentageChange(
                            summary.transactions,
                            previousSummary.transactions || 0
                          )
                        : 0
                    }
                    color="#ff9800"
                    tooltip="Anzahl der Verkaufstransaktionen im ausgewählten Zeitraum"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <MetricCard
                    title="Gewinnmarge"
                    value={
                      summary ? `${summary.profitMargin.toFixed(1)}%` : '0%'
                    }
                    icon={<TrendingUpIcon />}
                    percentageChange={
                      summary && previousSummary
                        ? calculatePercentageChange(
                            summary.profitMargin,
                            previousSummary.profitMargin || 0
                          )
                        : 0
                    }
                    color="#9c27b0"
                    tooltip="Gewinn als Prozentsatz des Umsatzes"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <MetricCard
                    title="Durchsch. Bestellwert"
                    value={
                      summary
                        ? `${summary.averageOrderValue.toFixed(2)} €`
                        : '0 €'
                    }
                    icon={<AttachMoneyIcon />}
                    percentageChange={
                      summary && previousSummary
                        ? calculatePercentageChange(
                            summary.averageOrderValue,
                            previousSummary.averageOrderValue || 0
                          )
                        : 0
                    }
                    color="#f44336"
                    tooltip="Durchschnittlicher Wert pro Transaktion"
                  />
                </Grid>
              </Grid>

              {/* Charts Row */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={8}>
                  <ChartComponent
                    title="Umsatzentwicklung"
                    subtitle={`Umsatzentwicklung für den ausgewählten Zeitraum: ${timeRange}`}
                    type="area"
                    data={salesTrend}
                    dataKeys={{ x: 'date', y: ['value'], colors: ['#4caf50'] }}
                    height={300}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <StatsComparison
                    title="Finanzielle Leistung"
                    subtitle="Vergleich mit vorherigem Zeitraum"
                    previousPeriodLabel={`vorheriger ${timeRange}`}
                    items={[
                      {
                        label: 'Umsatz',
                        current: summary?.revenue || 0,
                        previous: previousSummary?.revenue || 0,
                        unit: '€',
                        color: '#4caf50',
                        isHigherBetter: true,
                      },
                      {
                        label: 'Ausgaben',
                        current: summary?.expenses || 0,
                        previous: previousSummary?.expenses || 0,
                        unit: '€',
                        color: '#f44336',
                        isHigherBetter: false,
                      },
                      {
                        label: 'Nettogewinn',
                        current: summary?.profit || 0,
                        previous: previousSummary?.profit || 0,
                        unit: '€',
                        color: '#2196f3',
                        isHigherBetter: true,
                      },
                      {
                        label: 'Gewinnmarge',
                        current: summary?.profitMargin || 0,
                        previous: previousSummary?.profitMargin || 0,
                        unit: '%',
                        color: '#9c27b0',
                        isHigherBetter: true,
                      },
                    ]}
                  />
                </Grid>
              </Grid>

              {/* Product Performance and Financial Data */}
              <Grid container spacing={3}>
                <Grid item xs={12} md={5}>
                  <ChartComponent
                    title="Produktleistung"
                    subtitle="Top-Produkte nach Gewinnmarge"
                    type="bar"
                    data={getProductPerformanceData()}
                    dataKeys={{ x: 'name', y: 'margin', colors: ['#3f51b5'] }}
                    height={350}
                  />
                </Grid>
                <Grid item xs={12} md={7}>
                  <DataTable
                    title="Finanztransaktionen"
                    subtitle="Aktuelle finanzielle Aktivitäten"
                    columns={[
                      { id: 'date', label: 'Datum', minWidth: 100 },
                      { id: 'category', label: 'Kategorie', minWidth: 150 },
                      {
                        id: 'amount',
                        label: 'Betrag',
                        minWidth: 120,
                        align: 'right',
                        format: (value) => {
                          // Color code negative values as red, positive as green
                          const isNegative = value.startsWith('-')
                          return (
                            <Typography
                              component="span"
                              sx={{
                                color: isNegative ? '#f44336' : '#4caf50',
                                fontWeight: 'medium',
                              }}
                            >
                              {value}
                            </Typography>
                          )
                        },
                      },
                      {
                        id: 'description',
                        label: 'Beschreibung',
                        minWidth: 200,
                      },
                    ]}
                    data={formatFinancialData(financialData)}
                    searchEnabled={true}
                    emptyMessage="Keine Finanzdaten für den ausgewählten Zeitraum verfügbar"
                  />
                </Grid>
              </Grid>
            </>
          )}
        </Container>
      )}
    </>
  )
}

export default ManagementDashboard
