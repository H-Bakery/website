'use client'
import React, { useState } from 'react'
import {
  Container,
  Typography,
  Box,
  Grid,
  CircularProgress,
  Chip,
  Alert,
  Skeleton,
  Card,
  CardContent,
  Tab,
  Tabs,
  Button,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material'
import {
  Inventory as InventoryIcon,
  LocalShipping as LocalShippingIcon,
  Delete as DeleteIcon,
  Speed as SpeedIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  MonitorHeart as MonitorIcon,
  CalendarToday as CalendarIcon,
  Refresh as RefreshIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material'

import {
  DateRangeSelector,
  MetricCard,
  ChartComponent,
  DataTable,
  ProductivityChart,
  type TimeRange,
} from '@bakery/bakery-management/feature-dashboard'

// New production planning components
import ProductionScheduleBoard from '../../../../components/production/ProductionScheduleBoard'
import ProductionSchedulerDragDrop from '../../../../components/production/ProductionSchedulerDragDrop'
import ProductionMetricsCard from '../../../../components/production/ProductionMetricsCard'
import ProductionStatusPanel from '../../../../components/production/ProductionStatusPanel'
import CapacityPlanningPanel from '../../../../components/production/CapacityPlanningPanel'
import ResourceOptimizationPanel from '../../../../components/production/ResourceOptimizationPanel'

import {
  useProductionDashboardData,
  useSummaryData,
} from '../../../../hooks/useDashboard'
import { useProductionAnalytics } from '../../../../hooks/useProduction'
import { useAuth } from '../../../../context/AuthContext'
import { ScheduleViewMode } from '../../../../types/production'

const ProductionDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('day')
  const [activeTab, setActiveTab] = useState(0)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ScheduleViewMode>({
    type: 'calendar',
    period: 'day',
  })
  const { token } = useAuth()

  // Fetch production dashboard data
  const {
    productionData,
    productionTrend,
    wasteTrend,
    inventoryData,
    staffData: allStaffData,
    isLoading,
    error,
    refetch,
  } = useProductionDashboardData(timeRange)

  // Filter staff data for production roles
  const staffData = allStaffData.filter(
    (s) =>
      s.role === 'Bäckermeister' ||
      s.role === 'Bäcker' ||
      s.role === 'Konditorin'
  )

  // Get summary data
  const { data: summary } = useSummaryData(timeRange)

  // Fetch production analytics for new components
  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    error: analyticsError,
  } = useProductionAnalytics({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    includeSteps: true,
    groupBy: 'day',
  })

  // Check for authentication errors
  React.useEffect(() => {
    if (error && error.message && error.message.includes('Authentication')) {
      // Redirect to login or show auth error
      console.error('Authentication error:', error)
    }
  }, [error])

  // Handle time range change
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range)
  }

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  // Handle date change for production scheduling
  const handleDateChange = (date: Date) => {
    setSelectedDate(date)
  }

  // Handle view mode change for production scheduling
  const handleViewModeChange = (mode: ScheduleViewMode) => {
    setViewMode(mode)
  }

  // Handle close error alert
  const handleCloseError = () => {
    // Error is managed by React Query
    refetch()
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
      {isLoading || analyticsLoading ? (
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
          <>
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
                Produktions-Dashboard
              </Typography>
              <Box display="flex" gap={2} alignItems="center">
                {activeTab === 0 && (
                  <DateRangeSelector
                    timeRange={timeRange}
                    onTimeRangeChange={handleTimeRangeChange}
                  />
                )}
                {activeTab === 1 && (
                  <Box display="flex" gap={1} alignItems="center">
                    <input
                      type="date"
                      value={selectedDate.toISOString().split('T')[0]}
                      onChange={(e) =>
                        handleDateChange(new Date(e.target.value))
                      }
                      style={{
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                      }}
                    />
                    <Tooltip title="Ansicht aktualisieren">
                      <IconButton size="small">
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Tab Navigation */}
            <Card sx={{ mb: 3 }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant="fullWidth"
                indicatorColor="primary"
                textColor="primary"
              >
                <Tab
                  icon={<DashboardIcon />}
                  label="Produktionsübersicht"
                  sx={{ minHeight: 64 }}
                />
                <Tab
                  icon={<ScheduleIcon />}
                  label="Produktionsplanung"
                  sx={{ minHeight: 64 }}
                />
                <Tab
                  icon={<MonitorIcon />}
                  label="Live-Monitoring"
                  sx={{ minHeight: 64 }}
                />
                <Tab
                  icon={<AssessmentIcon />}
                  label="Analytics"
                  sx={{ minHeight: 64 }}
                />
                <Tab
                  icon={<SpeedIcon />}
                  label="Kapazitätsplanung"
                  sx={{ minHeight: 64 }}
                />
              </Tabs>
            </Card>

            {(error || analyticsError) && (
              <Alert severity="error" sx={{ mb: 4 }} onClose={handleCloseError}>
                {error?.message ||
                  (analyticsError as any)?.message ||
                  'Beim Laden der Produktionsdaten ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.'}
              </Alert>
            )}

            {/* Tab Content */}
            {activeTab === 0 && summary && (
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
                      value={summary?.wastageRate?.toFixed(1) || '0'}
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

            {/* Production Planning Tab */}
            {activeTab === 1 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <ProductionSchedulerDragDrop
                    selectedDate={selectedDate}
                    viewMode={viewMode}
                    onDateChange={handleDateChange}
                    onViewModeChange={handleViewModeChange}
                  />
                </Grid>
              </Grid>
            )}

            {/* Live Monitoring Tab */}
            {activeTab === 2 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <ProductionStatusPanel
                    selectedDate={selectedDate}
                    refreshInterval={30000}
                    showAlerts={true}
                    showTimeline={true}
                  />
                </Grid>
              </Grid>
            )}

            {/* Analytics Tab */}
            {activeTab === 3 && analyticsData && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <ProductionMetricsCard
                    metrics={analyticsData}
                    title="Produktionsanalytics"
                    showTrends={true}
                    compact={false}
                  />
                </Grid>

                {/* Additional analytics charts can be added here */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Workflow-Performance
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Detaillierte Analyse der Workflow-Effizienz wird hier
                        angezeigt.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Qualitätstrends
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Qualitätsmetriken und Trends über Zeit werden hier
                        dargestellt.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {/* Loading state for analytics tab */}
            {activeTab === 3 && !analyticsData && !analyticsError && (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            )}

            {/* Capacity Planning Tab Content */}
            {activeTab === 4 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <CapacityPlanningPanel
                    selectedDate={selectedDate}
                    onOptimizeSchedule={() => {
                      // Trigger optimization
                      console.log('Optimize schedule triggered')
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <ResourceOptimizationPanel
                    selectedDate={selectedDate}
                    onOptimizationComplete={() => {
                      // Refresh data after optimization
                      refetch()
                      console.log('Optimization completed')
                    }}
                  />
                </Grid>
              </Grid>
            )}
          </>
        </Container>
      )}
    </>
  )
}

export default ProductionDashboard
