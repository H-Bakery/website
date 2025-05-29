import React from 'react'
import {
  Box,
  Typography,
  Paper,
  useTheme,
  Chip,
  Tooltip,
  Badge,
  Divider,
} from '@mui/material'
import {
  AccessTime,
  Notes as NotesIcon,
  Room as RoomIcon,
  DoneAll as DoneAllIcon,
  Settings as SettingsIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { Workflow, WorkflowStep } from '../../types/workflow'

interface WorkflowTimelineProps {
  workflow: Workflow
}

const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ workflow }) => {
  const theme = useTheme()

  // Custom function to format date
  const formatTime = (date?: Date) => {
    if (!date) return ''
    return format(new Date(date), "HH:mm 'Uhr'")
  }

  // Custom timeline step component
  const TimelineStep = ({
    step,
    index,
    isLast,
  }: {
    step: WorkflowStep
    index: number
    isLast: boolean
  }) => {
    // Determine step status visual indicators
    let dotColor = theme.palette.grey[400]
    let borderColor = theme.palette.grey[300]

    if (step.status === 'completed') {
      dotColor = theme.palette.success.main
      borderColor = theme.palette.success.main
    } else if (step.status === 'in-progress') {
      dotColor = theme.palette.primary.main
      borderColor = theme.palette.primary.main
    } else if (step.status === 'error') {
      dotColor = theme.palette.error.main
      borderColor = theme.palette.error.main
    } else if (step.status === 'paused') {
      dotColor = theme.palette.warning.main
      borderColor = theme.palette.warning.main
    }

    return (
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex' }}>
          {/* Left side: Timeline indicator */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: 50,
              position: 'relative',
            }}
          >
            {/* Timeline dot */}
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                bgcolor: dotColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 14,
              }}
            >
              {index + 1}
            </Box>

            {/* Timeline connector line */}
            {!isLast && (
              <Box
                sx={{
                  height: '100%',
                  width: 2,
                  bgcolor: borderColor,
                  my: 0.5,
                }}
              />
            )}
          </Box>

          {/* Right side: Step content */}
          <Box sx={{ flex: 1, ml: 2 }}>
            <Paper
              elevation={step.status === 'in-progress' ? 3 : 1}
              sx={{
                p: 2.5,
                mb: 1,
                bgcolor:
                  step.status === 'completed'
                    ? 'success.50'
                    : step.status === 'in-progress'
                    ? 'primary.50'
                    : 'background.paper',
                borderLeft: `4px solid ${borderColor}`,
              }}
            >
              {/* Header with name and status */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                  {step.name.replace(/_/g, ' ')}
                </Typography>

                <Chip
                  label={
                    step.status === 'completed'
                      ? 'Abgeschlossen'
                      : step.status === 'in-progress'
                      ? 'In Bearbeitung'
                      : step.status === 'pending'
                      ? 'Ausstehend'
                      : step.status === 'paused'
                      ? 'Pausiert'
                      : 'Fehler'
                  }
                  size="small"
                  color={
                    step.status === 'completed'
                      ? 'success'
                      : step.status === 'in-progress'
                      ? 'primary'
                      : step.status === 'paused'
                      ? 'warning'
                      : step.status === 'error'
                      ? 'error'
                      : 'default'
                  }
                />
              </Box>

              {/* Step type */}
              {step.type === 'sleep' && (
                <Chip
                  label="Ruhezeit"
                  size="small"
                  color="info"
                  sx={{ mb: 1 }}
                />
              )}

              {/* Info box: timing, location */}
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 2,
                  alignItems: 'center',
                  mt: 1.5,
                }}
              >
                {/* Timing information */}
                {(step.startTime || step.duration) && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AccessTime
                      sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {step.startTime && formatTime(step.startTime)}
                      {step.startTime && step.endTime && ' - '}
                      {step.endTime && formatTime(step.endTime)}
                      {!step.startTime &&
                        step.duration &&
                        `Dauer: ${step.duration}`}
                    </Typography>
                  </Box>
                )}

                {/* Location information */}
                {step.location && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <RoomIcon
                      sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {step.location}
                    </Typography>
                  </Box>
                )}

                {/* Conditions */}
                {step.conditions && Object.keys(step.conditions).length > 0 && (
                  <Tooltip
                    title={
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 'bold' }}
                        >
                          Bedingungen:
                        </Typography>
                        {Object.entries(step.conditions).map(
                          ([condition, duration]) => (
                            <Typography
                              key={condition}
                              variant="caption"
                              display="block"
                            >
                              • Bei {condition}: {duration}
                            </Typography>
                          )
                        )}
                      </Box>
                    }
                  >
                    <Chip
                      icon={<SettingsIcon fontSize="small" />}
                      label="Bedingungen"
                      size="small"
                      variant="outlined"
                    />
                  </Tooltip>
                )}
              </Box>

              {/* Activities */}
              {step.activities && step.activities.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Divider sx={{ my: 1 }} />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Aktivitäten:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {step.activities.map((activity, i) => (
                      <Chip
                        key={i}
                        icon={
                          activity.completed ? (
                            <DoneAllIcon fontSize="small" />
                          ) : undefined
                        }
                        label={activity.name.replace(/_/g, ' ')}
                        size="small"
                        color={activity.completed ? 'success' : 'default'}
                        variant={activity.completed ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Notes */}
              {step.notes && (
                <Box
                  sx={{
                    mt: 2,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    border: '1px dashed',
                    borderColor: 'divider',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ display: 'flex', alignItems: 'flex-start' }}
                  >
                    <NotesIcon
                      sx={{ fontSize: 16, mr: 0.5, mt: 0.25 }}
                      color="action"
                    />
                    {step.notes}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ mt: 2, px: 2 }}>
      {workflow.steps.map((step, index) => (
        <TimelineStep
          key={step.id}
          step={step}
          index={index}
          isLast={index === workflow.steps.length - 1}
        />
      ))}
    </Box>
  )
}

export default WorkflowTimeline
