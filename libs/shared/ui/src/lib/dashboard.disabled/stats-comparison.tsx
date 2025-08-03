'use client'
import React from 'react'
import {
  Paper,
  Typography,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Tooltip,
  useTheme,
} from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import RemoveIcon from '@mui/icons-material/Remove'

interface ComparisonItem {
  label: string
  current: number
  previous: number
  unit?: string
  tooltip?: string
  color?: string
  isHigherBetter?: boolean
}

interface StatsComparisonProps {
  title: string
  subtitle?: string
  items: ComparisonItem[]
  previousPeriodLabel: string
}

const StatsComparison: React.FC<StatsComparisonProps> = ({
  title,
  subtitle,
  items,
  previousPeriodLabel,
}) => {
  const theme = useTheme()

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const getChangeColor = (
    current: number,
    previous: number,
    isHigherBetter: boolean = true
  ) => {
    if (current === previous) return theme.palette.text.secondary
    const isHigher = current > previous
    return isHigher === isHigherBetter
      ? theme.palette.success.main
      : theme.palette.error.main
  }

  const getChangeIcon = (current: number, previous: number) => {
    if (current > previous) return <ArrowUpwardIcon fontSize="small" />
    if (current < previous) return <ArrowDownwardIcon fontSize="small" />
    return <RemoveIcon fontSize="small" />
  }

  // Calculate the maximum value for the progress bar
  const maxValue =
    Math.max(...items.flatMap((item) => [item.current, item.previous])) * 1.2

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

      <List sx={{ width: '100%', flexGrow: 1 }}>
        {items.map((item, index) => {
          const percentChange = calculatePercentageChange(
            item.current,
            item.previous
          )
          const changeColor =
            item.color ||
            getChangeColor(item.current, item.previous, item.isHigherBetter)

          return (
            <React.Fragment key={index}>
              {index > 0 && <Divider component="li" />}
              <ListItem
                alignItems="flex-start"
                sx={{ flexDirection: 'column', gap: 1 }}
              >
                <Box
                  sx={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Tooltip title={item.tooltip || ''} arrow placement="top">
                    <Typography variant="subtitle2" component="span">
                      {item.label}
                    </Typography>
                  </Tooltip>

                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        color: changeColor,
                      }}
                    >
                      {getChangeIcon(item.current, item.previous)}
                      {Math.abs(percentChange).toFixed(1)}%
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ width: '100%', mt: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <Typography
                      variant="body1"
                      component="span"
                      sx={{ fontWeight: 'bold', mr: 1 }}
                    >
                      {item.current}
                      {item.unit || ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      vs {item.previous}
                      {item.unit || ''} {previousPeriodLabel}
                    </Typography>
                  </Box>
                  <Box sx={{ width: '100%', display: 'flex' }}>
                    <LinearProgress
                      variant="determinate"
                      value={(item.current / maxValue) * 100}
                      sx={{
                        height: 8,
                        width: '100%',
                        borderRadius: 4,
                        backgroundColor: theme.palette.grey[200],
                        '& .MuiLinearProgress-bar': {
                          backgroundColor:
                            item.color || theme.palette.primary.main,
                        },
                      }}
                    />
                  </Box>
                </Box>
              </ListItem>
            </React.Fragment>
          )
        })}
      </List>
    </Paper>
  )
}

export default StatsComparison
