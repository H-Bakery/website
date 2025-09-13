'use client'

// Production Schedule Board - Main calendar view for production planning
// Provides drag & drop scheduling with timeline visualization

import React, { useState, useMemo, useCallback } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Button,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Divider,
  LinearProgress,
  Alert,
} from '@mui/material'
import {
  PlayArrow,
  Pause,
  Stop,
  MoreVert,
  Add,
  Edit,
  Delete,
  Warning,
  CheckCircle,
  Schedule,
  Group,
  Build,
} from '@mui/icons-material'
import {
  format,
  parseISO,
  addHours,
  differenceInMinutes,
  startOfDay,
  endOfDay,
} from 'date-fns'
import { de } from 'date-fns/locale'
import {
  useProductionSchedules,
  useProductionBatches,
  useCreateBatch,
  useUpdateBatch,
  useStartBatch,
  usePauseBatch,
  useResumeBatch,
  useDeleteBatch,
} from '../hooks/use-production'
import {
  ProductionSchedule,
  ProductionBatch,
  ScheduleViewMode,
} from '../../types/production'

interface ProductionScheduleBoardProps {
  selectedDate: Date
  viewMode: ScheduleViewMode
  onDateChange: (date: Date) => void
  onViewModeChange: (mode: ScheduleViewMode) => void
}

export const ProductionScheduleBoard: React.FC<
  ProductionScheduleBoardProps
