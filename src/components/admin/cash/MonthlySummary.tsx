'use client'
import React, { useMemo } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Divider,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  Euro,
  CalendarMonth,
  Assessment,
} from '@mui/icons-material'
import { CashEntry } from '../../../services/types'

interface MonthlySummaryProps {
  cashEntries: CashEntry[]
}

interface MonthlyData {
  month: string
  year: number
  entries: CashEntry[]
  total: number
  average: number
  entryCount: number
  trend: 'up' | 'down' | 'stable'
  trendPercentage: number
}

const MonthlySummary: React.FC<MonthlySummaryProps> = ({ cashEntries }) => {
  const monthlyData = useMemo(() => {
    // Group entries by month
    const groupedByMonth = cashEntries.reduce((acc, entry) => {
      const date = new Date(entry.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!acc[monthKey]) {
        acc[monthKey] = []
      }
      acc[monthKey].push(entry)
      
      return acc
    }, {} as Record<string, CashEntry[]>)

    // Calculate monthly statistics
    const months: MonthlyData[] = Object.entries(groupedByMonth)
      .map(([monthKey, entries]) => {
        const [year, month] = monthKey.split('-')
        const total = entries.reduce((sum, entry) => sum + entry.amount, 0)
        const average = total / entries.length
        
        return {
          month: new Date(parseInt(year), parseInt(month) - 1).toLocaleString('de-DE', { 
            month: 'long', 
            year: 'numeric' 
          }),
          year: parseInt(year),
          entries,
          total,
          average,
          entryCount: entries.length,
          trend: 'stable' as const,
          trendPercentage: 0,
        }
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return new Date(b.entries[0].date).getMonth() - new Date(a.entries[0].date).getMonth()
      })

    // Calculate trends
    for (let i = 0; i < months.length - 1; i++) {
      const current = months[i]
      const previous = months[i + 1]
      
      if (previous) {
        const change = ((current.total - previous.total) / previous.total) * 100
        current.trendPercentage = Math.abs(change)
        
        if (change > 5) {
          current.trend = 'up'
        } else if (change < -5) {
          current.trend = 'down'
        } else {
          current.trend = 'stable'
        }
      }
    }

    return months
  }, [cashEntries])

  const currentMonthData = monthlyData[0]
  const previousMonthData = monthlyData[1]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp color="success" />
      case 'down':
        return <TrendingDown color="error" />
      default:
        return <Euro color="info" />
    }
  }

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'success'
      case 'down':
        return 'error'
      default:
        return 'info'
    }
  }

  const calculateYearlyTotal = () => {
    const currentYear = new Date().getFullYear()
    return monthlyData
      .filter(month => month.year === currentYear)
      .reduce((sum, month) => sum + month.total, 0)
  }

  const calculateYearlyAverage = () => {
    const currentYear = new Date().getFullYear()
    const currentYearMonths = monthlyData.filter(month => month.year === currentYear)
    
    if (currentYearMonths.length === 0) return 0
    
    return calculateYearlyTotal() / currentYearMonths.length
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Monatsübersicht
      </Typography>

      {/* Current Month Overview */}
      {currentMonthData && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {currentMonthData.month}
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Euro color="primary" sx={{ mr: 1 }} />
                    <Typography variant="body2">Gesamtsumme</Typography>
                  </Box>
                  <Typography variant="h5" color="primary">
                    {formatCurrency(currentMonthData.total)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Assessment color="info" sx={{ mr: 1 }} />
                    <Typography variant="body2">Durchschnitt</Typography>
                  </Box>
                  <Typography variant="h5" color="info.main">
                    {formatCurrency(currentMonthData.average)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CalendarMonth color="secondary" sx={{ mr: 1 }} />
                    <Typography variant="body2">Einträge</Typography>
                  </Box>
                  <Typography variant="h5" color="secondary.main">
                    {currentMonthData.entryCount}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    {getTrendIcon(currentMonthData.trend)}
                    <Typography variant="body2" sx={{ ml: 1 }}>
                      Trend
                    </Typography>
                  </Box>
                  <Typography 
                    variant="h5" 
                    color={`${getTrendColor(currentMonthData.trend)}.main`}
                  >
                    {currentMonthData.trend === 'stable' ? '±0%' : 
                     `${currentMonthData.trend === 'up' ? '+' : '-'}${currentMonthData.trendPercentage.toFixed(1)}%`}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          {previousMonthData && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Verglichen mit {previousMonthData.month}: {formatCurrency(previousMonthData.total)}
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Yearly Overview */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Jahresübersicht {new Date().getFullYear()}
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Jahressumme
                </Typography>
                <Typography variant="h4" color="primary">
                  {formatCurrency(calculateYearlyTotal())}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Monatsdurchschnitt
                </Typography>
                <Typography variant="h4" color="success.main">
                  {formatCurrency(calculateYearlyAverage())}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Monthly Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Monat</TableCell>
              <TableCell align="right">Gesamtsumme</TableCell>
              <TableCell align="right">Durchschnitt</TableCell>
              <TableCell align="center">Einträge</TableCell>
              <TableCell align="center">Trend</TableCell>
              <TableCell align="right">Fortschritt</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {monthlyData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Keine Daten verfügbar
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              monthlyData.map((month, index) => {
                const maxTotal = Math.max(...monthlyData.map(m => m.total))
                const progressPercentage = maxTotal > 0 ? (month.total / maxTotal) * 100 : 0
                
                return (
                  <TableRow key={`${month.year}-${month.month}`} hover>
                    <TableCell>
                      <Typography variant="body1" fontWeight={index === 0 ? 600 : 400}>
                        {month.month}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body1" fontWeight={600}>
                        {formatCurrency(month.total)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">
                        {formatCurrency(month.average)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={month.entryCount} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getTrendIcon(month.trend)}
                        {month.trendPercentage > 0 && (
                          <Typography 
                            variant="caption" 
                            color={`${getTrendColor(month.trend)}.main`}
                            sx={{ ml: 0.5 }}
                          >
                            {month.trendPercentage.toFixed(1)}%
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ width: 150 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LinearProgress
                          variant="determinate"
                          value={progressPercentage}
                          sx={{ flexGrow: 1, mr: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {progressPercentage.toFixed(0)}%
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

export default MonthlySummary