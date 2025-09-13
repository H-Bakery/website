'use client'

// Production Scheduler with Drag & Drop
// Enhanced production scheduling interface with drag-and-drop functionality

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  Alert,
  LinearProgress,
  Divider,
  Paper,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material'
import {
  Add,
  CheckCircle,
  Schedule,
  Warning,
  Undo,
  Redo,
  ViewModule,
  ViewStream,
  Refresh,
} from '@mui/icons-material'
import {
  format,
  parseISO,
  addHours,
  differenceInMinutes,
  startOfDay,
  endOfDay,
  addMinutes,
  isSameDay,
} from 'date-fns'
import { de } from 'date-fns/locale'
import {
  useProductionSchedules,
  useProductionBatches,
  useUpdateBatch,
  useCreateBatch,
  useDeleteBatch,
} from '../hooks/use-production'
import { useProductionSocket } from '../hooks/use-production-socket'
import { ProductionBatch, ScheduleViewMode } from '../../types/production'
import DraggableProductionBatch from './DraggableProductionBatch'
import ProductionTimelineDropZone from './ProductionTimelineDropZone'
import BatchDetailsPanel from './BatchDetailsPanel'

interface ProductionSchedulerDragDropProps {
  selectedDate: Date
  viewMode: ScheduleViewMode
  onDateChange: (date: Date) => void
  onViewModeChange: (mode: ScheduleViewMode) => void
}

interface DragState {
  isDragging: boolean
  draggedBatch: ProductionBatch | null
  draggedIndex: number | null
  originalPosition: { startTime: string; endTime: string } | null
}

interface UndoAction {
  type: 'move' | 'create' | 'delete'
  batchId: number
  previousState: Partial<ProductionBatch>
  newState: Partial<ProductionBatch>
}

export const ProductionSchedulerDragDrop: React.FC<
  ProductionSchedulerDragDropProps
