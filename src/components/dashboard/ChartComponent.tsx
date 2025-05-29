'use client'
import React from 'react'
import { Box, Paper, Typography, useTheme } from '@mui/material'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type ChartType = 'line' | 'bar' | 'pie' | 'area'

interface ChartComponentProps {
  title: string
  subtitle?: string
  type: ChartType
  data: any[]
  dataKeys: {
    x: string
    y: string | string[]
    colors?: string[]
    stacked?: boolean
  }
  height?: number
}

const ChartComponent: React.FC<ChartComponentProps> = ({
  title,
  subtitle,
  type,
  data,
  dataKeys,
  height = 300,
}) => {
  const theme = useTheme()
  const defaultColors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#ff8042',
  ]

  const colors = dataKeys.colors || defaultColors

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={dataKeys.x} />
              <YAxis />
              <Tooltip />
              <Legend />
              {Array.isArray(dataKeys.y) ? (
                dataKeys.y.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[index % colors.length]}
                    activeDot={{ r: 8 }}
                  />
                ))
              ) : (
                <Line
                  type="monotone"
                  dataKey={dataKeys.y}
                  stroke={colors[0]}
                  activeDot={{ r: 8 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={dataKeys.x} />
              <YAxis />
              <Tooltip />
              <Legend />
              {Array.isArray(dataKeys.y) ? (
                dataKeys.y.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={colors[index % colors.length]}
                    stackId={dataKeys.stacked ? '1' : undefined}
                  />
                ))
              ) : (
                <Bar dataKey={dataKeys.y} fill={colors[0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        )

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey={Array.isArray(dataKeys.y) ? dataKeys.y[0] : dataKeys.y}
                nameKey={dataKeys.x}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={dataKeys.x} />
              <YAxis />
              <Tooltip />
              <Legend />
              {Array.isArray(dataKeys.y) ? (
                dataKeys.y.map((key, index) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stackId={dataKeys.stacked ? '1' : undefined}
                    stroke={colors[index % colors.length]}
                    fill={colors[index % colors.length]}
                    fillOpacity={0.6}
                  />
                ))
              ) : (
                <Area
                  type="monotone"
                  dataKey={dataKeys.y}
                  stroke={colors[0]}
                  fill={colors[0]}
                  fillOpacity={0.6}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )

      default:
        return <Typography color="error">Invalid chart type</Typography>
    }
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
      <Box sx={{ flexGrow: 1, width: '100%' }}>{renderChart()}</Box>
    </Paper>
  )
}

export default ChartComponent
