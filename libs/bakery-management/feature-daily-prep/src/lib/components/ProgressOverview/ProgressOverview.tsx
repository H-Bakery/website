'use client'
import React from 'react'
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  LinearProgress,
  Grid,
  TextField,
  Alert,
  Button,
} from '@mui/material'
import { Refresh } from '@mui/icons-material'
import { PrepSection } from '../../types/prepTask'

interface ProgressOverviewProps {
  prepSections: PrepSection[]
  selectedDate: Date
  isGenerating: boolean
  onDateChange: (date: Date) => void
  onRefresh: () => void
}

const ProgressOverview: React.FC<ProgressOverviewProps> = ({
  prepSections,
  selectedDate,
  isGenerating,
  onDateChange,
  onRefresh,
}) => {
  const calculateProgress = (): number => {
    if (prepSections.length === 0) return 0
    const completedSections = prepSections.filter(
      (section) => section.completed
    ).length
    return (completedSections / prepSections.length) * 100
  }

  const handleDateChange = (dateString: string) => {
    onDateChange(new Date(dateString))
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate)
    const offset = direction === 'prev' ? -1 : 1
    newDate.setDate(newDate.getDate() + offset)
    onDateChange(newDate)
  }

  const progressValue = calculateProgress()

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h6">Fortschritt Übersicht</Typography>
          <Chip
            label={`${Math.round(progressValue)}% Abgeschlossen`}
            color={progressValue === 100 ? 'success' : 'primary'}
            variant={progressValue === 100 ? 'filled' : 'outlined'}
          />
        </Box>

        <LinearProgress
          variant="determinate"
          value={progressValue}
          sx={{ height: 8, borderRadius: 4, mb: 2 }}
        />

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              label="Vorbereitungsdatum"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => handleDateChange(e.target.value)}
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Alert severity="info">Vorbereitung läuft - noch 45 Minuten</Alert>
          </Grid>
          <Grid item xs={12} md={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Refresh />}
              onClick={onRefresh}
              disabled={isGenerating}
            >
              Neue Liste generieren
            </Button>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigateDate('prev')}
              >
                ← Vorheriger Tag
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigateDate('next')}
              >
                Nächster Tag →
              </Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

export default ProgressOverview
