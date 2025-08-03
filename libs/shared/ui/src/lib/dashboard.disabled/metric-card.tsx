'use client'
import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import InfoIcon from '@mui/icons-material/Info'

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  icon?: React.ReactNode
  percentageChange?: number
  loading?: boolean
  tooltip?: string
  color?: string
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  icon,
  percentageChange,
  loading = false,
  tooltip,
  color = '#1976d2',
}) => {
  // Function to determine trend icon and color
  const getTrendDisplay = () => {
    if (percentageChange === undefined) return null

    let trendIcon
    let trendColor

    if (percentageChange > 0) {
      trendIcon = <TrendingUpIcon fontSize="small" />
      trendColor = '#4caf50' // green
    } else if (percentageChange < 0) {
      trendIcon = <TrendingDownIcon fontSize="small" />
      trendColor = '#f44336' // red
    } else {
      trendIcon = <TrendingFlatIcon fontSize="small" />
      trendColor = '#ff9800' // amber
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', color: trendColor }}>
        {trendIcon}
        <Typography variant="body2" component="span" sx={{ ml: 0.5 }}>
          {Math.abs(percentageChange).toFixed(1)}%
        </Typography>
      </Box>
    )
  }

  return (
    <Card sx={{ height: '100%', position: 'relative' }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
          {tooltip && (
            <Tooltip title={tooltip} arrow>
              <InfoIcon
                fontSize="small"
                sx={{ color: 'text.secondary', ml: 1 }}
              />
            </Tooltip>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 1 }}>
          {icon && <Box sx={{ mr: 1, color }}>{icon}</Box>}
          {loading ? (
            <CircularProgress size={24} />
          ) : (
            <Typography
              variant="h5"
              component="div"
              sx={{ fontWeight: 'bold' }}
            >
              {value}
              {unit && (
                <Typography variant="caption" sx={{ ml: 0.5 }}>
                  {unit}
                </Typography>
              )}
            </Typography>
          )}
        </Box>

        {getTrendDisplay()}
      </CardContent>
    </Card>
  )
}

export default MetricCard
