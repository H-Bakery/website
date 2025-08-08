'use client'
import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Alert,
  Divider,
  Stack,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
} from '@mui/material'
import {
  Schedule as ScheduleIcon,
  Settings as SettingsIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Update as TriggerIcon,
  Delete as CleanupIcon,
  Info as InfoIcon,
  CheckCircle as RunningIcon,
  Cancel as StoppedIcon,
  Archive as ArchiveIcon,
  DeleteForever as DeleteIcon,
  Timer as TimerIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { formatDistanceToNow, format } from 'date-fns'
import { de } from 'date-fns/locale'
import bakeryAPI from '../../../../services/bakeryAPI'

interface ArchivalPolicies {
  autoArchiveAfterDays: number
  permanentDeleteAfterDays: number
  archiveReadOnly: boolean
  excludeCategories: string[]
  excludePriorities: string[]
  batchSize: number
  enabled: boolean
}

interface ArchivalStatus {
  isRunning: boolean
  scheduledTasks: string[]
  policies: ArchivalPolicies
}

interface ArchivalStats {
  total: number
  archived: number
  deleted: number
  eligibleForArchival: number
  eligibleForCleanup: number
  policies: ArchivalPolicies
  isRunning: boolean
}

const NotificationArchivalPage: React.FC = () => {
  const [policies, setPolicies] = useState<ArchivalPolicies | null>(null)
  const [status, setStatus] = useState<ArchivalStatus | null>(null)
  const [stats, setStats] = useState<ArchivalStats | null>(null)
  const [nextRuns, setNextRuns] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    action: () => void
  }>({ open: false, title: '', message: '', action: () => {} })

  // Form state
  const [formData, setFormData] = useState<Partial<ArchivalPolicies>>({})

  const loadData = async () => {
    try {
      setLoading(true)
      const [policiesRes, statusRes, nextRunsRes] = await Promise.all([
        bakeryAPI.getArchivalPolicies(),
        bakeryAPI.getArchivalStatus(),
        bakeryAPI.getNextArchivalRuns(),
      ])

      setPolicies(policiesRes.policies)
      setStatus(statusRes.status)
      setStats(statusRes.stats)
      setNextRuns(nextRunsRes.nextRuns)
      setFormData(policiesRes.policies)
    } catch (error: any) {
      setErrorMessage(
        error.message || 'Fehler beim Laden der Archivierungs-Einstellungen'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Auto-dismiss messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [errorMessage])

  const handleSavePolicies = async () => {
    try {
      setSaving(true)
      await bakeryAPI.updateArchivalPolicies(formData)
      setSuccessMessage('Archivierungs-Richtlinien erfolgreich aktualisiert')
      await loadData()
    } catch (error: any) {
      setErrorMessage(error.message || 'Fehler beim Speichern der Richtlinien')
    } finally {
      setSaving(false)
    }
  }

  const handleStartService = async () => {
    try {
      await bakeryAPI.startArchivalService()
      setSuccessMessage('Archivierungs-Service gestartet')
      await loadData()
    } catch (error: any) {
      setErrorMessage(error.message || 'Fehler beim Starten des Services')
    }
  }

  const handleStopService = async () => {
    try {
      await bakeryAPI.stopArchivalService()
      setSuccessMessage('Archivierungs-Service gestoppt')
      await loadData()
    } catch (error: any) {
      setErrorMessage(error.message || 'Fehler beim Stoppen des Services')
    }
  }

  const handleTriggerArchival = async () => {
    try {
      const result = await bakeryAPI.triggerArchival()
      setSuccessMessage(
        result.result.skipped
          ? 'Archivierung ist deaktiviert'
          : `${result.result.archived} Benachrichtigungen archiviert`
      )
      await loadData()
    } catch (error: any) {
      setErrorMessage(error.message || 'Fehler beim Ausführen der Archivierung')
    }
  }

  const handleTriggerCleanup = async () => {
    try {
      const result = await bakeryAPI.triggerCleanup()
      setSuccessMessage(
        result.result.skipped
          ? 'Bereinigung ist deaktiviert'
          : `${result.result.deleted} Benachrichtigungen gelöscht`
      )
      await loadData()
    } catch (error: any) {
      setErrorMessage(error.message || 'Fehler beim Ausführen der Bereinigung')
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      staff: 'Personal',
      order: 'Bestellung',
      system: 'System',
      inventory: 'Lager',
      general: 'Allgemein',
    }
    return labels[category] || category
  }

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      low: 'Niedrig',
      medium: 'Mittel',
      high: 'Hoch',
      urgent: 'Dringend',
    }
    return labels[priority] || priority
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Automatische Archivierung
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Verwalten Sie die automatische Archivierung und Bereinigung von
        Benachrichtigungen
      </Typography>

      {/* Messages */}
      {successMessage && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => setErrorMessage(null)}
        >
          {errorMessage}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Service Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ mb: 2 }}
              >
                {status?.isRunning ? (
                  <RunningIcon color="success" />
                ) : (
                  <StoppedIcon color="error" />
                )}
                <Typography variant="h6">Service Status</Typography>
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {status?.isRunning ? 'Läuft' : 'Gestoppt'}
              </Typography>

              {status?.scheduledTasks && status.scheduledTasks.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Geplante Aufgaben:
                  </Typography>
                  {status.scheduledTasks.map((task) => (
                    <Chip key={task} label={task} size="small" sx={{ mr: 1 }} />
                  ))}
                </Box>
              )}

              <Stack direction="row" spacing={1}>
                {status?.isRunning ? (
                  <Button
                    variant="outlined"
                    startIcon={<StopIcon />}
                    onClick={() =>
                      setConfirmDialog({
                        open: true,
                        title: 'Service stoppen',
                        message:
                          'Möchten Sie den Archivierungs-Service wirklich stoppen?',
                        action: handleStopService,
                      })
                    }
                    color="error"
                  >
                    Stoppen
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    startIcon={<StartIcon />}
                    onClick={handleStartService}
                    disabled={!policies?.enabled}
                  >
                    Starten
                  </Button>
                )}
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadData}
                >
                  Aktualisieren
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Statistics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Statistiken
              </Typography>

              {stats && (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="primary">
                        {stats.total}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Aktive Benachrichtigungen
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="secondary">
                        {stats.archived}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Archiviert
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="warning.main">
                        {stats.eligibleForArchival}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Bereit für Archivierung
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="error">
                        {stats.eligibleForCleanup}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Bereit für Löschung
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Next Scheduled Runs */}
        {nextRuns && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Nächste geplante Ausführungen
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ArchiveIcon color="primary" />
                      <Box>
                        <Typography variant="body2">
                          Nächste Archivierung
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(
                            new Date(nextRuns.archival),
                            'dd.MM.yyyy HH:mm'
                          )}{' '}
                          (
                          {formatDistanceToNow(new Date(nextRuns.archival), {
                            addSuffix: true,
                            locale: de,
                          })}
                          )
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <DeleteIcon color="secondary" />
                      <Box>
                        <Typography variant="body2">
                          Nächste Bereinigung
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(
                            new Date(nextRuns.cleanup),
                            'dd.MM.yyyy HH:mm'
                          )}{' '}
                          (
                          {formatDistanceToNow(new Date(nextRuns.cleanup), {
                            addSuffix: true,
                            locale: de,
                          })}
                          )
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Manual Actions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Manuelle Aktionen
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<TriggerIcon />}
                  onClick={() =>
                    setConfirmDialog({
                      open: true,
                      title: 'Archivierung ausführen',
                      message:
                        'Möchten Sie die Archivierung jetzt manuell ausführen?',
                      action: handleTriggerArchival,
                    })
                  }
                  disabled={!policies?.enabled}
                >
                  Archivierung ausführen
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CleanupIcon />}
                  onClick={() =>
                    setConfirmDialog({
                      open: true,
                      title: 'Bereinigung ausführen',
                      message:
                        'Möchten Sie die Bereinigung jetzt manuell ausführen? Diese Aktion kann nicht rückgängig gemacht werden.',
                      action: handleTriggerCleanup,
                    })
                  }
                  color="error"
                  disabled={!policies?.enabled}
                >
                  Bereinigung ausführen
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Policies Configuration */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Archivierungs-Richtlinien
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.enabled || false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          enabled: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="Automatische Archivierung aktivieren"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Archivierung nach (Tage)"
                  type="number"
                  value={formData.autoArchiveAfterDays || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      autoArchiveAfterDays: parseInt(e.target.value) || 0,
                    }))
                  }
                  helperText="Benachrichtigungen älter als diese Anzahl Tage werden archiviert"
                  inputProps={{ min: 1, max: 365 }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Endgültige Löschung nach (Tage)"
                  type="number"
                  value={formData.permanentDeleteAfterDays || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      permanentDeleteAfterDays: parseInt(e.target.value) || 0,
                    }))
                  }
                  helperText="Archivierte Benachrichtigungen werden nach dieser Zeit gelöscht"
                  inputProps={{ min: 1, max: 3650 }}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.archiveReadOnly || false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          archiveReadOnly: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="Nur gelesene Benachrichtigungen archivieren"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Ausgeschlossene Kategorien</InputLabel>
                  <Select
                    multiple
                    value={formData.excludeCategories || []}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        excludeCategories: e.target.value as string[],
                      }))
                    }
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip
                            key={value}
                            label={getCategoryLabel(value)}
                            size="small"
                          />
                        ))}
                      </Box>
                    )}
                  >
                    {['staff', 'order', 'system', 'inventory', 'general'].map(
                      (category) => (
                        <MenuItem key={category} value={category}>
                          {getCategoryLabel(category)}
                        </MenuItem>
                      )
                    )}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Ausgeschlossene Prioritäten</InputLabel>
                  <Select
                    multiple
                    value={formData.excludePriorities || []}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        excludePriorities: e.target.value as string[],
                      }))
                    }
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip
                            key={value}
                            label={getPriorityLabel(value)}
                            size="small"
                          />
                        ))}
                      </Box>
                    )}
                  >
                    {['low', 'medium', 'high', 'urgent'].map((priority) => (
                      <MenuItem key={priority} value={priority}>
                        {getPriorityLabel(priority)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Batch-Größe"
                  type="number"
                  value={formData.batchSize || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      batchSize: parseInt(e.target.value) || 0,
                    }))
                  }
                  helperText="Anzahl der Benachrichtigungen pro Verarbeitungsdurchgang"
                  inputProps={{ min: 10, max: 1000 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  startIcon={<SettingsIcon />}
                  onClick={handleSavePolicies}
                  disabled={saving}
                >
                  {saving ? 'Speichern...' : 'Richtlinien speichern'}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmDialog.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setConfirmDialog((prev) => ({ ...prev, open: false }))
            }
          >
            Abbrechen
          </Button>
          <Button
            onClick={() => {
              confirmDialog.action()
              setConfirmDialog((prev) => ({ ...prev, open: false }))
            }}
            color="primary"
            variant="contained"
          >
            Bestätigen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default NotificationArchivalPage
