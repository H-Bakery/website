'use client'
import React, { useState } from 'react'
import {
  Box,
  Container,
  Typography,
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
  Grid,
  Card,
  CardContent,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
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
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Email as EmailIcon,
} from '@mui/icons-material'

// Mock data for reports
const mockReports = [
  {
    id: '1',
    filename: 'umsatzbericht-2025-01-15.pdf',
    type: 'Umsatzbericht',
    format: 'PDF',
    size: 106728,
    createdAt: '2025-01-15T10:00:00Z',
  },
  {
    id: '2',
    filename: 'lagerbestand-2025-01-15.xlsx',
    type: 'Lagerbestand',
    format: 'EXCEL',
    size: 6811,
    createdAt: '2025-01-15T10:05:00Z',
  },
  {
    id: '3',
    filename: 'produktionsbericht-2025-01-14.pdf',
    type: 'Produktion',
    format: 'PDF',
    size: 89234,
    createdAt: '2025-01-14T18:00:00Z',
  },
]

const mockSchedules = [
  {
    id: '1',
    reportType: 'Umsatzbericht',
    format: 'PDF',
    frequency: 'DAILY',
    recipients: ['manager@bakery.de'],
    active: true,
    nextRun: '2025-01-16T06:00:00Z',
  },
  {
    id: '2',
    reportType: 'Lagerbestand',
    format: 'EXCEL',
    frequency: 'WEEKLY',
    recipients: ['lager@bakery.de', 'manager@bakery.de'],
    active: true,
    nextRun: '2025-01-20T06:00:00Z',
  },
  {
    id: '3',
    reportType: 'Monatsbericht',
    format: 'PDF',
    frequency: 'MONTHLY',
    recipients: ['geschaeftsfuehrung@bakery.de'],
    active: false,
    nextRun: null,
  },
]

const storageStats = {
  totalFiles: 23,
  totalSize: 4523987,
  activeSchedules: 2,
}

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

export default function AdminReportsPage() {
  const [tabValue, setTabValue] = useState(0)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null)
  const [editingSchedule, setEditingSchedule] = useState<any>(null)

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
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
        return <PdfIcon sx={{ color: 'error.main' }} />
      case 'EXCEL':
        return <ExcelIcon sx={{ color: 'success.main' }} />
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
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          <DescriptionIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Berichte
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Verwalten Sie generierte Berichte und Zeitpläne
        </Typography>
      </Box>

      {/* Storage Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <StorageIcon color="primary" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Gespeicherte Berichte
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
                    {storageStats.activeSchedules}
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
                startIcon={<DeleteIcon />}
              >
                Speicher bereinigen
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper elevation={2}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Generierte Berichte" />
            <Tab label="Zeitpläne" />
          </Tabs>
        </Box>

        {/* Generated Reports Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">Generierte Berichte</Typography>
            <IconButton>
              <RefreshIcon />
            </IconButton>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Format</TableCell>
                  <TableCell>Typ</TableCell>
                  <TableCell>Dateiname</TableCell>
                  <TableCell>Größe</TableCell>
                  <TableCell>Erstellt am</TableCell>
                  <TableCell align="right">Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mockReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{getFormatIcon(report.format)}</TableCell>
                    <TableCell>{report.type}</TableCell>
                    <TableCell>{report.filename}</TableCell>
                    <TableCell>{formatFileSize(report.size)}</TableCell>
                    <TableCell>{formatDate(report.createdAt)}</TableCell>
                    <TableCell align="right">
                      <IconButton color="primary">
                        <DownloadIcon />
                      </IconButton>
                      <IconButton color="error">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Schedules Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">Berichts-Zeitpläne</Typography>
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
                {mockSchedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>{schedule.reportType}</TableCell>
                    <TableCell>
                      <Chip
                        label={schedule.format}
                        size="small"
                        color={schedule.format === 'PDF' ? 'error' : 'success'}
                      />
                    </TableCell>
                    <TableCell>
                      {getFrequencyLabel(schedule.frequency)}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <EmailIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {schedule.recipients.length}
                        </Typography>
                      </Stack>
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
              </TableBody>
            </Table>
          </TableContainer>
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
            onClick={() => setDeleteDialogOpen(false)}
            color="error"
            variant="contained"
          >
            Löschen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingSchedule ? 'Zeitplan bearbeiten' : 'Neuer Zeitplan'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              select
              label="Berichtstyp"
              fullWidth
              defaultValue={editingSchedule?.reportType || ''}
            >
              <MenuItem value="Umsatzbericht">Umsatzbericht</MenuItem>
              <MenuItem value="Lagerbestand">Lagerbestand</MenuItem>
              <MenuItem value="Produktion">Produktionsbericht</MenuItem>
              <MenuItem value="Monatsbericht">Monatsbericht</MenuItem>
            </TextField>

            <TextField
              select
              label="Format"
              fullWidth
              defaultValue={editingSchedule?.format || 'PDF'}
            >
              <MenuItem value="PDF">PDF</MenuItem>
              <MenuItem value="EXCEL">Excel</MenuItem>
              <MenuItem value="CSV">CSV</MenuItem>
            </TextField>

            <TextField
              select
              label="Frequenz"
              fullWidth
              defaultValue={editingSchedule?.frequency || 'DAILY'}
            >
              <MenuItem value="DAILY">Täglich</MenuItem>
              <MenuItem value="WEEKLY">Wöchentlich</MenuItem>
              <MenuItem value="MONTHLY">Monatlich</MenuItem>
            </TextField>

            <TextField
              label="E-Mail-Empfänger"
              fullWidth
              multiline
              rows={2}
              helperText="Mehrere E-Mail-Adressen durch Komma getrennt"
              defaultValue={editingSchedule?.recipients?.join(', ') || ''}
            />

            <FormControlLabel
              control={
                <Checkbox defaultChecked={editingSchedule?.active || false} />
              }
              label="Zeitplan aktivieren"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={() => setScheduleDialogOpen(false)}
            variant="contained"
          >
            Speichern
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