> = ({ selectedDate, viewMode, onDateChange, onViewModeChange }) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedBatch: null,
    draggedIndex: null,
    originalPosition: null,
  })

  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(
    null
  )
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  const [redoStack, setRedoStack] = useState<UndoAction[]>([])
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null)
  const [conflictBatches, setConflictBatches] = useState<number[]>([])

  // Enable WebSocket for real-time updates
  const { isConnected } = useProductionSocket(
    {
      scheduleDate: format(selectedDate, 'yyyy-MM-dd'),
      autoConnect: true,
    },
    {
      onBatchUpdate: (data) => {
        refetchBatches()
      },
    }
  )

  // Fetch schedules and batches
  const {
    data: schedulesData,
    isLoading: schedulesLoading,
    error: schedulesError,
  } = useProductionSchedules({
    startDate: format(startOfDay(selectedDate), 'yyyy-MM-dd'),
    endDate: format(endOfDay(selectedDate), 'yyyy-MM-dd'),
    includeMetrics: true,
  })

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
  const updateBatchMutation = useUpdateBatch()
  const createBatchMutation = useCreateBatch()
  const deleteBatchMutation = useDeleteBatch()

  const schedules = schedulesData?.items || []
  const batches = batchesData?.items || []

  // Get current schedule
  const currentSchedule = useMemo(() => {
    return schedules.find(
      (schedule) =>
        format(parseISO(schedule.scheduleDate), 'yyyy-MM-dd') ===
        format(selectedDate, 'yyyy-MM-dd')
    )
  }, [schedules, selectedDate])

  // Generate timeline hours
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

  // Group batches by resource/equipment
  const batchesByResource = useMemo(() => {
    const grouped: Record<string, ProductionBatch[]> = {
      unassigned: [],
    }

    batches.forEach((batch) => {
      if (batch.requiredEquipment && batch.requiredEquipment.length > 0) {
        batch.requiredEquipment.forEach((equipment) => {
          if (!grouped[equipment]) {
            grouped[equipment] = []
          }
          grouped[equipment].push(batch)
        })
      } else {
        grouped.unassigned.push(batch)
      }
    })

    return grouped
  }, [batches])

  // Check for scheduling conflicts
  const checkConflicts = useCallback(
    (
      batchId: number,
      newStartTime: Date,
      duration: number,
      equipment: string[]
    ): number[] => {
      const newEndTime = addMinutes(newStartTime, duration)
      const conflicts: number[] = []

      batches.forEach((batch) => {
        if (batch.id === batchId) return

        const batchStart = parseISO(batch.plannedStartTime)
        const batchEnd = parseISO(batch.plannedEndTime)

        // Check time overlap
        const hasTimeOverlap =
          (newStartTime >= batchStart && newStartTime < batchEnd) ||
          (newEndTime > batchStart && newEndTime <= batchEnd) ||
          (newStartTime <= batchStart && newEndTime >= batchEnd)

        if (hasTimeOverlap) {
          // Check resource overlap
          const hasResourceOverlap = equipment.some((eq) =>
            batch.requiredEquipment?.includes(eq)
          )

          if (hasResourceOverlap || equipment.length === 0) {
            conflicts.push(batch.id)
          }
        }
      })

      return conflicts
    },
    [batches]
  )

  // Handle drag start
  const handleDragStart = useCallback(
    (batch: ProductionBatch, index: number) => {
      setDragState({
        isDragging: true,
        draggedBatch: batch,
        draggedIndex: index,
        originalPosition: {
          startTime: batch.plannedStartTime,
          endTime: batch.plannedEndTime,
        },
      })
    },
    []
  )

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedBatch: null,
      draggedIndex: null,
      originalPosition: null,
    })
    setConflictBatches([])
  }, [])

  // Handle drop on timeline
  const handleDrop = useCallback(
    async (batchId: number, newStartTime: Date) => {
      const batch = batches.find((b) => b.id === batchId)
      if (!batch) return

      const duration = batch.estimatedDurationMinutes
      const newEndTime = addMinutes(newStartTime, duration)

      // Check for conflicts
      const conflicts = checkConflicts(
        batchId,
        newStartTime,
        duration,
        batch.requiredEquipment || []
      )

      if (conflicts.length > 0) {
        setConflictBatches(conflicts)
        setSnackbarMessage(
          'Zeitkonflikt! Bitte wählen Sie einen anderen Zeitslot.'
        )
        handleDragEnd()
        return
      }

      // Create undo action
      const undoAction: UndoAction = {
        type: 'move',
        batchId,
        previousState: {
          plannedStartTime: batch.plannedStartTime,
          plannedEndTime: batch.plannedEndTime,
        },
        newState: {
          plannedStartTime: newStartTime.toISOString(),
          plannedEndTime: newEndTime.toISOString(),
        },
      }

      try {
        // Update batch with new times
        await updateBatchMutation.mutateAsync({
          id: batchId,
          data: {
            plannedStartTime: newStartTime.toISOString(),
            plannedEndTime: newEndTime.toISOString(),
          },
        })

        // Add to undo stack
        setUndoStack([...undoStack, undoAction])
        setRedoStack([]) // Clear redo stack on new action

        setSnackbarMessage(`Charge "${batch.name}" erfolgreich verschoben`)
        refetchBatches()
      } catch (error) {
        console.error('Failed to update batch:', error)
        setSnackbarMessage('Fehler beim Verschieben der Charge')
      }

      handleDragEnd()
    },
    [
      batches,
      checkConflicts,
      updateBatchMutation,
      undoStack,
      refetchBatches,
      handleDragEnd,
    ]
  )

  // Handle undo
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return

    const lastAction = undoStack[undoStack.length - 1]

    try {
      await updateBatchMutation.mutateAsync({
        id: lastAction.batchId,
        data: lastAction.previousState,
      })

      setUndoStack(undoStack.slice(0, -1))
      setRedoStack([...redoStack, lastAction])
      setSnackbarMessage('Aktion rückgängig gemacht')
      refetchBatches()
    } catch (error) {
      console.error('Failed to undo:', error)
      setSnackbarMessage('Fehler beim Rückgängigmachen')
    }
  }, [undoStack, redoStack, updateBatchMutation, refetchBatches])

  // Handle redo
  const handleRedo = useCallback(async () => {
    if (redoStack.length === 0) return

    const lastAction = redoStack[redoStack.length - 1]

    try {
      await updateBatchMutation.mutateAsync({
        id: lastAction.batchId,
        data: lastAction.newState,
      })

      setRedoStack(redoStack.slice(0, -1))
      setUndoStack([...undoStack, lastAction])
      setSnackbarMessage('Aktion wiederhergestellt')
      refetchBatches()
    } catch (error) {
      console.error('Failed to redo:', error)
      setSnackbarMessage('Fehler beim Wiederherstellen')
    }
  }, [undoStack, redoStack, updateBatchMutation, refetchBatches])

  // Calculate batch position for timeline
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
        width: Math.min(
          100 - Math.max(0, (startOffset / totalMinutes) * 100),
          (duration / totalMinutes) * 100
        ),
      }
    },
    [currentSchedule]
  )

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
        Fehler beim Laden:{' '}
        {(schedulesError as any)?.message || (batchesError as any)?.message}
      </Alert>
    )
  }

  return (
    <Box>
      {/* Header with Controls */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h6">
                Drag & Drop Produktionsplanung
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {format(selectedDate, 'dd.MM.yyyy', { locale: de })} •
                {currentSchedule
                  ? ` ${currentSchedule.workdayStartTime} - ${currentSchedule.workdayEndTime} Uhr`
                  : ' Kein Plan'}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box
                display="flex"
                gap={1}
                justifyContent="flex-end"
                alignItems="center"
              >
                {/* Connection Status */}
                <Chip
                  icon={isConnected ? <CheckCircle /> : <Warning />}
                  label={isConnected ? 'Live' : 'Offline'}
                  size="small"
                  color={isConnected ? 'success' : 'default'}
                />

                {/* Undo/Redo */}
                <Tooltip title="Rückgängig">
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                    >
                      <Undo />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Wiederherstellen">
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleRedo}
                      disabled={redoStack.length === 0}
                    >
                      <Redo />
                    </IconButton>
                  </span>
                </Tooltip>

                <Divider orientation="vertical" flexItem />

                {/* View Toggle */}
                <Tooltip title="Ansicht wechseln">
                  <IconButton
                    size="small"
                    onClick={() =>
                      onViewModeChange({
                        ...viewMode,
                        type:
                          viewMode.type === 'timeline' ? 'kanban' : 'timeline',
                      })
                    }
                  >
                    {viewMode.type === 'timeline' ? (
                      <ViewModule />
                    ) : (
                      <ViewStream />
                    )}
                  </IconButton>
                </Tooltip>

                {/* Refresh */}
                <Tooltip title="Aktualisieren">
                  <IconButton size="small" onClick={() => refetchBatches()}>
                    <Refresh />
                  </IconButton>
                </Tooltip>

                {/* Add Batch */}
                <Button variant="contained" startIcon={<Add />} size="small">
                  Neue Charge
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Grid container spacing={2}>
        {/* Timeline/Kanban View */}
        <Grid item xs={12} lg={selectedBatch ? 8 : 12}>
          <Card>
            <CardContent>
              {!currentSchedule ? (
                <Box textAlign="center" py={4}>
                  <Typography variant="h6" color="text.secondary">
                    Kein Produktionsplan für diesen Tag
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    sx={{ mt: 2 }}
                  >
                    Plan erstellen
                  </Button>
                </Box>
              ) : viewMode.type === 'timeline' ? (
                <>
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

                  {/* Resource Rows */}
                  {Object.entries(batchesByResource).map(
                    ([resource, resourceBatches]) => (
                      <Box key={resource} mb={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          {resource === 'unassigned'
                            ? 'Nicht zugewiesen'
                            : resource}
                        </Typography>

                        <Box
                          position="relative"
                          minHeight={80}
                          bgcolor="grey.50"
                          borderRadius={1}
                          p={1}
                        >
                          {/* Drop Zones */}
                          <Box
                            position="absolute"
                            top={0}
                            left={0}
                            right={0}
                            bottom={0}
                            display="flex"
                          >
                            {timelineHours.map((hour, index) => (
                              <Box key={index} flex={1} position="relative">
                                <ProductionTimelineDropZone
                                  timeSlot={hour}
                                  scheduleDate={currentSchedule.scheduleDate}
                                  scheduleStartTime={parseISO(
                                    `${currentSchedule.scheduleDate}T${currentSchedule.workdayStartTime}`
                                  )}
                                  scheduleEndTime={parseISO(
                                    `${currentSchedule.scheduleDate}T${currentSchedule.workdayEndTime}`
                                  )}
                                  existingBatches={resourceBatches}
                                  onDrop={handleDrop}
                                  isDraggingOver={dragState.isDragging}
                                  canDropHere={true}
                                />
                              </Box>
                            ))}
                          </Box>

                          {/* Batches */}
                          {resourceBatches.map((batch, index) => {
                            const position = getBatchPosition(batch)
                            const isConflict = conflictBatches.includes(
                              batch.id
                            )

                            return (
                              <Box
                                key={batch.id}
                                position="absolute"
                                left={`${position.left}%`}
                                width={`${position.width}%`}
                                top={10}
                                height={60}
                                zIndex={
                                  dragState.draggedBatch?.id === batch.id
                                    ? 1000
                                    : 10
                                }
                                sx={{
                                  transition: dragState.isDragging
                                    ? 'none'
                                    : 'all 0.3s ease',
                                  opacity: isConflict ? 0.6 : 1,
                                  filter: isConflict
                                    ? 'brightness(1.2)'
                                    : 'none',
                                }}
                              >
                                <DraggableProductionBatch
                                  batch={batch}
                                  index={index}
                                  onMenuClick={(e, b) => setSelectedBatch(b)}
                                  onDragStart={handleDragStart}
                                  onDragEnd={handleDragEnd}
                                  isDragging={
                                    dragState.draggedBatch?.id === batch.id
                                  }
                                />
                              </Box>
                            )
                          })}
                        </Box>
                      </Box>
                    )
                  )}
                </>
              ) : (
                // Kanban View
                <Grid container spacing={2}>
                  {['planned', 'ready', 'in_progress', 'completed'].map(
                    (status) => (
                      <Grid item xs={12} sm={6} md={3} key={status}>
                        <Paper
                          sx={{ p: 2, bgcolor: 'grey.50', minHeight: 400 }}
                        >
                          <Typography variant="subtitle2" gutterBottom>
                            {status.replace('_', ' ').toUpperCase()}
                          </Typography>
                          <Box display="flex" flexDirection="column" gap={1}>
                            {batches
                              .filter((batch) => batch.status === status)
                              .map((batch, index) => (
                                <DraggableProductionBatch
                                  key={batch.id}
                                  batch={batch}
                                  index={index}
                                  onMenuClick={(e, b) => setSelectedBatch(b)}
                                  onDragStart={handleDragStart}
                                  onDragEnd={handleDragEnd}
                                  isDragging={
                                    dragState.draggedBatch?.id === batch.id
                                  }
                                />
                              ))}
                          </Box>
                        </Paper>
                      </Grid>
                    )
                  )}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Batch Details Panel */}
        {selectedBatch && (
          <Grid item xs={12} lg={4}>
            <BatchDetailsPanel
              batchId={selectedBatch.id}
              open={true}
              onClose={() => setSelectedBatch(null)}
              useWebSocket={true}
            />
          </Grid>
        )}
      </Grid>

      {/* Snackbar for Feedback */}
      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage(null)}
        message={snackbarMessage}
      />
    </Box>
  )
}

export default ProductionSchedulerDragDrop
