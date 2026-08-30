'use client'
import React from 'react'
import {
  Box,
  IconButton,
  Typography,
  TextField,
  Paper,
  Chip,
  Tooltip,
} from '@mui/material'
import {
  ChevronLeft,
  ChevronRight,
  Today,
  CalendarMonth,
} from '@mui/icons-material'

interface DateNavigatorProps {
  selectedDate: string
  onDateChange: (date: string) => void
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  selectedDate,
  onDateChange,
}) => {
  const currentDate = new Date(selectedDate)
  const today = new Date()
  const todayString = today.toISOString().split('T')[0]
  const isToday = selectedDate === todayString

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  const goToPreviousDay = () => {
    const prevDay = new Date(currentDate)
    prevDay.setDate(prevDay.getDate() - 1)
    onDateChange(prevDay.toISOString().split('T')[0])
  }

  const goToNextDay = () => {
    const nextDay = new Date(currentDate)
    nextDay.setDate(nextDay.getDate() + 1)
    onDateChange(nextDay.toISOString().split('T')[0])
  }

  const goToToday = () => {
    onDateChange(todayString)
  }

  const handleDateInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newDate = event.target.value
    if (newDate) {
      onDateChange(newDate)
    }
  }

  const getDateChipColor = () => {
    if (isToday) return 'primary'
    if (currentDate > today) return 'warning'
    return 'default'
  }

  const getDateChipLabel = () => {
    if (isToday) return 'Heute'
    if (currentDate > today) return 'Zukunft'

    const daysDiff = Math.floor(
      (today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysDiff === 1) return 'Gestern'
    if (daysDiff <= 7) return `Vor ${daysDiff} Tagen`
    return 'Vergangen'
  }

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        {/* Date Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Vorheriger Tag">
            <IconButton onClick={goToPreviousDay} color="primary">
              <ChevronLeft />
            </IconButton>
          </Tooltip>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              minWidth: 300,
            }}
          >
            <CalendarMonth color="primary" />
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                {formatDisplayDate(currentDate)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <Chip
                  label={getDateChipLabel()}
                  color={getDateChipColor()}
                  size="small"
                  variant={isToday ? 'filled' : 'outlined'}
                />
                {currentDate > today && (
                  <Chip
                    label="Vorausplanung"
                    color="info"
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>
          </Box>

          <Tooltip title="Nächster Tag">
            <IconButton onClick={goToNextDay} color="primary">
              <ChevronRight />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Quick Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {!isToday && (
            <Tooltip title="Zu heute springen">
              <IconButton
                onClick={goToToday}
                color="primary"
                sx={{
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                }}
              >
                <Today />
              </IconButton>
            </Tooltip>
          )}

          {/* Date Picker */}
          <TextField
            type="date"
            value={selectedDate}
            onChange={handleDateInputChange}
            size="small"
            InputLabelProps={{
              shrink: true,
            }}
            sx={{ width: 150 }}
          />
        </Box>
      </Box>
    </Paper>
  )
}

export default DateNavigator