> = ({ selectedDate, viewMode, onDateChange, onViewModeChange }) => {
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(
    null
  )
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newBatchData, setNewBatchData] = useState({
    name: '',
    workflowId: '',
    productId: 1,
    quantity: 1,
    priority: 'medium' as const,
    plannedStartTime: '',
    notes: '',
  })

  // Fetch schedules for selected date range
  const {
    data: schedulesData,
    isLoading: schedulesLoading,
    error: schedulesError,
  } = useProductionSchedules({
    startDate: format(startOfDay(selectedDate), 'yyyy-MM-dd'),
    endDate: format(endOfDay(selectedDate), 'yyyy-MM-dd'),
    includeMetrics: true,
  })

  // Fetch batches for the selected date
  const {
    data: batchesData,
    isLoading: batchesLoading,
    error: batchesError,
    refetch: refetchBatches,
  } = useProductionBatches({
    startDate: format(startOfDay(selectedDate), 'yyyy-MM-dd'),
    endDate: format(endOfDay(selectedDate), 'yyyy-MM-dd'),
  })

  // Mutations
  const createBatchMutation = useCreateBatch()
  const updateBatchMutation = useUpdateBatch()
  const startBatchMutation = useStartBatch()
  const pauseBatchMutation = usePauseBatch()
  const resumeBatchMutation = useResumeBatch()
  const deleteBatchMutation = useDeleteBatch()

  const schedules = schedulesData?.items || []
  const batches = batchesData?.items || []

  // Get schedule for selected date
  const currentSchedule = useMemo(() => {
    return schedules.find(
      (schedule) =>
        format(parseISO(schedule.scheduleDate), 'yyyy-MM-dd') ===
        format(selectedDate, 'yyyy-MM-dd')
    )
  }, [schedules, selectedDate])

  // Timeline configuration
  const timelineHours = useMemo(() => {
    if (!currentSchedule) return []

    const startTime = parseISO(
      `${currentSchedule.scheduleDate}T${currentSchedule.workdayStartTime}`
    )
    const endTime = parseISO(
      `${currentSchedule.scheduleDate}T${currentSchedule.workdayEndTime}`
    )

    const hours = []
    let currentHour = startTime

    while (currentHour <= endTime) {
      hours.push(currentHour)
      currentHour = addHours(currentHour, 1)
    }

    return hours
  }, [currentSchedule])

  // Calculate batch positioning for timeline
  const getBatchPosition = useCallback(
    (batch: ProductionBatch) => {
      if (!currentSchedule) return { left: 0, width: 0 }

      const scheduleStart = parseISO(
        `${currentSchedule.scheduleDate}T${currentSchedule.workdayStartTime}`
      )
      const scheduleEnd = parseISO(
        `${currentSchedule.scheduleDate}T${currentSchedule.workdayEndTime}`
      )
      const batchStart = parseISO(batch.plannedStartTime)
      const batchEnd = parseISO(batch.plannedEndTime)

      const totalMinutes = differenceInMinutes(scheduleEnd, scheduleStart)
      const startOffset = differenceInMinutes(batchStart, scheduleStart)
      const duration = differenceInMinutes(batchEnd, batchStart)

      return {
        left: Math.max(0, (startOffset / totalMinutes) * 100),
        width: Math.min(100, (duration / totalMinutes) * 100),
      }
    },
    [currentSchedule]
  )

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'in_progress':
        return 'primary'
      case 'failed':
        return 'error'
      case 'cancelled':
        return 'default'
      case 'waiting':
        return 'warning'
      default:
        return 'info'
    }
  }

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'error'
      case 'high':
        return 'warning'
      case 'medium':
        return 'info'
      case 'low':
        return 'default'
      default:
        return 'default'
    }
  }

  // Handle batch actions
  const handleMenuClick = (
    event: React.MouseEvent<HTMLElement>,
    batch: ProductionBatch
  ) => {
    setSelectedBatch(batch)
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedBatch(null)
  }

  const handleStartBatch = async () => {
    if (!selectedBatch) return

    try {
      await startBatchMutation.mutateAsync(selectedBatch.id)
      refetchBatches()
      handleMenuClose()
    } catch (error) {
      console.error('Failed to start batch:', error)
    }
  }

  const handlePauseBatch = async () => {
    if (!selectedBatch) return

    try {
      await pauseBatchMutation.mutateAsync({
        batchId: selectedBatch.id,
        reason: 'Manual pause',
      })
      refetchBatches()
      handleMenuClose()
    } catch (error) {
      console.error('Failed to pause batch:', error)
    }
  }

  const handleResumeBatch = async () => {
    if (!selectedBatch) return

    try {
      await resumeBatchMutation.mutateAsync(selectedBatch.id)
      refetchBatches()
      handleMenuClose()
    } catch (error) {
      console.error('Failed to resume batch:', error)
    }
  }

  const handleEditBatch = () => {
    setEditDialogOpen(true)
    handleMenuClose()
  }

  const handleDeleteBatch = () => {
    setDeleteDialogOpen(true)
    handleMenuClose()
  }

  const handleCreateBatch = async () => {
    try {
      await createBatchMutation.mutateAsync({
        ...newBatchData,
        plannedStartTime: `${format(selectedDate, 'yyyy-MM-dd')}T${
          newBatchData.plannedStartTime
        }`,
        plannedEndTime: `${format(selectedDate, 'yyyy-MM-dd')}T${
          newBatchData.plannedStartTime
        }`, // Will be calculated by backend
      })
      setCreateDialogOpen(false)
      setNewBatchData({
        name: '',
        workflowId: '',
        productId: 1,
        quantity: 1,
        priority: 'medium',
        plannedStartTime: '',
        notes: '',
      })
      refetchBatches()
    } catch (error) {
      console.error('Failed to create batch:', error)
    }
  }

  const confirmDeleteBatch = async () => {
    if (!selectedBatch) return

    try {
      await deleteBatchMutation.mutateAsync(selectedBatch.id)
      setDeleteDialogOpen(false)
      setSelectedBatch(null)
      refetchBatches()
    } catch (error) {
      console.error('Failed to delete batch:', error)
    }
  }

  if (schedulesLoading || batchesLoading) {
    return (
      <Box p={3}>
        <LinearProgress />
        <Typography variant="body2" mt={2}>
          Lade Produktionsplan...
        </Typography>
      </Box>
    )
  }

  if (schedulesError || batchesError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Fehler beim Laden des Produktionsplans:{' '}
        {(schedulesError as any)?.message || (batchesError as any)?.message}
      </Alert>
    )
  }

  if (!currentSchedule) {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="h6" color="text.secondary">
          Kein Produktionsplan für{' '}
          {format(selectedDate, 'dd.MM.yyyy', { locale: de })}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ mt: 2 }}
          onClick={() => setCreateDialogOpen(true)}
        >
          Produktionsplan erstellen
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      {/* Schedule Header */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h6">
                Produktionsplan -{' '}
                {format(selectedDate, 'dd.MM.yyyy', { locale: de })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {currentSchedule.workdayStartTime} -{' '}
                {currentSchedule.workdayEndTime} Uhr (
                {currentSchedule.totalStaffHours} Personalstunden)
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box display="flex" gap={1} justifyContent="flex-end">
                <Chip
                  icon={<CheckCircle />}
                  label={`${
                    currentSchedule.completionPercentage?.toFixed(0) || 0
                  }% abgeschlossen`}
                  color={
                    currentSchedule.completionPercentage &&
                    currentSchedule.completionPercentage > 80
                      ? 'success'
                      : 'default'
                  }
                  size="small"
                />
                <Chip
                  icon={<Schedule />}
                  label={`${
                    currentSchedule.capacityUtilization?.toFixed(0) || 0
                  }% Auslastung`}
                  color={
                    currentSchedule.capacityUtilization &&
                    currentSchedule.capacityUtilization > 90
                      ? 'warning'
                      : 'default'
                  }
                  size="small"
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Timeline View */}
      <Card>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h6">
              Batch-Zeitplan ({batches.length} Chargen)
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Charge hinzufügen
            </Button>
          </Box>

          {/* Timeline Header */}
          <Box
            position="relative"
            height={40}
            mb={2}
            bgcolor="grey.50"
            borderRadius={1}
          >
            {timelineHours.map((hour, index) => (
              <Box
                key={index}
                position="absolute"
                left={`${(index / (timelineHours.length - 1)) * 100}%`}
                top={0}
                height="100%"
                display="flex"
                alignItems="center"
                px={1}
                borderLeft={index > 0 ? '1px solid' : 'none'}
                borderColor="grey.300"
              >
                <Typography variant="caption" color="text.secondary">
                  {format(hour, 'HH:mm')}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Batch Timeline */}
          <Box position="relative" minHeight={200}>
            {batches.map((batch, index) => {
              const position = getBatchPosition(batch)
              return (
                <Box
                  key={batch.id}
                  position="absolute"
                  left={`${position.left}%`}
                  width={`${position.width}%`}
                  top={`${index * 60 + 10}px`}
                  height="50px"
                  zIndex={1}
                >
                  <Card
                    sx={{
                      height: '100%',
                      cursor: 'pointer',
                      bgcolor:
                        batch.status === 'in_progress'
                          ? 'primary.light'
                          : batch.status === 'completed'
                          ? 'success.light'
                          : batch.status === 'failed'
                          ? 'error.light'
                          : 'grey.100',
                      '&:hover': {
                        bgcolor:
                          batch.status === 'in_progress'
                            ? 'primary.main'
                            : batch.status === 'completed'
                            ? 'success.main'
                            : batch.status === 'failed'
                            ? 'error.main'
                            : 'grey.200',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Box flex={1} minWidth={0}>
                          <Typography variant="body2" fontWeight="bold" noWrap>
                            {batch.name}
                          </Typography>
                          <Box display="flex" gap={0.5} mt={0.5}>
                            <Chip
                              label={batch.status}
                              size="small"
                              color={getStatusColor(batch.status)}
                              sx={{ fontSize: '0.7rem', height: 18 }}
                            />
                            <Chip
                              label={batch.priority}
                              size="small"
                              color={getPriorityColor(batch.priority)}
                              sx={{ fontSize: '0.7rem', height: 18 }}
                            />
                          </Box>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuClick(e, batch)}
                        >
                          <MoreVert fontSize="small" />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              )
            })}
          </Box>

          {batches.length === 0 && (
            <Box textAlign="center" py={4}>
              <Typography variant="body2" color="text.secondary">
                Keine Produktionschargen für heute geplant
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Batch Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedBatch?.status === 'planned' && (
          <MenuItem onClick={handleStartBatch}>
            <PlayArrow sx={{ mr: 1 }} />
            Starten
          </MenuItem>
        )}
        {selectedBatch?.status === 'in_progress' && (
          <MenuItem onClick={handlePauseBatch}>
            <Pause sx={{ mr: 1 }} />
            Pausieren
          </MenuItem>
        )}
        {selectedBatch?.status === 'waiting' && (
          <MenuItem onClick={handleResumeBatch}>
            <PlayArrow sx={{ mr: 1 }} />
            Fortsetzen
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={handleEditBatch}>
          <Edit sx={{ mr: 1 }} />
          Bearbeiten
        </MenuItem>
        <MenuItem onClick={handleDeleteBatch} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} />
          Löschen
        </MenuItem>
      </Menu>

      {/* Create Batch Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Neue Produktionscharge erstellen</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name der Charge"
                value={newBatchData.name}
                onChange={(e) =>
                  setNewBatchData({ ...newBatchData, name: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Workflow ID"
                value={newBatchData.workflowId}
                onChange={(e) =>
                  setNewBatchData({
                    ...newBatchData,
                    workflowId: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Menge"
                value={newBatchData.quantity}
                onChange={(e) =>
                  setNewBatchData({
                    ...newBatchData,
                    quantity: parseInt(e.target.value) || 1,
                  })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priorität</InputLabel>
                <Select
                  value={newBatchData.priority}
                  label="Priorität"
                  onChange={(e) =>
                    setNewBatchData({
                      ...newBatchData,
                      priority: e.target.value as any,
                    })
                  }
                >
                  <MenuItem value="low">Niedrig</MenuItem>
                  <MenuItem value="medium">Mittel</MenuItem>
                  <MenuItem value="high">Hoch</MenuItem>
                  <MenuItem value="urgent">Dringend</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Startzeit"
                type="time"
                value={newBatchData.plannedStartTime}
                onChange={(e) =>
                  setNewBatchData({
                    ...newBatchData,
                    plannedStartTime: e.target.value,
                  })
                }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notizen"
                value={newBatchData.notes}
                onChange={(e) =>
                  setNewBatchData({ ...newBatchData, notes: e.target.value })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Abbrechen</Button>
          <Button
            onClick={handleCreateBatch}
            variant="contained"
            disabled={!newBatchData.name || !newBatchData.workflowId}
          >
            Erstellen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Charge löschen</DialogTitle>
        <DialogContent>
          <Typography>
            Möchten Sie die Charge "{selectedBatch?.name}" wirklich löschen?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Abbrechen</Button>
          <Button
            onClick={confirmDeleteBatch}
            variant="contained"
            color="error"
          >
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ProductionScheduleBoard
