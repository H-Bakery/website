'use client'
import React from 'react'
import { Box, ToggleButtonGroup, ToggleButton, Typography } from '@mui/material'

export type TimeRange = 'day' | 'week' | 'month' | 'year'

interface DateRangeSelectorProps {
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  timeRange,
  onTimeRangeChange,
}) => {
  const handleTimeRangeChange = (
    event: React.MouseEvent<HTMLElement>,
    newTimeRange: TimeRange | null
  ) => {
    if (newTimeRange !== null) {
      onTimeRangeChange(newTimeRange)
    }
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" gutterBottom>
        Select Time Period:
      </Typography>
      <ToggleButtonGroup
        value={timeRange}
        exclusive
        onChange={handleTimeRangeChange}
        aria-label="time range"
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            textTransform: 'none',
            px: 2,
          },
        }}
      >
        <ToggleButton value="day" aria-label="today">
          Today
        </ToggleButton>
        <ToggleButton value="week" aria-label="this week">
          This Week
        </ToggleButton>
        <ToggleButton value="month" aria-label="this month">
          This Month
        </ToggleButton>
        <ToggleButton value="year" aria-label="this year">
          This Year
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  )
}

export default DateRangeSelector
