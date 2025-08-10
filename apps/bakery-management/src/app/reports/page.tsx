'use client'
import React, { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Card,
  CardContent,
  Grid,
} from '@mui/material'
import {
  Description as DescriptionIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Storage as StorageIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
} from '@mui/icons-material'
import {
  reportingService,
  ReportFormat,
  ReportSchedule,
} from '@bakery/shared/data-access'
import dynamic from 'next/dynamic'

// Lazy load the ScheduleDialog component
const ScheduleDialog = dynamic(
  () =>
    import('./schedule-dialog').then((mod) => ({
      default: mod.ScheduleDialog,
    })),
  {
    loading: () => null, // Dialog doesn't need a loading state
  }
)

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`reports-tabpanel-${index}`}
      aria-labelledby={`reports-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function ReportsPage() {
  const [tabValue, setTabValue] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reports, setReports] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [storageStats, setStorageStats] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<any>(null)

  useEffect(() => {
    if (tabValue === 0) {
      fetchReports()
      fetchStorageStats()
    } else if (tabValue === 1) {
      fetchSchedules()
    }
  }, [tabValue])

  const fetchReports = async () => {
    // TODO: Implement fetching generated reports
    // For now, we'll use mock data
    setReports([
      {
        id: '1',
        filename: 'sales-report-2024-01-01.pdf',
        format: 'PDF',
        size: 106728,
        createdAt: '2024-01-01T10:00:00Z',
        downloadUrl: '/api/reports/download/abc123',
      },
      {
        id: '2',
        filename: 'sales-report-2024-01-01.xlsx',
        format: 'EXCEL',
        size: 6811,
        createdAt: '2024-01-01T10:05:00Z',
        downloadUrl: '/api/reports/download/def456',
      },
    ])
  }

  const fetchSchedules = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await reportingService.getSchedules()
      if (response.success && response.schedules) {
        setSchedules(response.schedules)
      }
    } catch (err) {
      setError('Fehler beim Laden der Zeitpläne')
      console.error('Error fetching schedules:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStorageStats = async () => {
    try {
      const response = await reportingService.getStorageStats()
      if (response.success && response.stats) {
        setStorageStats(response.stats)
      }
    } catch (err) {
      console.error('Error fetching storage stats:', err)
    }
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleDownload = (downloadUrl: string) => {
    reportingService.downloadReport(downloadUrl)
  }

  const handleDeleteSchedule = async () => {
    if (!selectedSchedule) return

    setLoading(true)
    try {
      await reportingService.deleteSchedule(selectedSchedule)
      setSchedules(schedules.filter((s) => s.id !== selectedSchedule))
      setDeleteDialogOpen(false)
      setSelectedSchedule(null)
    } catch (err) {
      setError('Fehler beim Löschen des Zeitplans')
    } finally {
      setLoading(false)
    }
  }

  const handleCleanupStorage = async () => {
    setLoading(true)
    try {
      await reportingService.cleanupStorage()
      fetchReports()
      fetchStorageStats()
    } catch (err) {
      setError('Fehler beim Bereinigen des Speichers')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE')
  }

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'PDF':
        return <DescriptionIcon sx={{ color: 'error.main' }} />
      case 'EXCEL':
        return <DescriptionIcon sx={{ color: 'success.main' }} />
      case 'CSV':
        return <DescriptionIcon sx={{ color: 'info.main' }} />
      default:
        return <DescriptionIcon />
    }
  }

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'DAILY':
        return 'Täglich'
      case 'WEEKLY':
        return 'Wöchentlich'
      case 'MONTHLY':
        return 'Monatlich'
      default:
        return frequency
    }
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          <DescriptionIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Reports
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Verwalten Sie generierte Reports und Zeitpläne
        </Typography>
      </Box>

      {/* Storage Stats */}
      {storageStats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <StorageIcon color="primary" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Gespeicherte Reports
                    </Typography>
                    <Typography variant="h6">
                      {storageStats.totalFiles}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <StorageIcon color="warning" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Speicherplatz
                    </Typography>
                    <Typography variant="h6">
                      {formatFileSize(storageStats.totalSize)}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <ScheduleIcon color="info" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Aktive Zeitpläne
                    </Typography>
                    <Typography variant="h6">
                      {schedules.filter((s) => s.active).length}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Button
                  variant="outlined"
                  color="warning"
                  fullWidth
                  onClick={handleCleanupStorage}
                  disabled={loading}
                  startIcon={<DeleteIcon />}
                >
                  Speicher bereinigen
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper elevation={3}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Generierte Reports" />
            <Tab label="Zeitpläne" />
          </Tabs>
        </Box>

        {/* Generated Reports Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">Generierte Reports</Typography>
            <IconButton onClick={fetchReports} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Format</TableCell>
                    <TableCell>Dateiname</TableCell>
                    <TableCell>Größe</TableCell>
                    <TableCell>Erstellt am</TableCell>
                    <TableCell align="right">Aktionen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>{getFormatIcon(report.format)}</TableCell>
                      <TableCell>{report.filename}</TableCell>
                      <TableCell>{formatFileSize(report.size)}</TableCell>
                      <TableCell>{formatDate(report.createdAt)}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          color="primary"
                          onClick={() => handleDownload(report.downloadUrl)}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {reports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          Keine Reports gefunden
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Schedules Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">Report-Zeitpläne</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingSchedule(null)
                setScheduleDialogOpen(true)
              }}
            >
              Neuer Zeitplan
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Typ</TableCell>
                    <TableCell>Format</TableCell>
                    <TableCell>Frequenz</TableCell>
                    <TableCell>Empfänger</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Nächste Ausführung</TableCell>
                    <TableCell align="right">Aktionen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell>{schedule.reportType}</TableCell>
                      <TableCell>
                        <Chip
                          label={schedule.format}
                          size="small"
                          color={
                            schedule.format === 'PDF'
                              ? 'error'
                              : schedule.format === 'EXCEL'
                              ? 'success'
                              : 'info'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {getFrequencyLabel(schedule.frequency)}
                      </TableCell>
                      <TableCell>
                        {schedule.recipients.length > 0
                          ? schedule.recipients.join(', ')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={schedule.active ? 'Aktiv' : 'Inaktiv'}
                          color={schedule.active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {schedule.nextRun ? formatDate(schedule.nextRun) : '-'}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          color="primary"
                          onClick={() => {
                            setEditingSchedule(schedule)
                            setScheduleDialogOpen(true)
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => {
                            setSelectedSchedule(schedule.id)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {schedules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          Keine Zeitpläne konfiguriert
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Zeitplan löschen?</DialogTitle>
        <DialogContent>
          <Typography>
            Sind Sie sicher, dass Sie diesen Zeitplan löschen möchten? Diese
            Aktion kann nicht rückgängig gemacht werden.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Abbrechen</Button>
          <Button
            onClick={handleDeleteSchedule}
            color="error"
            variant="contained"
            disabled={loading}
          >
            Löschen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={scheduleDialogOpen}
        onClose={() => {
          setScheduleDialogOpen(false)
          setEditingSchedule(null)
        }}
        onSave={() => {
          setScheduleDialogOpen(false)
          setEditingSchedule(null)
          fetchSchedules()
        }}
        schedule={editingSchedule}
      />
    </Container>
  )
}
