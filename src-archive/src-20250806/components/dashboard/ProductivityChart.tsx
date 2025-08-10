'use client'
import React from 'react'
import { Paper, Typography, Box, Divider, useTheme } from '@mui/material'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface ProductivityItem {
  name: string
  value: number
  target?: number
  color?: string
}

interface ProductivityChartProps {
  title: string
  subtitle?: string
  data: ProductivityItem[]
  valueLabel?: string
  targetLabel?: string
  height?: number
  showTarget?: boolean
}

const ProductivityChart: React.FC<ProductivityChartProps> = ({
  title,
  subtitle,
  data,
  valueLabel = 'Actual',
  targetLabel = 'Target',
  height = 300,
  showTarget = true,
}) => {
  const theme = useTheme()

  // Add color to each item if not provided
  const dataWithColors = data.map((item, index) => ({
    ...item,
    color: item.color || theme.palette.primary.main,
  }))

  // Custom tooltip to show percentage of target
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      const value = item.value
      const target = item.target || 0
      const percentage = target ? ((value / target) * 100).toFixed(1) : null

      return (
        <div
          style={{
            backgroundColor: '#fff',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        >
          <p style={{ margin: 0, fontWeight: 'bold' }}>{`${label}`}</p>
          <p
            style={{ margin: '5px 0 0', color: payload[0].color }}
          >{`${valueLabel}: ${value}`}</p>
          {showTarget && target > 0 && (
            <>
              <p
                style={{
                  margin: '5px 0 0',
                  color: theme.palette.secondary.main,
                }}
              >
                {`${targetLabel}: ${target}`}
              </p>
              <Divider sx={{ my: 1 }} />
              <p style={{ margin: 0, fontWeight: 'bold' }}>
                {`Achievement: ${percentage}%`}
              </p>
            </>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <Paper
      sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Typography variant="h6" component="h3" gutterBottom>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {subtitle}
        </Typography>
      )}
      <Box sx={{ flexGrow: 1, width: '100%' }}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={dataWithColors}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={true}
              vertical={false}
            />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              dataKey="value"
              name={valueLabel}
              fill={theme.palette.primary.main}
            >
              {dataWithColors.map((entry, index) => (
                <Bar key={`bar-${index}`} dataKey="value" fill={entry.color} />
              ))}
            </Bar>
            {showTarget && (
              <Bar
                dataKey="target"
                name={targetLabel}
                fill={theme.palette.secondary.main}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  )
}

export default ProductivityChart
