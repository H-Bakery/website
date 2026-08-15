'use client'
import React, { useState, useEffect } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  LinearProgress,
} from '@mui/material'
import {
  TrendingDown,
  Assessment,
  CalendarMonth,
  Warning,
} from '@mui/icons-material'
import { bakeryAPI } from '@bakery/shared/data-access'
import { Product, UnsoldProduct } from '@bakery/shared/types'

interface WeeklySummaryProps {
  selectedDate: string
}

interface DaySummary {
  date: string
  totalUnsold: number
  productsCount: number
  hasData: boolean
}

interface ProductWasteSummary {
  productId: number
  productName: string
  category: string
  totalWaste: number
  averagePerDay: number
  wasteValue: number
  price: number
}

export const WeeklySummary: React.FC<WeeklySummaryProps> = ({
  selectedDate,
}) => {
  const [weekData, setWeekData] = useState<DaySummary[]>([])
  const [productWaste, setProductWaste] = useState<ProductWasteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get the week range for the selected date
  const getWeekRange = (date: string) => {
    const selectedDate = new Date(date)
    const currentDay = selectedDate.getDay()
    const monday = new Date(selectedDate)
    monday.setDate(
      selectedDate.getDate() - (currentDay === 0 ? 6 : currentDay - 1)
    )

    const week = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday)
      day.setDate(monday.getDate() + i)
      week.push(day.toISOString().split('T')[0])
    }
    return week
  }

  useEffect(() => {
    loadWeeklyData()
  }, [selectedDate])

  const loadWeeklyData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [unsoldData, products] = await Promise.all([
        bakeryAPI.unsoldProducts.getAll(),
        bakeryAPI.products.getAll(),
      ])

      const weekDates = getWeekRange(selectedDate)

      // Create daily summaries
      const dailySummaries: DaySummary[] = weekDates.map((date) => {
        const dayEntries = unsoldData.filter(
          (entry: UnsoldProduct) => entry.date === date
        )
        return {
          date,
          totalUnsold: dayEntries.reduce(
            (sum: number, entry: UnsoldProduct) => sum + entry.quantity,
            0
          ),
          productsCount: dayEntries.length,
          hasData: dayEntries.length > 0,
        }
      })

      // Create product waste summary for the week
      const weekEntries = unsoldData.filter((entry: UnsoldProduct) =>
        weekDates.includes(entry.date)
      )
      const productWasteMap = new Map<
        number,
        { total: number; entries: number }
      >()

      weekEntries.forEach((entry: UnsoldProduct) => {
        const productId = entry.productId
        const existing = productWasteMap.get(productId) || {
          total: 0,
          entries: 0,
        }
        productWasteMap.set(productId, {
          total: existing.total + entry.quantity,
          entries: existing.entries + 1,
        })
      })

      const productWasteSummary: ProductWasteSummary[] = Array.from(
        productWasteMap.entries()
      )
        .map(([productId, data]) => {
          const product = products.find((p: Product) => p.id === productId)
          if (!product) return null

          return {
            productId,
            productName: product.name,
            category: product.category || 'Sonstiges',
            totalWaste: data.total,
            averagePerDay: data.total / 7,
            wasteValue: data.total * product.price,
            price: product.price,
          }
        })
        .filter(Boolean) as ProductWasteSummary[]

      // Sort by total waste descending
      productWasteSummary.sort((a, b) => b.totalWaste - a.totalWaste)

      setWeekData(dailySummaries)
      setProductWaste(productWasteSummary)
    } catch (error) {
      console.error('Error loading weekly data:', error)
      setError('Fehler beim Laden der Wochendaten')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    })
  }

  const getTotalWeekWaste = () => {
    return weekData.reduce((sum, day) => sum + day.totalUnsold, 0)
  }

  const getTotalWeekValue = () => {
    return productWaste.reduce((sum, product) => sum + product.wasteValue, 0)
  }

  const getDaysWithData = () => {
    return weekData.filter((day) => day.hasData).length
  }

  const getWorstDay = () => {
    return weekData.reduce(
      (worst, day) => (day.totalUnsold > worst.totalUnsold ? day : worst),
      weekData[0] || { totalUnsold: 0, date: '' }
    )
  }

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Lade Wochensummary...
        </Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error}
      </Alert>
    )
  }

  const worstDay = getWorstDay()

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h5"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <CalendarMonth color="primary" />
        Wochensummary
      </Typography>

      {/* Week Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <TrendingDown color="warning" />
                <Typography variant="h6">Gesamt Verlust</Typography>
              </Box>
              <Typography variant="h4" color="warning.main" fontWeight={700}>
                {getTotalWeekWaste()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Produkte unverkauft
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <Assessment color="error" />
                <Typography variant="h6">Wert</Typography>
              </Box>
              <Typography variant="h4" color="error.main" fontWeight={700}>
                €{getTotalWeekValue().toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Geschätzter Verlust
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <CalendarMonth color="info" />
                <Typography variant="h6">Erfasst</Typography>
              </Box>
              <Typography variant="h4" color="info.main" fontWeight={700}>
                {getDaysWithData()}/7
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tage mit Daten
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <Warning color="warning" />
                <Typography variant="h6">Schlimmster Tag</Typography>
              </Box>
              <Typography variant="h4" color="warning.main" fontWeight={700}>
                {worstDay.totalUnsold}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {worstDay.date ? formatDate(worstDay.date) : 'Keine Daten'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Daily Overview */}
      <Paper elevation={2} sx={{ mb: 4 }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Tägliche Übersicht
          </Typography>
          <Grid container spacing={1}>
            {weekData.map((day, index) => (
              <Grid item xs key={day.date}>
                <Card
                  variant={day.hasData ? 'outlined' : 'elevation'}
                  sx={{
                    textAlign: 'center',
                    bgcolor: day.hasData ? 'background.paper' : 'grey.50',
                    borderColor:
                      day.totalUnsold > 0 ? 'warning.main' : 'divider',
                  }}
                >
                  <CardContent sx={{ py: 1, px: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(day.date)}
                    </Typography>
                    <Typography
                      variant="h6"
                      color={day.hasData ? 'text.primary' : 'text.secondary'}
                    >
                      {day.totalUnsold}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {day.productsCount} Produkte
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Paper>

      {/* Product Waste Summary */}
      {productWaste.length > 0 && (
        <Paper elevation={2}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Produktverluste dieser Woche
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Produkt</TableCell>
                    <TableCell>Kategorie</TableCell>
                    <TableCell align="right">Gesamt</TableCell>
                    <TableCell align="right">Ø/Tag</TableCell>
                    <TableCell align="right">Wert</TableCell>
                    <TableCell align="center">Anteil</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productWaste.slice(0, 10).map((product) => (
                    <TableRow key={product.productId}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {product.productName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={product.category}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>
                          {product.totalWaste}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          {product.averagePerDay.toFixed(1)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color="error.main"
                          fontWeight={600}
                        >
                          €{product.wasteValue.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ width: 60 }}>
                          <LinearProgress
                            variant="determinate"
                            value={
                              (product.totalWaste / getTotalWeekWaste()) * 100
                            }
                            color="warning"
                          />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>
      )}
    </Box>
  )
}

export default WeeklySummary
