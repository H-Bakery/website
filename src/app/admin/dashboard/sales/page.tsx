// src/app/dashboard/sales/page.tsx
'use client'
import React, { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Grid,
  CircularProgress,
  Chip,
  Avatar,
  Rating,
  Alert,
} from '@mui/material'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'

import DateRangeSelector, {
  TimeRange,
} from '../../../../components/dashboard/DateRangeSelector'
import MetricCard from '../../../../components/dashboard/MetricCard'
import ChartComponent from '../../../../components/dashboard/ChartComponent'
import DataTable from '../../../../components/dashboard/DataTable'
import StatsComparison from '../../../../components/dashboard/StatsComparison'

import bakeryAPI from '../../../../services/bakeryAPI'
import {
  SalesData,
  CustomerData,
  TimeSeriesData,
} from '../../../../services/types'
import { Product } from '../../../../types/product'

const SalesDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('day')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [customerData, setCustomerData] = useState<CustomerData[]>([])
  const [productData, setProductData] = useState<Product[]>([])
  const [salesTrend, setSalesTrend] = useState<TimeSeriesData[]>([])
  const [customerTrend, setCustomerTrend] = useState<TimeSeriesData[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [previousSummary, setPreviousSummary] = useState<any>(null)

  // Fetch data based on selected time range
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Get sales data
        const sales = await bakeryAPI.getSalesData(timeRange)
        setSalesData(sales)

        // Get customer data
        const customers = await bakeryAPI.getCustomerData()
        setCustomerData(customers)

        // Get product data
        const products = await bakeryAPI.getProducts()
        setProductData(products)

        // Get sales trend
        const salesTrendData = await bakeryAPI.getTimeSeriesData(
          'sales',
          timeRange
        )
        setSalesTrend(salesTrendData)

        // Get customer trend (or fallback if not available)
        try {
          const customerTrendData = await bakeryAPI.getTimeSeriesData(
            'customers',
            timeRange
          )
          setCustomerTrend(customerTrendData)
        } catch (error) {
          // Use sales trend as fallback with modified values
          const modifiedSalesTrend = salesTrendData.map((item) => ({
            ...item,
            value: Math.max(
              1,
              Math.floor(item.value / (Math.random() * 5 + 10))
            ),
          }))
          setCustomerTrend(modifiedSalesTrend)
        }

        // Calculate summary data
        const summaryData = await bakeryAPI.getSummaryData(timeRange)
        setSummary(summaryData)

        // Get previous period summary for comparison
        let previousTimeRange = timeRange
        const previousSummaryData = await bakeryAPI.getSummaryData(
          previousTimeRange
        )
        setPreviousSummary(previousSummaryData)
      } catch (error) {
        console.error('Error fetching sales data:', error)
        setError(
          'Beim Laden der Verkaufsdaten ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.'
        )
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [timeRange])

  // Handle time range change
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range)
  }

  // Handle close error alert
  const handleCloseError = () => {
    setError(null)
  }

  // Format sales data for display
  const formatSalesData = () => {
    return salesData.map((item) => ({
      id: item.id,
      date: new Date(item.date).toLocaleDateString(),
      product: item.product_name,
      quantity: item.quantity,
      total: `${item.total.toFixed(2)} €`,
      payment: item.payment_method,
    }))
  }

  // Get best-selling products
  const getBestSellingProducts = () => {
    // Group sales by product and calculate total quantity sold
    const productSales: Record<string, { name: string; quantity: number }> = {}

    salesData.forEach((sale) => {
      if (!productSales[sale.product_id]) {
        productSales[sale.product_id] = { name: sale.product_name, quantity: 0 }
      }
      productSales[sale.product_id].quantity += sale.quantity
    })

    // Convert to array and sort by quantity
    return Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5) // Get top 5
      .map((product) => ({ name: product.name, value: product.quantity }))
  }

  // Get sales by payment method
  const getSalesByPaymentMethod = () => {
    const paymentMethods: Record<string, number> = {}

    salesData.forEach((sale) => {
      if (!paymentMethods[sale.payment_method]) {
        paymentMethods[sale.payment_method] = 0
      }
      paymentMethods[sale.payment_method] += sale.total
    })

    return Object.entries(paymentMethods).map(([name, value]) => ({
      name,
      value,
    }))
  }

  // Calculate percentage changes
  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  return (
    <>
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
              Verkaufsbereich: Umsatzübersicht
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
                    value={`${summary.totalSales.toFixed(2)} €`}
                    icon={<AttachMoneyIcon />}
                    percentageChange={calculatePercentageChange(
                      summary.totalSales,
                      previousSummary?.totalSales || 0
                    )}
                    color="#4caf50"
                    tooltip="Gesamtumsatz im ausgewählten Zeitraum"
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
                    color="#2196f3"
                    tooltip="Anzahl der Verkäufe im ausgewählten Zeitraum"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <MetricCard
                    title="Ø Bestellwert"
                    value={`${summary.averageOrderValue.toFixed(2)} €`}
                    icon={<LocalOfferIcon />}
                    percentageChange={calculatePercentageChange(
                      summary.averageOrderValue,
                      previousSummary?.averageOrderValue || 0
                    )}
                    color="#ff9800"
                    tooltip="Durchschnittlicher Wert pro Transaktion"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <MetricCard
                    title="Verkaufte Artikel"
                    value={summary.totalItems}
                    icon={<ShoppingCartIcon />}
                    percentageChange={calculatePercentageChange(
                      summary.totalItems,
                      previousSummary?.totalItems || 0
                    )}
                    color="#9c27b0"
                    tooltip="Gesamtzahl der verkauften Artikel"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <MetricCard
                    title="Konversionsrate"
                    value={`${(
                      (summary.transactions / summary.uniqueTransactions) *
                      100
                    ).toFixed(1)}%`}
                    icon={<TrendingUpIcon />}
                    percentageChange={calculatePercentageChange(
                      summary.transactions / summary.uniqueTransactions,
                      previousSummary
                        ? previousSummary.transactions /
                            previousSummary.uniqueTransactions
                        : 0
                    )}
                    color="#607d8b"
                    tooltip="Prozentsatz der Laden-Besucher, die einen Kauf getätigt haben"
                  />
                </Grid>
              </Grid>

              {/* Charts Row */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={8}>
                  <ChartComponent
                    title="Umsatzentwicklung"
                    subtitle={`Umsatztrend für den Zeitraum: ${timeRange}`}
                    type="area"
                    data={salesTrend}
                    dataKeys={{ x: 'date', y: ['value'], colors: ['#4caf50'] }}
                    height={300}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <ChartComponent
                    title="Meistverkaufte Produkte"
                    subtitle="Top-Produkte nach verkaufter Menge"
                    type="bar"
                    data={getBestSellingProducts()}
                    dataKeys={{ x: 'name', y: 'value', colors: ['#2196f3'] }}
                    height={300}
                  />
                </Grid>
              </Grid>

              {/* Payment Methods & Customer Insights */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={6}>
                  <ChartComponent
                    title="Zahlungsarten"
                    subtitle="Umsatz nach Zahlungsart"
                    type="pie"
                    data={getSalesByPaymentMethod()}
                    dataKeys={{
                      x: 'name',
                      y: 'value',
                      colors: ['#4caf50', '#2196f3', '#ff9800', '#9c27b0'],
                    }}
                    height={300}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <StatsComparison
                    title="Verkaufsleistung"
                    subtitle="Vergleich mit vorherigem Zeitraum"
                    previousPeriodLabel={`vorheriger ${timeRange}`}
                    items={[
                      {
                        label: 'Gesamtumsatz',
                        current: summary.totalSales,
                        previous: previousSummary?.totalSales || 0,
                        unit: '€',
                        color: '#4caf50',
                        isHigherBetter: true,
                      },
                      {
                        label: 'Transaktionen',
                        current: summary.transactions,
                        previous: previousSummary?.transactions || 0,
                        color: '#2196f3',
                        isHigherBetter: true,
                      },
                      {
                        label: 'Durchschn. Bestellwert',
                        current: summary.averageOrderValue,
                        previous: previousSummary?.averageOrderValue || 0,
                        unit: '€',
                        color: '#ff9800',
                        isHigherBetter: true,
                      },
                      {
                        label: 'Verkaufte Artikel',
                        current: summary.totalItems,
                        previous: previousSummary?.totalItems || 0,
                        color: '#9c27b0',
                        isHigherBetter: true,
                      },
                    ]}
                  />
                </Grid>
              </Grid>

              {/* Product Inventory & Customer Table */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={6}>
                  <DataTable
                    title="Produktbestand"
                    subtitle="Aktuelle Lagerbestände für den Verkauf"
                    columns={[
                      { id: 'name', label: 'Produkt', minWidth: 150 },
                      {
                        id: 'price',
                        label: 'Preis',
                        minWidth: 80,
                        align: 'right',
                        format: (value) => `${value.toFixed(2)} €`,
                      },
                      {
                        id: 'stock',
                        label: 'Bestand',
                        minWidth: 70,
                        align: 'right',
                      },
                      {
                        id: 'status',
                        label: 'Status',
                        minWidth: 120,
                        align: 'center',
                        format: (value: string) => (
                          <Chip
                            label={value}
                            color={
                              value === 'Kritisch'
                                ? 'error'
                                : value === 'Mittel'
                                ? 'warning'
                                : 'success'
                            }
                            size="small"
                          />
                        ),
                      },
                    ]}
                    data={productData.map((product) => ({
                      id: product.id,
                      name: product.name,
                      price: product.price,
                      stock: product.stock,
                      status:
                        product.stock < 10
                          ? 'Kritisch'
                          : product.stock < 30
                          ? 'Mittel'
                          : 'Gut',
                    }))}
                    searchEnabled={true}
                    emptyMessage="Keine Produktdaten verfügbar"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <DataTable
                    title="Top-Kunden"
                    subtitle="Kunden mit dem höchsten Umsatz"
                    columns={[
                      {
                        id: 'name',
                        label: 'Kunde',
                        minWidth: 150,
                        format: (value) => (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar
                              sx={{
                                mr: 1,
                                bgcolor:
                                  '#' +
                                  Math.floor(Math.random() * 16777215).toString(
                                    16
                                  ),
                              }}
                            >
                              {value.charAt(0)}
                            </Avatar>
                            <Typography variant="body2">{value}</Typography>
                          </Box>
                        ),
                      },
                      {
                        id: 'visits',
                        label: 'Besuche',
                        minWidth: 80,
                        align: 'center',
                      },
                      {
                        id: 'total_spent',
                        label: 'Ausgegeben',
                        minWidth: 120,
                        align: 'right',
                        format: (value) => `${value.toFixed(2)} €`,
                      },
                      {
                        id: 'loyalty',
                        label: 'Treue',
                        minWidth: 150,
                        format: (value) => (
                          <Rating
                            value={value}
                            readOnly
                            precision={0.5}
                            size="small"
                          />
                        ),
                      },
                    ]}
                    data={customerData
                      .sort((a, b) => b.total_spent - a.total_spent)
                      .slice(0, 10)
                      .map((customer) => ({
                        id: customer.id,
                        name: customer.name,
                        visits: customer.visits,
                        total_spent: customer.total_spent,
                        last_visit: customer.last_visit,
                        loyalty: Math.min(5, customer.visits / 5), // Convert visits to 0-5 scale for rating
                      }))}
                    emptyMessage="Keine Kundendaten verfügbar"
                  />
                </Grid>
              </Grid>

              {/* Sales Transactions */}
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <DataTable
                    title="Letzte Transaktionen"
                    subtitle="Aktuelle Verkaufstransaktionen"
                    columns={[
                      { id: 'id', label: 'Bestell-ID', minWidth: 80 },
                      { id: 'date', label: 'Datum', minWidth: 100 },
                      { id: 'product', label: 'Produkt', minWidth: 150 },
                      {
                        id: 'quantity',
                        label: 'Menge',
                        minWidth: 80,
                        align: 'right',
                      },
                      {
                        id: 'total',
                        label: 'Gesamt',
                        minWidth: 100,
                        align: 'right',
                        format: (value) => (
                          <Typography
                            component="span"
                            sx={{ color: '#4caf50', fontWeight: 'medium' }}
                          >
                            {value}
                          </Typography>
                        ),
                      },
                      {
                        id: 'payment',
                        label: 'Zahlungsart',
                        minWidth: 150,
                        format: (value) => (
                          <Chip
                            label={value}
                            size="small"
                            color={
                              value === 'Bargeld'
                                ? 'success'
                                : value === 'EC-Karte'
                                ? 'primary'
                                : value === 'Kreditkarte'
                                ? 'info'
                                : 'default'
                            }
                          />
                        ),
                      },
                    ]}
                    data={formatSalesData()}
                    searchEnabled={true}
                    emptyMessage="Keine Verkaufsdaten für den ausgewählten Zeitraum verfügbar"
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

export default SalesDashboard
