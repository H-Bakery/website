'use client'

// Batch Details Panel - Detailed view of production batch with step tracking
// Shows real-time progress, quality checks, and team assignments

import React, { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Button,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Avatar,
  AvatarGroup,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import {
  PlayArrow,
  Pause,
  CheckCircle,
  Warning,
  Error,
  Schedule,
  Group,
  Build,
  Assignment,
  TrendingUp,
  Close,
  Edit,
  Add,
  Visibility,
} from '@mui/icons-material'
import { format, parseISO, differenceInMinutes } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  useProductionBatch,
  useBatchSteps,
  useUpdateStep,
  useCompleteStep,
  useUpdateStepProgress,
  usePerformQualityCheck,
  useReportIssue,
} from '../../hooks/useProduction'
import { useProductionSocket } from '../../hooks/useProductionSocket'
import {
  ProductionBatch,
  ProductionStep,
  QualityCheck,
  ProductionIssue,
} from '../../types/production'

interface BatchDetailsPanelProps {
  batchId: number
  open: boolean
  onClose: () => void
  useWebSocket?: boolean
}

export const BatchDetailsPanel: React.FC<BatchDetailsPanelProps> = ({
  batchId,
  open,
  onClose,
  useWebSocket = true,
}) => {
  const [activeStep, setActiveStep] = useState<number>(0)
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false)
  const [issueDialogOpen, setIssueDialogOpen] = useState(false)
  const [progressDialogOpen, setProgressDialogOpen] = useState(false)
  const [selectedStep, setSelectedStep] = useState<ProductionStep | null>(null)
  const [qualityData, setQualityData] = useState({
    checks: [] as QualityCheck[],
    notes: '',
  })
  const [issueData, setIssueData] = useState({
    type: 'quality' as const,
    severity: 'medium' as const,
    description: '',
    impact: 'medium' as const,
  })
  const [progressData, setProgressData] = useState({
    progress: 0,
    status: '',
    notes: '',
    hasIssues: false,
    qualityCheckCompleted: false,
  })

  // Fetch batch details
  const {
    data: batch,
    isLoading: batchLoading,
    error: batchError,
    refetch: refetchBatch,
  } = useProductionBatch(batchId)

  // Fetch batch steps
  const {
    data: steps,
    isLoading: stepsLoading,
    error: stepsError,
    refetch: refetchSteps,
  } = useBatchSteps(batchId)

  // WebSocket integration for real-time updates
  useProductionSocket(
    {
      batchId: useWebSocket && open ? batchId : undefined,
      autoConnect: useWebSocket && open,
    },
    {
      onBatchUpdate: (data) => {
        if (data.batchId === batchId) {
          console.log('Batch updated via WebSocket:', data)
          // React Query will automatically update the cache
        }
      },
      onStepUpdate: (data) => {
        if (data.batchId === batchId) {
          console.log('Step updated via WebSocket:', data)
          // React Query will automatically update the cache
        }
      },
      onIssueReported: (data) => {
        if (data.batchId === batchId) {
          console.log('Issue reported via WebSocket:', data)
          refetchBatch() // Refetch to get the latest issues
        }
      },
      onQualityCheck: (data) => {
        if (data.batchId === batchId) {
          console.log('Quality check via WebSocket:', data)
          refetchSteps() // Refetch to get the latest quality data
        }
      },
    }
  )

  // Mutations
  const updateStepMutation = useUpdateStep()
  const completeStepMutation = useCompleteStep()
  const updateProgressMutation = useUpdateStepProgress()
  const qualityCheckMutation = usePerformQualityCheck()
  const reportIssueMutation = useReportIssue()

  const handleStepClick = (stepIndex: number) => {
    setActiveStep(stepIndex)
  }

  const handleUpdateProgress = async (step: ProductionStep) => {
    setSelectedStep(step)
    setProgressData({
      progress: step.progress,
      status: step.status,
      notes: step.notes || '',
      hasIssues: step.hasIssues,
      qualityCheckCompleted: step.qualityCheckCompleted,
    })
    setProgressDialogOpen(true)
  }

  const handlePerformQualityCheck = async (step: ProductionStep) => {
    setSelectedStep(step)
    setQualityData({
      checks: [
        { name: 'Visuelle Kontrolle', score: 0, passed: false },
        { name: 'Gewichtskontrolle', score: 0, passed: false },
        { name: 'Texturkontrolle', score: 0, passed: false },
      ],
      notes: '',
    })
    setQualityDialogOpen(true)
  }

  const handleReportIssue = async (step: ProductionStep) => {
    setSelectedStep(step)
    setIssueData({
      type: 'quality',
      severity: 'medium',
      description: '',
      impact: 'medium',
    })
    setIssueDialogOpen(true)
  }

  const submitProgressUpdate = async () => {
    if (!selectedStep) return

    try {
      await updateProgressMutation.mutateAsync({
        stepId: selectedStep.id,
        progressData,
      })
      setProgressDialogOpen(false)
      refetchSteps()
      refetchBatch()
    } catch (error) {
      console.error('Failed to update step progress:', error)
    }
  }

  const submitQualityCheck = async () => {
    if (!selectedStep) return

    try {
      await qualityCheckMutation.mutateAsync({
        stepId: selectedStep.id,
        qualityData: {
          checks: qualityData.checks,
          notes: qualityData.notes,
          passingScore: 80,
        },
      })
      setQualityDialogOpen(false)
      refetchSteps()
      refetchBatch()
    } catch (error) {
      console.error('Failed to perform quality check:', error)
    }
  }

  const submitIssueReport = async () => {
    if (!selectedStep) return

    try {
      await reportIssueMutation.mutateAsync({
        batchId,
        issueData: {
          stepId: selectedStep.id,
          ...issueData,
        },
      })
      setIssueDialogOpen(false)
      refetchSteps()
      refetchBatch()
    } catch (error) {
      console.error('Failed to report issue:', error)
    }
  }

  const getStepStatusIcon = (step: ProductionStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle color="success" />
      case 'in_progress':
        return <PlayArrow color="primary" />
      case 'failed':
        return <Error color="error" />
      case 'waiting':
        return <Pause color="warning" />
      default:
        return <Schedule color="disabled" />
    }
  }

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

  if (batchLoading || stepsLoading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogContent>
          <Box display="flex" alignItems="center" p={3}>
            <LinearProgress sx={{ flex: 1, mr: 2 }} />
            <Typography>Lade Batch-Details...</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    )
  }

  if (batchError || stepsError || !batch) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Alert severity="error">
            Fehler beim Laden der Batch-Details:{' '}
            {(batchError as any)?.message || (stepsError as any)?.message}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Schließen</Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              <Typography variant="h6">{batch.name}</Typography>
              <Box display="flex" gap={1} mt={1}>
                <Chip
                  label={batch.status}
                  size="small"
                  color={getStatusColor(batch.status)}
                />
                <Chip
                  label={batch.priority}
                  size="small"
                  color={getPriorityColor(batch.priority)}
                />
                <Chip
                  label={`${batch.actualQuantity || batch.plannedQuantity} ${
                    batch.unit
                  }`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </Box>
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Grid container spacing={3}>
            {/* Batch Overview */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Batch-Übersicht
                  </Typography>

                  {/* Progress */}
                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Fortschritt</Typography>
                      <Typography variant="body2">
                        {batch.progress || 0}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={batch.progress || 0}
                      color={
                        batch.progress && batch.progress > 80
                          ? 'success'
                          : 'primary'
                      }
                    />
                  </Box>

                  {/* Timing */}
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Zeitplanung
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Geplant:{' '}
                      {format(parseISO(batch.plannedStartTime), 'HH:mm', {
                        locale: de,
                      })}{' '}
                      -
                      {format(parseISO(batch.plannedEndTime), 'HH:mm', {
                        locale: de,
                      })}
                    </Typography>
                    {batch.actualStartTime && (
                      <Typography variant="body2" color="text.secondary">
                        Tatsächlich:{' '}
                        {format(parseISO(batch.actualStartTime), 'HH:mm', {
                          locale: de,
                        })}{' '}
                        -
                        {batch.actualEndTime
                          ? format(parseISO(batch.actualEndTime), 'HH:mm', {
                              locale: de,
                            })
                          : 'läuft'}
                      </Typography>
                    )}
                    {batch.isDelayed && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Verspätung: {batch.delayMinutes} Minuten
                      </Alert>
                    )}
                  </Box>

                  {/* Team */}
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Team ({batch.assignedStaffIds.length})
                    </Typography>
                    <AvatarGroup max={6}>
                      {batch.assignedStaffIds.map((staffId) => (
                        <Avatar key={staffId} sx={{ width: 32, height: 32 }}>
                          {staffId}
                        </Avatar>
                      ))}
                    </AvatarGroup>
                  </Box>

                  {/* Equipment */}
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Ausrüstung
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {batch.requiredEquipment.map((equipment) => (
                        <Chip
                          key={equipment}
                          label={equipment}
                          size="small"
                          variant="outlined"
                          icon={<Build />}
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* Issues */}
                  {batch.issues && batch.issues.length > 0 && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        gutterBottom
                        color="error"
                      >
                        Probleme ({batch.issues.length})
                      </Typography>
                      {batch.issues.slice(0, 3).map((issue, index) => (
                        <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                          {issue.description}
                        </Alert>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Step Progress */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Arbeitsschritte ({steps?.length || 0})
                  </Typography>

                  <Stepper activeStep={activeStep} orientation="vertical">
                    {steps?.map((step, index) => (
                      <Step
                        key={step.id}
                        completed={step.status === 'completed'}
                      >
                        <StepLabel
                          icon={getStepStatusIcon(step)}
                          onClick={() => handleStepClick(index)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            width="100%"
                          >
                            <Box>
                              <Typography variant="subtitle2">
                                {step.stepName}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {step.stepType} • {step.plannedDurationMinutes}{' '}
                                min
                              </Typography>
                            </Box>
                            <Box display="flex" gap={1}>
                              {step.hasIssues && (
                                <Chip
                                  label="Probleme"
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                />
                              )}
                              {step.qualityCheckCompleted && (
                                <Chip
                                  label="QK ✓"
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                />
                              )}
                              <Chip
                                label={`${step.progress}%`}
                                size="small"
                                variant="outlined"
                              />
                            </Box>
                          </Box>
                        </StepLabel>

                        <StepContent>
                          <Box p={2} bgcolor="grey.50" borderRadius={1}>
                            {/* Activities */}
                            <Typography variant="subtitle2" gutterBottom>
                              Aktivitäten:
                            </Typography>
                            <List dense>
                              {step.activities.map((activity, actIndex) => (
                                <ListItem key={actIndex}>
                                  <ListItemIcon>
                                    <Assignment fontSize="small" />
                                  </ListItemIcon>
                                  <ListItemText primary={activity} />
                                </ListItem>
                              ))}
                            </List>

                            {/* Conditions */}
                            {step.conditions.length > 0 && (
                              <>
                                <Typography
                                  variant="subtitle2"
                                  gutterBottom
                                  sx={{ mt: 2 }}
                                >
                                  Bedingungen:
                                </Typography>
                                <List dense>
                                  {step.conditions.map(
                                    (condition, condIndex) => (
                                      <ListItem key={condIndex}>
                                        <ListItemIcon>
                                          <CheckCircle
                                            fontSize="small"
                                            color="success"
                                          />
                                        </ListItemIcon>
                                        <ListItemText primary={condition} />
                                      </ListItem>
                                    )
                                  )}
                                </List>
                              </>
                            )}

                            {/* Progress Bar */}
                            <Box mt={2}>
                              <Box
                                display="flex"
                                justifyContent="space-between"
                                mb={1}
                              >
                                <Typography variant="body2">
                                  Fortschritt
                                </Typography>
                                <Typography variant="body2">
                                  {step.progress}%
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={step.progress}
                              />
                            </Box>

                            {/* Step Actions */}
                            <Box display="flex" gap={1} mt={2}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Edit />}
                                onClick={() => handleUpdateProgress(step)}
                              >
                                Fortschritt
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<CheckCircle />}
                                onClick={() => handlePerformQualityCheck(step)}
                                disabled={step.qualityCheckCompleted}
                              >
                                Qualität
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                startIcon={<Warning />}
                                onClick={() => handleReportIssue(step)}
                              >
                                Problem
                              </Button>
                            </Box>

                            {/* Notes */}
                            {step.notes && (
                              <Box
                                mt={2}
                                p={1}
                                bgcolor="info.light"
                                borderRadius={1}
                              >
                                <Typography
                                  variant="caption"
                                  color="info.contrastText"
                                >
                                  Notizen: {step.notes}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </StepContent>
                      </Step>
                    ))}
                  </Stepper>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>

      {/* Progress Update Dialog */}
      <Dialog
        open={progressDialogOpen}
        onClose={() => setProgressDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Fortschritt aktualisieren</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="body2" gutterBottom>
                Fortschritt: {progressData.progress}%
              </Typography>
              <Box px={1}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progressData.progress}
                  onChange={(e) =>
                    setProgressData({
                      ...progressData,
                      progress: parseInt(e.target.value),
                    })
                  }
                  style={{ width: '100%' }}
                />
              </Box>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={progressData.status}
                  label="Status"
                  onChange={(e) =>
                    setProgressData({ ...progressData, status: e.target.value })
                  }
                >
                  <MenuItem value="pending">Wartend</MenuItem>
                  <MenuItem value="ready">Bereit</MenuItem>
                  <MenuItem value="in_progress">In Bearbeitung</MenuItem>
                  <MenuItem value="waiting">Pausiert</MenuItem>
                  <MenuItem value="completed">Abgeschlossen</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notizen"
                value={progressData.notes}
                onChange={(e) =>
                  setProgressData({ ...progressData, notes: e.target.value })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProgressDialogOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={submitProgressUpdate} variant="contained">
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quality Check Dialog */}
      <Dialog
        open={qualityDialogOpen}
        onClose={() => setQualityDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Qualitätskontrolle durchführen</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {qualityData.checks.map((check, index) => (
              <Grid item xs={12} key={index}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      {check.name}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Typography variant="body2">Bewertung:</Typography>
                      <Box flex={1}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={check.score}
                          onChange={(e) => {
                            const newChecks = [...qualityData.checks]
                            newChecks[index] = {
                              ...check,
                              score: parseInt(e.target.value),
                              passed: parseInt(e.target.value) >= 80,
                            }
                            setQualityData({
                              ...qualityData,
                              checks: newChecks,
                            })
                          }}
                          style={{ width: '100%' }}
                        />
                      </Box>
                      <Typography variant="body2" minWidth={50}>
                        {check.score}%
                      </Typography>
                      <Chip
                        label={check.passed ? 'Bestanden' : 'Nicht bestanden'}
                        color={check.passed ? 'success' : 'error'}
                        size="small"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Anmerkungen zur Qualitätskontrolle"
                value={qualityData.notes}
                onChange={(e) =>
                  setQualityData({ ...qualityData, notes: e.target.value })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQualityDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={submitQualityCheck} variant="contained">
            Qualitätskontrolle speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* Issue Report Dialog */}
      <Dialog
        open={issueDialogOpen}
        onClose={() => setIssueDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Problem melden</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Typ</InputLabel>
                <Select
                  value={issueData.type}
                  label="Typ"
                  onChange={(e) =>
                    setIssueData({ ...issueData, type: e.target.value as any })
                  }
                >
                  <MenuItem value="quality">Qualität</MenuItem>
                  <MenuItem value="equipment">Ausrüstung</MenuItem>
                  <MenuItem value="timing">Zeitplanung</MenuItem>
                  <MenuItem value="resource">Ressourcen</MenuItem>
                  <MenuItem value="other">Sonstiges</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Schweregrad</InputLabel>
                <Select
                  value={issueData.severity}
                  label="Schweregrad"
                  onChange={(e) =>
                    setIssueData({
                      ...issueData,
                      severity: e.target.value as any,
                    })
                  }
                >
                  <MenuItem value="low">Niedrig</MenuItem>
                  <MenuItem value="medium">Mittel</MenuItem>
                  <MenuItem value="high">Hoch</MenuItem>
                  <MenuItem value="critical">Kritisch</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Beschreibung des Problems"
                value={issueData.description}
                onChange={(e) =>
                  setIssueData({ ...issueData, description: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Auswirkung</InputLabel>
                <Select
                  value={issueData.impact}
                  label="Auswirkung"
                  onChange={(e) =>
                    setIssueData({
                      ...issueData,
                      impact: e.target.value as any,
                    })
                  }
                >
                  <MenuItem value="low">Gering</MenuItem>
                  <MenuItem value="medium">Mittel</MenuItem>
                  <MenuItem value="high">Hoch</MenuItem>
                  <MenuItem value="unknown">Unbekannt</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueDialogOpen(false)}>Abbrechen</Button>
          <Button
            onClick={submitIssueReport}
            variant="contained"
            color="warning"
            disabled={!issueData.description}
          >
            Problem melden
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default BatchDetailsPanel
