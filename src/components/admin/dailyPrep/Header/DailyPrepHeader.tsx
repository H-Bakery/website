'use client'
import React from 'react'
import { Box, Typography, Button, Chip } from '@mui/material'
import { Assignment, Settings, Refresh, Print, Save } from '@mui/icons-material'

interface DailyPrepHeaderProps {
  selectedDate: Date
  isFromSpecificFile: boolean
  editMode: boolean
  isGenerating: boolean
  onToggleEditMode: () => void
  onRefresh: () => void
  onPrintProductionPlan: () => void
  onPrintBakersPlan: () => void
  onSave: () => void
}

const DailyPrepHeader: React.FC<DailyPrepHeaderProps> = ({
  selectedDate,
  isFromSpecificFile,
  editMode,
  isGenerating,
  onToggleEditMode,
  onRefresh,
  onPrintProductionPlan,
  onPrintBakersPlan,
  onSave,
}) => {
  const formatDateForProduction = () => {
    const tomorrow = new Date(selectedDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 2,
      }}
    >
      <Box>
        <Typography
          variant="h4"
          component="h1"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Assignment sx={{ mr: 2, color: 'primary.main' }} />
          Tägliche Vorbereitungsaufgaben
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box>
            <Typography variant="subtitle1" color="text.secondary">
              Vorbereitung am{' '}
              {selectedDate.toLocaleDateString('de-DE', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Typography>
            <Typography
              variant="body2"
              color="primary.main"
              sx={{ fontWeight: 600 }}
            >
              → für Produktion am {formatDateForProduction()}
            </Typography>
          </Box>
          {isFromSpecificFile ? (
            <Chip
              size="small"
              label="Spezielle Datei"
              color="primary"
              variant="outlined"
            />
          ) : (
            <Chip
              size="small"
              label="Generiert"
              color="default"
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant={editMode ? 'contained' : 'outlined'}
          onClick={onToggleEditMode}
          startIcon={<Settings />}
        >
          {editMode ? 'Bearbeitung beenden' : 'Mengen bearbeiten'}
        </Button>
        <Button
          variant="outlined"
          onClick={onRefresh}
          disabled={isGenerating}
          startIcon={<Refresh />}
        >
          {isGenerating ? 'Generiert...' : 'Aktualisieren'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<Print />}
          onClick={onPrintProductionPlan}
        >
          Produktionsplan
        </Button>
        <Button
          variant="outlined"
          startIcon={<Print />}
          onClick={onPrintBakersPlan}
        >
          Backplan
        </Button>
        <Button variant="contained" startIcon={<Save />} onClick={onSave}>
          Speichern
        </Button>
      </Box>
    </Box>
  )
}

export default DailyPrepHeader
