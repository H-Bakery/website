import React from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Box,
  Paper,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import type { RevenueData, Granularity } from '@bakery/shared/types'

// Recharts 2 misst Achsenbeschriftungen nicht; die Vorgabe von 60 px reicht
// für "12.500 €" nicht aus.
const REVENUE_AXIS_WIDTH = 80

export interface RevenueTrendChartProps {
  data: RevenueData[]
  granularity?: Granularity
  chartType?: 'line' | 'bar'
  height?: number
  title?: string
  showTransactions?: boolean
}

export function RevenueTrendChart({
  data,
  granularity = 'daily',
  chartType = 'line',
  height = 400,
  title = 'Umsatzentwicklung',
  showTransactions = false,
}: RevenueTrendChartProps) {
  const [currentChartType, setChartType] = React.useState(chartType)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    switch (granularity) {
      case 'daily':
        return date.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
        })
      case 'weekly':
        return `KW ${Math.ceil(date.getDate() / 7)}`
      case 'monthly':
        return date.toLocaleDateString('de-DE', {
          month: 'short',
          year: 'numeric',
        })
      default:
        return dateString
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value)
  }

  // Achsenbeschriftung ohne Cent: "1.500,00 €" ist breiter als die Achse und
  // wurde links abgeschnitten, so dass jede Stufe als "00,00 €" zu lesen war.
  const formatAxisCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const chartData = data.map((item) => ({
    ...item,
    date: formatDate(item.date),
  }))

  const Chart = currentChartType === 'line' ? LineChart : BarChart

  const renderSeries = (
    yAxisId: string,
    dataKey: string,
    name: string,
    color: string
  ) =>
    currentChartType === 'line' ? (
      <Line
        key={dataKey}
        yAxisId={yAxisId}
        dataKey={dataKey}
        name={name}
        stroke={color}
        fill={color}
        strokeWidth={2}
      />
    ) : (
      <Bar
        key={dataKey}
        yAxisId={yAxisId}
        dataKey={dataKey}
        name={name}
        fill={color}
      />
    )

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        <ToggleButtonGroup
          value={currentChartType}
          exclusive
          onChange={(_, value) => value && setChartType(value)}
          size="small"
        >
          <ToggleButton value="line">Linie</ToggleButton>
          <ToggleButton value="bar">Balken</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <ResponsiveContainer width="100%" height={height}>
        <Chart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis
            yAxisId="revenue"
            width={REVENUE_AXIS_WIDTH}
            tickFormatter={formatAxisCurrency}
          />
          {showTransactions && (
            <YAxis yAxisId="transactions" orientation="right" />
          )}
          <Tooltip
            formatter={(value: number | string, name: string) => {
              if (name === 'Umsatz' || name === 'revenue')
                return formatCurrency(Number(value))
              return value
            }}
            labelFormatter={(label) => `Datum: ${label}`}
          />
          <Legend />
          {renderSeries('revenue', 'revenue', 'Umsatz', '#007bff')}
          {showTransactions &&
            renderSeries(
              'transactions',
              'transactionCount',
              'Transaktionen',
              '#28a745'
            )}
        </Chart>
      </ResponsiveContainer>
    </Paper>
  )
}

export default RevenueTrendChart
