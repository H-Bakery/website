'use client'
import React, { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Grid,
  CircularProgress,
  Chip,
  Alert,
} from '@mui/material'
import InventoryIcon from '@mui/icons-material/Inventory'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import DeleteIcon from '@mui/icons-material/Delete'
import SpeedIcon from '@mui/icons-material/Speed'

import DateRangeSelector, {
  TimeRange,
} from '../../../../components/dashboard/DateRangeSelector'
import MetricCard from '../../../../components/dashboard/MetricCard'
import ChartComponent from '../../../../components/dashboard/ChartComponent'
import DataTable from '../../../../components/dashboard/DataTable'
import ProductivityChart from '../../../../components/dashboard/ProductivityChart'

import bakeryAPI from '../../../../services/bakeryAPI'
import {
  ProductionData,
  InventoryItem,
  StaffData,
} from '../../../../services/types'

const ProductionDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('day')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [productionData, setProductionData] = useState<ProductionData[]>([])
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([])
  const [staffData, setStaffData] = useState<StaffData[]>([])
  const [productionTrend, setProductionTrend] = useState<any[]>([])
  const [wasteTrend, setWasteTrend] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)

  // Fetch data based on selected time range
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Get production data
        const production = await bakeryAPI.getProductionData(timeRange)
        setProductionData(production)

        // Get inventory data
        const inventory = await bakeryAPI.getInventoryData()
        setInventoryData(inventory)

        // Get staff data
        const staff = await bakeryAPI.getStaffData()
        setStaffData(
          staff.filter(
            (s) =>
              s.role === 'Bäckermeister' ||
              s.role === 'Bäcker' ||
              s.role === 'Konditorin'
          )
        )

        // Get production trend
        const productionTrendData = await bakeryAPI.getTimeSeriesData(
          'production',
          timeRange
        )
        setProductionTrend(productionTrendData)

        // Get waste trend
        const wasteTrendData = await bakeryAPI.getTimeSeriesData(
          'waste',
          timeRange
        )
        setWasteTrend(wasteTrendData)

        // Calculate summary data
        const summaryData = await bakeryAPI.getSummaryData(timeRange)
        setSummary(summaryData)
      } catch (error) {
        console.error('Error fetching production data:', error)
        setError(
          'Beim Laden der Produktionsdaten ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.'
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

  // Format production data for display
  const formatProductionData = () => {
    return productionData.map((item) => ({
      id: item.id,
      date: new Date(item.date).toLocaleDateString(),
      product: item.product_name,
      quantity: item.quantity_produced,
      waste: item.waste,
      staff: item.staff_name,
      efficiency:
        (
          ((item.quantity_produced - item.waste) / item.quantity_produced) *
          100
        ).toFixed(1) + '%',
    }))
  }

  // Get products by category for chart
  const getProductionByCategory = () => {
    const categories: Record<string, number> = {}

    productionData.forEach((item) => {
      // Extract category from product name (in a real app, you'd have a proper category field)
      const product = item.product_name
      let category = 'Sonstiges'

      if (product.includes('Brot') || product.includes('Baguette'))
        category = 'Brot'
      else if (product.includes('Kuchen') || product.includes('Törtchen'))
        category = 'Kuchen'
      else if (
        product.includes('Gebäck') ||
        product.includes('Croissant') ||
        product.includes('Brötchen')
      )
        category = 'Gebäck'
      else if (product.includes('Torte')) category = 'Torten'

      categories[category] =
        (categories[category] || 0) + item.quantity_produced
    })

    return Object.entries(categories).map(([name, value]) => ({ name, value }))
  }

  // Get staff productivity data
  const getStaffProductivity = () => {
    return staffData.map((staff) => ({
      name: staff.name,
      value: staff.productivity,
      target: 90, // Target productivity
      color:
        staff.productivity >= 90
          ? '#4caf50'
          : staff.productivity >= 80
          ? '#ff9800'
          : '#f44336',
    }))
  }

  // Find low stock inventory items
  const getLowStockItems = () => {
    return inventoryData.filter(
      (item) => item.quantity <= item.min_stock_level * 1.2
    )
  }

  // Combined production and waste chart data
  const getProductionWasteData = () => {
    // Merge the two datasets by date
    const combinedData: any[] = []
    const dateMap: Record<string, any> = {}

    productionTrend.forEach((item) => {
      dateMap[item.date] = { date: item.date, production: item.value, waste: 0 }
    })

    wasteTrend.forEach((item) => {
      if (dateMap[item.date]) {
        dateMap[item.date].waste = item.value
      } else {
        dateMap[item.date] = {
          date: item.date,
          production: 0,
          waste: item.value,
        }
      }
    })

    Object.values(dateMap).forEach((item) => combinedData.push(item))

    // Sort by date
    combinedData.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    return combinedData
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
              Backstube: Produktionsübersicht
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
                <Grid item xs={12} sm={6} md={3}>
                  <MetricCard
                    title="Gesamtproduktion"
                    value={summary.totalProduced}
                    unit=" Stück"
                    icon={<InventoryIcon />}
                    color="#4caf50"
                    tooltip="Gesamtzahl der produzierten Artikel im ausgewählten Zeitraum"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <MetricCard
                    title="Verkaufte Artikel"
                    value={summary.totalItems}
                    unit=" Stück"
                    icon={<LocalShippingIcon />}
                    color="#2196f3"
                    tooltip="Gesamtzahl der verkauften Artikel im ausgewählten Zeitraum"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <MetricCard
                    title="Ausschuss"
                    value={summary.totalWaste}
                    unit=" Stück"
                    icon={<DeleteIcon />}
                    color="#f44336"
                    tooltip="Gesamtmenge an Ausschuss im ausgewählten Zeitraum"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <MetricCard
                    title="Ausschussrate"
                    value={summary.wastageRate.toFixed(1)}
                    unit="%"
                    icon={<SpeedIcon />}
                    color="#ff9800"
                    tooltip="Prozentsatz der Produktion, der verschwendet wurde"
                  />
                </Grid>
              </Grid>

              {/* Low Stock Alert */}
              {getLowStockItems().length > 0 && (
                <Alert severity="warning" sx={{ mb: 4 }}>
                  <Typography
                    variant="subtitle1"
                    component="div"
                    sx={{ fontWeight: 'bold' }}
                  >
                    Warnung: Niedriger Lagerbestand
                  </Typography>
                  <Box
                    sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}
                  >
                    {getLowStockItems().map((item) => (
                      <Chip
                        key={item.id}
                        label={`${item.name}: ${item.quantity} ${item.unit} verbleibend`}
                        color="warning"
                        size="small"
                      />
                    ))}
                  </Box>
                </Alert>
              )}

              {/* Charts Row */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={8}>
                  <ChartComponent
                    title="Produktion & Ausschuss"
                    subtitle={`Trends für Produktion und Ausschuss im Zeitraum: ${timeRange}`}
                    type="line"
                    data={getProductionWasteData()}
                    dataKeys={{
                      x: 'date',
                      y: ['production', 'waste'],
                      colors: ['#4caf50', '#f44336'],
                    }}
                    height={300}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <ChartComponent
                    title="Produktion nach Kategorie"
                    subtitle="Verteilung der Produkte nach Kategorie"
                    type="pie"
                    data={getProductionByCategory()}
                    dataKeys={{
                      x: 'name',
                      y: 'value',
                      colors: [
                        '#4caf50',
                        '#2196f3',
                        '#ff9800',
                        '#9c27b0',
                        '#607d8b',
                      ],
                    }}
                    height={300}
                  />
                </Grid>
              </Grid>

              {/* Staff Productivity & Inventory */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={6}>
                  <ProductivityChart
                    title="Mitarbeiterproduktivität"
                    subtitle="Leistungsmetriken des Backstubenpersonals"
                    data={getStaffProductivity()}
                    valueLabel="Produktivitätswert"
                    targetLabel="Zielwert"
                    height={300}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <DataTable
                    title="Bestandsstatus"
                    subtitle="Aktuelle Lagerbestände"
                    columns={[
                      { id: 'name', label: 'Zutat', minWidth: 120 },
                      {
                        id: 'quantity',
                        label: 'Menge',
                        minWidth: 80,
                        align: 'right',
                      },
                      { id: 'unit', label: 'Einheit', minWidth: 60 },
                      {
                        id: 'status',
                        label: 'Status',
                        minWidth: 100,
                        align: 'center',
                        format: (value: string) => (
                          <Chip
                            label={value}
                            color={
                              value === 'Kritisch'
                                ? 'error'
                                : value === 'Nachbestellen'
                                ? 'warning'
                                : 'success'
                            }
                            size="small"
                          />
                        ),
                      },
                      {
                        id: 'last_restocked',
                        label: 'Letzte Auffüllung',
                        minWidth: 120,
                      },
                    ]}
                    data={inventoryData.map((item) => ({
                      id: item.id,
                      name: item.name,
                      quantity: item.quantity,
                      unit: item.unit,
                      status:
                        item.quantity <= item.min_stock_level
                          ? 'Kritisch'
                          : item.quantity <= item.min_stock_level * 1.5
                          ? 'Nachbestellen'
                          : 'OK',
                      last_restocked: new Date(
                        item.last_restocked
                      ).toLocaleDateString(),
                    }))}
                    searchEnabled={true}
                    emptyMessage="Keine Bestandsdaten verfügbar"
                  />
                </Grid>
              </Grid>

              {/* Production Records */}
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <DataTable
                    title="Produktionsaufzeichnungen"
                    subtitle="Detaillierte Produktionsdaten für den ausgewählten Zeitraum"
                    columns={[
                      { id: 'date', label: 'Datum', minWidth: 100 },
                      { id: 'product', label: 'Produkt', minWidth: 150 },
                      {
                        id: 'quantity',
                        label: 'Produziert',
                        minWidth: 100,
                        align: 'right',
                      },
                      {
                        id: 'waste',
                        label: 'Ausschuss',
                        minWidth: 100,
                        align: 'right',
                      },
                      {
                        id: 'efficiency',
                        label: 'Effizienz',
                        minWidth: 100,
                        align: 'right',
                        format: (value: string) => {
                          const percentage = parseFloat(value)
                          let color = '#4caf50' // green
                          if (percentage < 90) color = '#ff9800' // orange
                          if (percentage < 80) color = '#f44336' // red

                          return (
                            <Typography
                              component="span"
                              sx={{ color, fontWeight: 'medium' }}
                            >
                              {value}
                            </Typography>
                          )
                        },
                      },
                      { id: 'staff', label: 'Mitarbeiter', minWidth: 120 },
                    ]}
                    data={formatProductionData()}
                    searchEnabled={true}
                    emptyMessage="Keine Produktionsdaten für den ausgewählten Zeitraum verfügbar"
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

export default ProductionDashboard
