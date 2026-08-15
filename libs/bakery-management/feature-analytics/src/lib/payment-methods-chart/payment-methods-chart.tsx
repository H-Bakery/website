import React from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import { Paper, Typography, Box } from '@mui/material'
import type { PaymentMethodData } from '@bakery/shared/types'

export interface PaymentMethodsChartProps {
  data: PaymentMethodData[]
  title?: string
  height?: number
  showLegend?: boolean
  showValues?: boolean
}

const COLORS = [
  '#007bff',
  '#28a745',
  '#ffc107',
  '#dc3545',
  '#6c757d',
  '#17a2b8',
]

export function PaymentMethodsChart({
  data,
  title = 'Zahlungsmethoden',
  height = 400,
  showLegend = true,
  showValues = true,
}: PaymentMethodsChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value)
  }

  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0)

  const chartData = data.map((item) => ({
    ...item,
    percentage: ((item.amount / totalAmount) * 100).toFixed(1),
  }))

  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percentage,
    index,
  }: any) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontWeight="bold"
      >
        {`${percentage}%`}
      </text>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <Paper sx={{ p: 1.5 }} elevation={3}>
          <Typography variant="subtitle2">{data.name}</Typography>
          <Typography variant="body2">Anzahl: {data.payload.count}</Typography>
          <Typography variant="body2">
            Betrag: {formatCurrency(data.value)}
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            Anteil: {data.payload.percentage}%
          </Typography>
        </Paper>
      )
    }
    return null
  }

  const renderLegend = (props: any) => {
    const { payload } = props
    return (
      <Box>
        {payload.map((entry: any, index: number) => (
          <Box
            key={`item-${index}`}
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            mb={1}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  backgroundColor: entry.color,
                  borderRadius: '50%',
                }}
              />
              <Typography variant="body2">{entry.value}</Typography>
            </Box>
            {showValues && (
              <Typography variant="body2" color="text.secondary">
                {formatCurrency(entry.payload.amount)} (
                {entry.payload.percentage}%)
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    )
  }

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>

      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={120}
            fill="#8884d8"
            dataKey="amount"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {showLegend && (
            <Legend
              verticalAlign="middle"
              align="right"
              layout="vertical"
              content={renderLegend}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </Paper>
  )
}

export default PaymentMethodsChart
