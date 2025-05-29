import React, { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material'
import {
  PlayArrow,
  Pause,
  Timeline as TimelineIcon,
  ViewList,
  Edit as EditIcon,
  Today as TodayIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { Workflow, WorkflowStep } from '../../types/workflow'
import WorkflowStepTable from './WorkflowStepTable'
import WorkflowTimeline from './WorkflowTimeline'
import {
  updateWorkflowStep,
  pauseWorkflow,
  startWorkflow,
} from '../../services/workflowService'

interface WorkflowDetailProps {
  workflow: Workflow
  viewMode: 'table' | 'timeline'
  onViewModeChange: (mode: 'table' | 'timeline') => void
  onUpdateWorkflow: (workflow: Workflow) => void
}

const WorkflowDetail: React.FC<WorkflowDetailProps> = ({
  workflow,
  viewMode,
  onViewModeChange,
  onUpdateWorkflow,
}) => {
  const [loading, setLoading] = useState(false)
  const [editingNotes, setEditingNotes] = useState<{
    stepId: string
    notes: string
  } | null>(null)

  const handleTogglePlayPause = async () => {
    setLoading(true)
    try {
      let updatedWorkflow

      if (workflow.status === 'paused') {
        updatedWorkflow = await startWorkflow(workflow.id)
      } else {
        updatedWorkflow = await pauseWorkflow(workflow.id)
      }

      onUpdateWorkflow(updatedWorkflow)
    } catch (error) {
      console.error('Error updating workflow:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteStep = async (stepId: string) => {
    setLoading(true)
    try {
      const stepIndex = workflow.steps.findIndex((s) => s.id === stepId)
      if (stepIndex === -1) return

      const updatedWorkflow = await updateWorkflowStep(workflow.id, stepId, {
        status: 'completed',
        progress: 100,
        endTime: new Date(),
      })

      // Start next step if available
      if (stepIndex < workflow.steps.length - 1) {
        const nextStepId = workflow.steps[stepIndex + 1].id
        const finalWorkflow = await updateWorkflowStep(
          updatedWorkflow.id,
          nextStepId,
          {
            status: 'in-progress',
            progress: 0,
            startTime: new Date(),
          }
        )
        onUpdateWorkflow(finalWorkflow)
      } else {
        onUpdateWorkflow(updatedWorkflow)
      }
    } catch (error) {
      console.error('Error completing step:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenNotesDialog = (step: WorkflowStep) => {
    setEditingNotes({
      stepId: step.id,
      notes: step.notes || '',
    })
  }

  const handleSaveNotes = async () => {
    if (!editingNotes) return

    setLoading(true)
    try {
      const updatedWorkflow = await updateWorkflowStep(
        workflow.id,
        editingNotes.stepId,
        { notes: editingNotes.notes }
      )
      onUpdateWorkflow(updatedWorkflow)
      setEditingNotes(null)
    } catch (error) {
      console.error('Error updating notes:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
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
            <Box>
              <Typography variant="h5" gutterBottom>
                {workflow.product}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <TodayIcon
                  sx={{ fontSize: 16, verticalAlign: 'text-bottom', mr: 0.5 }}
                />
                {format(new Date(workflow.startTime), 'EEEE, d. MMMM yyyy')}
                {' • '}Workflow: {workflow.name} (v{workflow.version}){' • '}
                Charge: {workflow.batchSize}
                {' • '}Verantwortlich: {workflow.assignedTo}
              </Typography>
            </Box>
            <Box>
              <Button
                variant="contained"
                startIcon={
                  workflow.status === 'paused' ? <PlayArrow /> : <Pause />
                }
                color="primary"
                sx={{ mr: 1 }}
                onClick={handleTogglePlayPause}
                disabled={
                  loading ||
                  workflow.status === 'completed' ||
                  workflow.status === 'planned'
                }
              >
                {workflow.status === 'paused' ? 'Fortsetzen' : 'Pausieren'}
              </Button>
              <ToggleButtonGroup
                size="small"
                value={viewMode}
                exclusive
                onChange={(_, newMode) => newMode && onViewModeChange(newMode)}
              >
                <ToggleButton value="table">
                  <ViewList />
                </ToggleButton>
                <ToggleButton value="timeline">
                  <TimelineIcon />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          {/* Status badges */}
          <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 3 }}>
            <Chip
              label={workflow.status}
              color={
                workflow.status === 'completed'
                  ? 'success'
                  : workflow.status === 'in-progress'
                  ? 'primary'
                  : workflow.status === 'paused'
                  ? 'warning'
                  : 'default'
              }
              sx={{ textTransform: 'capitalize' }}
            />
            {workflow.status !== 'completed' && (
              <Chip
                label={`Fertig: ${format(
                  new Date(workflow.estimatedEndTime),
                  "HH:mm 'Uhr'"
                )}`}
                variant="outlined"
              />
            )}
          </Box>

          {/* Workflow visualization */}
          {viewMode === 'table' ? (
            <WorkflowStepTable
              steps={workflow.steps}
              onComplete={handleCompleteStep}
              onEditNotes={handleOpenNotesDialog}
              disabled={
                loading ||
                workflow.status === 'paused' ||
                workflow.status === 'completed'
              }
            />
          ) : (
            <WorkflowTimeline workflow={workflow} />
          )}
        </CardContent>
      </Card>

      {/* Notes editing dialog */}
      <Dialog
        open={editingNotes !== null}
        onClose={() => setEditingNotes(null)}
      >
        <DialogTitle>Notizen bearbeiten</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Notizen"
            variant="outlined"
            margin="normal"
            value={editingNotes?.notes || ''}
            onChange={(e) =>
              setEditingNotes((prev) =>
                prev ? { ...prev, notes: e.target.value } : null
              )
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingNotes(null)}>Abbrechen</Button>
          <Button
            onClick={handleSaveNotes}
            variant="contained"
            disabled={loading}
          >
            Speichern
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default WorkflowDetail
