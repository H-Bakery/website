'use client'
import React, { useState } from 'react'
import {
  Typography,
  Box,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Grid,
  Button,
  LinearProgress,
  Alert,
  Link as MuiLink,
} from '@mui/material'
import {
  ShowChart as ShowChartIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import {
  RevenueTrendChart,
  DateRangePicker,
  ExportButton,
} from '@bakery/management/feature-analytics'
import { analyticsService } from '@bakery/shared/data-access'
import type { RevenueData, DateRange, Granularity } from '@bakery/shared/types'

export default function RevenueAnalyticsPage() {
  const [loading, setLoading] = useState(false)
  const [granularity, setGranularity] = useState<Granularity>('daily')
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
  })

  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [available, setAvailable] = useState(true)

  React.useEffect(() => {
    fetchRevenueData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, granularity])

  function getDefaultStartDate() {
    const date = new Date()
    date.setMonth(date.getMonth() - 3) // Last 3 months
    return date.toISOString().split('T')[0]
  }

  function getDefaultEndDate() {
    return new Date().toISOString().split('T')[0]
  }

  const fetchRevenueData = async () => {
    try {
      setLoading(true)
      const { data, available: fromApi } =
        await analyticsService.getRevenueTrendsWithSource({
          ...dateRange,
          granularity,
        })
      setRevenueData(data)
      setAvailable(fromApi)
    } catch (error) {
      console.error('Error fetching revenue data:', error)
      setRevenueData([])
      setAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    if (revenueData.length === 0)
      return { total: 0, average: 0, highest: 0, lowest: 0 }

    const revenues = revenueData.map((d) => d.revenue)
    const total = revenues.reduce((sum, rev) => sum + rev, 0)
    const average = total / revenues.length
    const highest = Math.max(...revenues)
    const lowest = Math.min(...revenues)

    return { total, average, highest, lowest }
  }

  const stats = calculateStats()
  const hasData = available && revenueData.length > 0
  const periodLabel =
    granularity === 'weekly'
      ? 'Woche'
      : granularity === 'monthly'
      ? 'Monat'
      : 'Tag'

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          component={Link}
          href="/admin/analytics"
          startIcon={<ArrowBackIcon />}
          size="small"
          sx={{ mb: 1 }}
        >
          Zurück zur Analyse-Übersicht
        </Button>
        <Typography variant="h4" component="h1">
          <ShowChartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Umsatzanalyse
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Umsatzentwicklung aus den Kassenberichten (Tagesabschlüsse der Kasse)
        </Typography>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

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
            value={granularity}
            exclusive
            onChange={(_, value) => value && setGranularity(value)}
            size="small"
          >
            <ToggleButton value="daily">Täglich</ToggleButton>
            <ToggleButton value="weekly">Wöchentlich</ToggleButton>
            <ToggleButton value="monthly">Monatlich</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <ExportButton
          formats={['csv', 'pdf', 'excel']}
          analyticsParams={{ ...dateRange, granularity }}
        />
      </Box>

      {!available && !loading && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Die API liefert keine Umsatzdaten. Es werden keine Zahlen angezeigt -
          Beispieldaten gibt es hier bewusst nicht.
        </Alert>
      )}

      {available && !loading && revenueData.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Für den gewählten Zeitraum liegt kein Kassenbericht vor.
        </Alert>
      )}

      {hasData && (
        <>
          {/* Statistics */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Gesamtumsatz
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(stats.total)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {revenueData.length}{' '}
                  {revenueData.length === 1 ? periodLabel : `${periodLabel}e`}{' '}
                  mit Bericht
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Durchschnitt je {periodLabel}
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(stats.average)}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Höchster Umsatz
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(stats.highest)}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Niedrigster Umsatz
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(stats.lowest)}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Revenue Chart */}
          <RevenueTrendChart
            data={revenueData}
            granularity={granularity}
            title="Umsatzentwicklung"
            height={500}
            showTransactions={true}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 2 }}
          >
            Quelle: Kassenberichte aus dem HQ-Archiv. Tage ohne Bericht
            (Ruhetag, Betriebsferien) fehlen in der Reihe, sie sind nicht 0.
            Details je Tag im{' '}
            <MuiLink component={Link} href="/admin/reports">
              Berichtsarchiv
            </MuiLink>
            .
          </Typography>
        </>
      )}
    </Box>
  )
}
