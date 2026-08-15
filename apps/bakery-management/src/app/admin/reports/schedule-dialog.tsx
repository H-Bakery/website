'use client'
import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Chip,
  Stack,
  Alert,
  FormControlLabel,
  Switch,
  Typography,
  IconButton,
} from '@mui/material'
import { Close as CloseIcon, Add as AddIcon } from '@mui/icons-material'
import {
  reportingService,
  ReportFormat,
  ReportSchedule,
  ReportType,
} from '@bakery/shared/data-access'

interface ScheduleDialogProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  schedule?: ReportSchedule | null
}

export function ScheduleDialog({
  open,
  onClose,
  onSave,
  schedule,
}: ScheduleDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    reportType: 'SALES',
    format: 'PDF',
    frequency: 'DAILY',
    recipients: [] as string[],
    active: true,
    time: '08:00',
    dayOfWeek: 1,
    dayOfMonth: 1,
  })
  const [emailInput, setEmailInput] = useState('')

  useEffect(() => {
    if (schedule) {
      setFormData({
        reportType: schedule.reportType || 'SALES',
        format: schedule.format || 'PDF',
        frequency: schedule.frequency || 'DAILY',
        recipients: schedule.recipients || [],
        active: schedule.active !== false,
        time: schedule.timeOfDay || '08:00',
        dayOfWeek: schedule.dayOfWeek ?? 1,
        dayOfMonth: schedule.dayOfMonth || 1,
      })
    } else {
      // Reset form for new schedule
      setFormData({
        reportType: 'SALES',
        format: 'PDF',
        frequency: 'DAILY',
        recipients: [],
        active: true,
        time: '08:00',
        dayOfWeek: 1,
        dayOfMonth: 1,
      })
    }
  }, [schedule, open])

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const scheduleData: ReportSchedule = {
        reportType: formData.reportType as ReportType,
        format: formData.format as ReportFormat,
        frequency: formData.frequency as ReportSchedule['frequency'],
        recipients: formData.recipients,
        active: formData.active,
        timeOfDay: formData.time,
        dayOfWeek:
          formData.frequency === 'WEEKLY' ? formData.dayOfWeek : undefined,
        dayOfMonth:
          formData.frequency === 'MONTHLY' ? formData.dayOfMonth : undefined,
      }

      if (schedule?.id) {
        await reportingService.updateSchedule(schedule.id, scheduleData)
      } else {
        await reportingService.createSchedule(scheduleData)
      }

      onSave()
      onClose()
    } catch (err) {
      setError('Fehler beim Speichern des Zeitplans')
      console.error('Error saving schedule:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddEmail = () => {
    const trimmedEmail = emailInput.trim()
    if (trimmedEmail && !formData.recipients.includes(trimmedEmail)) {
      setFormData({
        ...formData,
        recipients: [...formData.recipients, trimmedEmail],
      })
      setEmailInput('')
    }
  }

  const handleRemoveEmail = (email: string) => {
    setFormData({
      ...formData,
      recipients: formData.recipients.filter((r) => r !== email),
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddEmail()
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {schedule ? 'Zeitplan bearbeiten' : 'Neuer Report-Zeitplan'}
        <IconButton
          aria-label="Schließen"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stack spacing={3}>
          {/* Report Type */}
          <FormControl fullWidth>
            <InputLabel>Report-Typ</InputLabel>
            <Select
              value={formData.reportType}
              label="Report-Typ"
              onChange={(e) =>
                setFormData({ ...formData, reportType: e.target.value })
              }
            >
              <MenuItem value="SALES">Verkaufsbericht</MenuItem>
              <MenuItem value="INVENTORY">Inventarbericht</MenuItem>
              <MenuItem value="PRODUCTION">Produktionsbericht</MenuItem>
              <MenuItem value="DELIVERY">Lieferbericht</MenuItem>
            </Select>
          </FormControl>

          {/* Format */}
          <FormControl fullWidth>
            <InputLabel>Format</InputLabel>
            <Select
              value={formData.format}
              label="Format"
              onChange={(e) =>
                setFormData({ ...formData, format: e.target.value })
              }
            >
              <MenuItem value="PDF">PDF (mit Diagrammen)</MenuItem>
              <MenuItem value="EXCEL">Excel</MenuItem>
              <MenuItem value="CSV">CSV</MenuItem>
            </Select>
          </FormControl>

          {/* Frequency */}
          <FormControl fullWidth>
            <InputLabel>Frequenz</InputLabel>
            <Select
              value={formData.frequency}
              label="Frequenz"
              onChange={(e) =>
                setFormData({ ...formData, frequency: e.target.value })
              }
            >
              <MenuItem value="DAILY">Täglich</MenuItem>
              <MenuItem value="WEEKLY">Wöchentlich</MenuItem>
              <MenuItem value="MONTHLY">Monatlich</MenuItem>
            </Select>
          </FormControl>

          {/* Time */}
          <TextField
            fullWidth
            label="Uhrzeit"
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            InputLabelProps={{
              shrink: true,
            }}
          />

          {/* Day of Week (for weekly) */}
          {formData.frequency === 'WEEKLY' && (
            <FormControl fullWidth>
              <InputLabel>Wochentag</InputLabel>
              <Select
                value={formData.dayOfWeek}
                label="Wochentag"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dayOfWeek: Number(e.target.value),
                  })
                }
              >
                <MenuItem value={1}>Montag</MenuItem>
                <MenuItem value={2}>Dienstag</MenuItem>
                <MenuItem value={3}>Mittwoch</MenuItem>
                <MenuItem value={4}>Donnerstag</MenuItem>
                <MenuItem value={5}>Freitag</MenuItem>
                <MenuItem value={6}>Samstag</MenuItem>
                <MenuItem value={0}>Sonntag</MenuItem>
              </Select>
            </FormControl>
          )}

          {/* Day of Month (for monthly) */}
          {formData.frequency === 'MONTHLY' && (
            <TextField
              fullWidth
              label="Tag des Monats"
              type="number"
              value={formData.dayOfMonth}
              onChange={(e) =>
                setFormData({ ...formData, dayOfMonth: Number(e.target.value) })
              }
              inputProps={{ min: 1, max: 31 }}
            />
          )}

          {/* Recipients */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              E-Mail-Empfänger
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="E-Mail-Adresse eingeben"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={handleKeyPress}
              />
              <IconButton
                color="primary"
                onClick={handleAddEmail}
                disabled={!emailInput.trim()}
              >
                <AddIcon />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {formData.recipients.map((email) => (
                <Chip
                  key={email}
                  label={email}
                  onDelete={() => handleRemoveEmail(email)}
                  size="small"
                />
              ))}
              {formData.recipients.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Keine Empfänger hinzugefügt
                </Typography>
              )}
            </Box>
          </Box>

          {/* Active Status */}
          <FormControlLabel
            control={
              <Switch
                checked={formData.active}
                onChange={(e) =>
                  setFormData({ ...formData, active: e.target.checked })
                }
              />
            }
            label="Zeitplan aktiv"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {schedule ? 'Speichern' : 'Erstellen'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
