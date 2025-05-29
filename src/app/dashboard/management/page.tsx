// src/app/dashboard/management/page.tsx
'use client'
import React, { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Grid,
  CircularProgress,
  Paper,
  Alert,
  Snackbar,
} from '@mui/material'
import { useRouter } from 'next/navigation'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'

import BakeryLayout from '../../../layouts/BakeryLayout'
import DateRangeSelector, {
  TimeRange,
} from '../../../components/dashboard/DateRangeSelector'
import MetricCard from '../../../components/dashboard/MetricCard'
import ChartComponent from '../../../components/dashboard/ChartComponent'
import DataTable from '../../../components/dashboard/DataTable'
import StatsComparison from '../../../components/dashboard/StatsComparison'

import bakeryAPI from '../../../services/bakeryAPI'
import { FinancialData, Product, TimeSeriesData } from '../../../services/types'

const ManagementDashboard: React.FC = () => {
  const router = useRouter()
  const [timeRange, setTimeRange] = useState<TimeRange>('day')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [salesTrend, setSalesTrend] = useState<TimeSeriesData[]>([])
  const [profitTrend, setProfitTrend] = useState<TimeSeriesData[]>([])
  const [productData, setProductData] = useState<Product[]>([])
  const [financialData, setFinancialData] = useState<FinancialData[]>([])
  const [previousSummary, setPreviousSummary] = useState<any>(null)

  // Fetch data based on selected time range
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Get current period data
        const summaryData = await bakeryAPI.getSummaryData(timeRange)
        setSummary(summaryData)

        // Get previous period data for comparison (using previous period of same length)
        let previousTimeRange = timeRange
        const previousSummaryData = await bakeryAPI.getSummaryData(
          previousTimeRange
        )
        setPreviousSummary(previousSummaryData)

        // Get sales trend data
        const salesData = await bakeryAPI.getTimeSeriesData('sales', timeRange)
        setSalesTrend(salesData)

        // Get profit trend data (real data or simulated from sales)
        try {
          const profitData = await bakeryAPI.getTimeSeriesData(
            'sales',
            timeRange as any
          )
          setProfitTrend(profitData)
        } catch {
          // Fallback if profit data not available - calculate from sales
          const profitData = salesData.map((item) => ({
            ...item,
            value: item.value * 0.35, // Assume 35% profit margin
          }))
          setProfitTrend(profitData)
        }

        // Get product data
        const products = await bakeryAPI.getProducts()
        setProductData(products)

        // Get financial data
        const finances = await bakeryAPI.getFinancialData(timeRange)
        setFinancialData(finances)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setError(
          'Beim Laden der Daten ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.'
        )
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [timeRange])

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
    const products = productData
      .filter((product) => product.cost > 0) // Filter out products without cost data
      .map((product) => ({
        name: product.name,
        profit: product.price - product.cost,
        margin: ((product.price - product.cost) / product.price) * 100,
      }))
      .sort((a, b) => b.margin - a.margin) // Sort by margin
      .slice(0, 5) // Top 5 products

    return products
  }

  // Handle close error alert
  const handleCloseError = () => {
    setError(null)
  }

  return (
    <BakeryLayout>
      {loading ? (
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
              {error}
            </Alert>
          )}

          {summary && (
            <>
              {/* KPI Summary Cards */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={2.4}>
                  <MetricCard
                    title="Gesamtumsatz"
                    value={`${summary.revenue.toFixed(2)} €`}
                    icon={<AttachMoneyIcon />}
                    percentageChange={calculatePercentageChange(
                      summary.revenue,
                      previousSummary?.revenue || 0
                    )}
                    color="#4caf50"
                    tooltip="Gesamtumsatz im ausgewählten Zeitraum"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <MetricCard
                    title="Nettogewinn"
                    value={`${summary.profit.toFixed(2)} €`}
                    icon={<TrendingUpIcon />}
                    percentageChange={calculatePercentageChange(
                      summary.profit,
                      previousSummary?.profit || 0
                    )}
                    color="#2196f3"
                    tooltip="Nettogewinn nach allen Ausgaben im ausgewählten Zeitraum"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <MetricCard
                    title="Transaktionen"
                    value={summary.transactions}
                    icon={<ShoppingCartIcon />}
                    percentageChange={calculatePercentageChange(
                      summary.transactions,
                      previousSummary?.transactions || 0
                    )}
                    color="#ff9800"
                    tooltip="Anzahl der Verkaufstransaktionen im ausgewählten Zeitraum"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <MetricCard
                    title="Gewinnmarge"
                    value={`${summary.profitMargin.toFixed(1)}%`}
                    icon={<TrendingUpIcon />}
                    percentageChange={calculatePercentageChange(
                      summary.profitMargin,
                      previousSummary?.profitMargin || 0
                    )}
                    color="#9c27b0"
                    tooltip="Gewinn als Prozentsatz des Umsatzes"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <MetricCard
                    title="Durchsch. Bestellwert"
                    value={`${summary.averageOrderValue.toFixed(2)} €`}
                    icon={<AttachMoneyIcon />}
                    percentageChange={calculatePercentageChange(
                      summary.averageOrderValue,
                      previousSummary?.averageOrderValue || 0
                    )}
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
                        current: summary.revenue,
                        previous: previousSummary?.revenue || 0,
                        unit: '€',
                        color: '#4caf50',
                        isHigherBetter: true,
                      },
                      {
                        label: 'Ausgaben',
                        current: summary.expenses,
                        previous: previousSummary?.expenses || 0,
                        unit: '€',
                        color: '#f44336',
                        isHigherBetter: false,
                      },
                      {
                        label: 'Nettogewinn',
                        current: summary.profit,
                        previous: previousSummary?.profit || 0,
                        unit: '€',
                        color: '#2196f3',
                        isHigherBetter: true,
                      },
                      {
                        label: 'Gewinnmarge',
                        current: summary.profitMargin,
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
    </BakeryLayout>
  )
}

export default ManagementDashboard
