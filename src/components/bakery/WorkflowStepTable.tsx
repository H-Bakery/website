import React from 'react'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Box,
  Typography,
  LinearProgress,
  Tooltip,
  Badge,
} from '@mui/material'
import {
  CheckCircle,
  AccessTime,
  Edit as EditIcon,
  Room as RoomIcon,
  Notes as NotesIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { WorkflowStep } from '../../types/workflow'

interface WorkflowStepTableProps {
  steps: WorkflowStep[]
  onComplete: (stepId: string) => void
  onEditNotes: (step: WorkflowStep) => void
  disabled: boolean
}

const WorkflowStepTable: React.FC<WorkflowStepTableProps> = ({
  steps,
  onComplete,
  onEditNotes,
  disabled,
}) => {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>Schritt</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Typ</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Dauer</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Details</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Aktionen</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {steps.map((step) => (
            <TableRow
              key={step.id}
              sx={{
                bgcolor:
                  step.status === 'completed'
                    ? 'success.50'
                    : step.status === 'in-progress'
                    ? 'primary.50'
                    : 'inherit',
                '&:hover': {
                  backgroundColor:
                    step.status === 'completed'
                      ? 'success.100'
                      : step.status === 'in-progress'
                      ? 'primary.100'
                      : 'action.hover',
                },
              }}
            >
              <TableCell>
                <Typography variant="subtitle2">
                  {step.name.replace(/_/g, ' ')}
                </Typography>
                {step.activities && step.activities.length > 0 && (
                  <Box
                    sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
                  >
                    {step.activities.map((activity, i) => (
                      <Chip
                        key={i}
                        label={activity.name.replace(/_/g, ' ')}
                        size="small"
                        variant="outlined"
                        color={activity.completed ? 'success' : 'default'}
                        sx={{ height: 20 }}
                      />
                    ))}
                  </Box>
                )}
              </TableCell>
              <TableCell>
                <Chip
                  label={step.type === 'sleep' ? 'Ruhezeit' : 'Manuell'}
                  size="small"
                  color={step.type === 'sleep' ? 'info' : 'warning'}
                  sx={{ textTransform: 'capitalize' }}
                />
              </TableCell>
              <TableCell>
                {step.duration || '-'}
                {step.conditions && Object.keys(step.conditions).length > 0 && (
                  <Tooltip
                    title={
                      <div>
                        {Object.entries(step.conditions).map(
                          ([condition, duration]) => (
                            <div key={condition}>
                              Bei {condition}: {duration}
                            </div>
                          )
                        )}
                      </div>
                    }
                  >
                    <IconButton size="small">
                      <SettingsIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </Box>
                  {(step.status === 'in-progress' ||
                    step.status === 'completed') && (
                    <LinearProgress
                      variant="determinate"
                      value={step.progress}
                      sx={{ mt: 1, height: 6, borderRadius: 3 }}
                    />
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  {step.location && (
                    <Typography
                      variant="body2"
                      sx={{ display: 'flex', alignItems: 'center' }}
                    >
                      <RoomIcon sx={{ fontSize: 16, mr: 0.5 }} />
                      {step.location}
                    </Typography>
                  )}
                  {step.startTime && (
                    <Typography
                      variant="body2"
                      sx={{ display: 'flex', alignItems: 'center' }}
                    >
                      <AccessTime sx={{ fontSize: 16, mr: 0.5 }} />
                      Start: {format(new Date(step.startTime), 'HH:mm')}
                    </Typography>
                  )}
                  {step.notes && (
                    <Tooltip title={step.notes}>
                      <Badge color="secondary" variant="dot">
                        <NotesIcon fontSize="small" />
                      </Badge>
                    </Tooltip>
                  )}
                </Box>
              </TableCell>
              <TableCell>
                {step.status === 'in-progress' && (
                  <IconButton
                    color="success"
                    onClick={() => onComplete(step.id)}
                    disabled={disabled}
                  >
                    <CheckCircle />
                  </IconButton>
                )}
                <IconButton color="primary" onClick={() => onEditNotes(step)}>
                  <EditIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default WorkflowStepTable
