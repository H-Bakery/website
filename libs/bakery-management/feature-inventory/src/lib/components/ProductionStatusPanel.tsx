'use client'

// Production Status Panel - Real-time monitoring dashboard
// Shows live production status with alerts, timeline, and batch monitoring

import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Chip,
  Avatar,
  AvatarGroup,
  IconButton,
  Button,
  Alert,
  Badge,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  LinearProgress,
  Tooltip,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import {
  PlayArrow,
  Pause,
  Stop,
  Warning,
  Error,
  CheckCircle,
  Schedule,
  Group,
  Build,
  Notifications,
  NotificationsActive,
  ExpandMore,
  ExpandLess,
  Refresh,
  Timeline,
  Dashboard,
  List as ListIcon,
  WifiOff,
  Wifi,
} from '@mui/icons-material'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  useProductionStatus,
  useProductionBatches,
} from '../hooks/use-production'
import { useProductionSocket } from '../hooks/use-production-socket'
import {
  ProductionStatus,
  ProductionBatch,
  ProductionAlert,
  TimelineEvent,
} from '../../types/production'
import BatchDetailsPanel from './BatchDetailsPanel'

interface ProductionStatusPanelProps {
  selectedDate: Date
  refreshInterval?: number
  showAlerts?: boolean
  showTimeline?: boolean
  useWebSocket?: boolean
}

export const ProductionStatusPanel: React.FC<ProductionStatusPanelProps> = ({
  selectedDate,
  refreshInterval = 30000, // 30 seconds - used as fallback when WebSocket is disabled
  showAlerts = true,
  showTimeline = true,
  useWebSocket = true,
}) => {
  const [viewMode, setViewMode] = useState<'dashboard' | 'timeline' | 'list'>(
    'dashboard'
  )
  const [expandedAlerts, setExpandedAlerts] = useState(false)
  const [expandedBatches, setExpandedBatches] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null)
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false)

  const dateString = format(selectedDate, 'yyyy-MM-dd')

  // Fetch production status
  const {
    data: statusData,
    isLoading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useProductionStatus({
    date: dateString,
    includeCompleted: false,
  })

  // WebSocket integration
  const { isConnected } = useProductionSocket(
    {
      scheduleDate: useWebSocket ? dateString : undefined,
      subscribeToStatus: useWebSocket,
      autoConnect: useWebSocket,
    },
    {
      // Custom callbacks for real-time updates
      onStatusUpdate: (data) => {
        console.log('Production status updated:', data)
      },
      onBatchUpdate: (data) => {
        console.log('Batch updated:', data.batchId, data)
      },
      onIssueReported: (data) => {
        console.log('Issue reported:', data)
      },
    }
  )

  // Auto-refresh functionality (fallback when WebSocket is disabled)
  useEffect(() => {
    if (!useWebSocket && refreshInterval > 0) {
      const interval = setInterval(() => {
        refetchStatus()
      }, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [useWebSocket, refreshInterval, refetchStatus])

  const handleBatchClick = (batchId: number) => {
    setSelectedBatchId(batchId)
    setDetailsPanelOpen(true)
  }

  const getAlertIcon = (type: string, severity: string) => {
    if (severity === 'critical') return <Error color="error" />
    if (severity === 'high') return <Warning color="warning" />
    if (type === 'delay') return <Schedule color="warning" />
    if (type === 'quality') return <CheckCircle color="info" />
    return <Notifications color="info" />
  }

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical':
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

  const getBatchStatusIcon = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <PlayArrow color="primary" />
      case 'waiting':
        return <Pause color="warning" />
      case 'completed':
        return <CheckCircle color="success" />
      case 'failed':
        return <Error color="error" />
      default:
        return <Schedule color="disabled" />
    }
  }

  const getBatchStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'primary'
      case 'waiting':
        return 'warning'
      case 'completed':
        return 'success'
      case 'failed':
        return 'error'
      default:
        return 'default'
    }
  }

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'batch_started':
        return <PlayArrow color="primary" />
      case 'batch_completed':
        return <CheckCircle color="success" />
      case 'step_completed':
        return <CheckCircle color="info" />
      case 'issue_reported':
        return <Warning color="warning" />
      case 'quality_check':
        return <CheckCircle color="success" />
      default:
        return <Schedule color="info" />
    }
  }

  if (statusLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" p={2}>
            <LinearProgress sx={{ flex: 1, mr: 2 }} />
            <Typography>Lade Produktionsstatus...</Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (statusError || !statusData) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            Fehler beim Laden des Produktionsstatus:{' '}
            {(statusError as any)?.message}
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const {
    overview,
    activeBatches,
    pendingBatches,
    waitingBatches,
    alerts,
    timeline,
  } = statusData

  return (
    <>
      <Card>
        <CardContent>
          {/* Header */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={3}
          >
            <Box>
              <Typography variant="h6">
                Produktionsstatus - {useWebSocket ? 'Live' : 'Auto-Refresh'}
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="caption" color="text.secondary">
                  Zuletzt aktualisiert:{' '}
                  {format(new Date(statusData.lastUpdated), 'HH:mm:ss', {
                    locale: de,
                  })}
                </Typography>
                {useWebSocket && (
                  <Chip
                    icon={isConnected ? <Wifi /> : <WifiOff />}
                    label={isConnected ? 'Verbunden' : 'Getrennt'}
                    size="small"
                    color={isConnected ? 'success' : 'error'}
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>

            <Box display="flex" gap={1} alignItems="center">
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, newMode) => newMode && setViewMode(newMode)}
                size="small"
              >
                <ToggleButton value="dashboard">
                  <Dashboard fontSize="small" />
                </ToggleButton>
                <ToggleButton value="timeline">
                  <Timeline fontSize="small" />
                </ToggleButton>
                <ToggleButton value="list">
                  <ListIcon fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>

              <Tooltip
                title={
                  useWebSocket && isConnected
                    ? 'WebSocket aktiv - Automatische Updates'
                    : 'Aktualisieren'
                }
              >
                <IconButton onClick={() => refetchStatus()} size="small">
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Overview Stats */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={6} sm={3}>
              <Box
                textAlign="center"
                p={2}
                bgcolor="primary.light"
                borderRadius={1}
              >
                <Typography variant="h4" color="primary.contrastText">
                  {overview.activeBatches}
                </Typography>
                <Typography variant="caption" color="primary.contrastText">
                  Aktive Chargen
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Box
                textAlign="center"
                p={2}
                bgcolor="warning.light"
                borderRadius={1}
              >
                <Typography variant="h4" color="warning.contrastText">
                  {overview.pendingBatches}
                </Typography>
                <Typography variant="caption" color="warning.contrastText">
                  Wartend
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Box
                textAlign="center"
                p={2}
                bgcolor="success.light"
                borderRadius={1}
              >
                <Typography variant="h4" color="success.contrastText">
                  {overview.completedBatches}
                </Typography>
                <Typography variant="caption" color="success.contrastText">
                  Abgeschlossen
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Box
                textAlign="center"
                p={2}
                bgcolor="info.light"
                borderRadius={1}
              >
                <Typography variant="h4" color="info.contrastText">
                  {overview.efficiency.toFixed(0)}%
                </Typography>
                <Typography variant="caption" color="info.contrastText">
                  Effizienz
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Alerts Section */}
          {showAlerts && alerts.length > 0 && (
            <Box mb={3}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={1}
              >
                <Typography variant="subtitle2" color="error">
                  <Badge badgeContent={alerts.length} color="error">
                    <NotificationsActive />
                  </Badge>
                  Aktuelle Warnungen
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setExpandedAlerts(!expandedAlerts)}
                >
                  {expandedAlerts ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>

              <Box display="flex" flexWrap="wrap" gap={1} mb={1}>
                {alerts
                  .slice(0, expandedAlerts ? alerts.length : 3)
                  .map((alert, index) => (
                    <Alert
                      key={index}
                      severity={getAlertColor(alert.severity) as any}
                      icon={getAlertIcon(alert.type, alert.severity)}
                    >
                      <Box>
                        <Typography variant="caption" fontWeight="bold">
                          {alert.batchName || `Batch ${alert.batchId}`}
                          {alert.stepName && ` - ${alert.stepName}`}
                        </Typography>
                        <Typography variant="caption" display="block">
                          {alert.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(parseISO(alert.timestamp), {
                            addSuffix: true,
                            locale: de,
                          })}
                        </Typography>
                      </Box>
                    </Alert>
                  ))}
              </Box>

              {alerts.length > 3 && !expandedAlerts && (
                <Typography variant="caption" color="text.secondary">
                  {alerts.length - 3} weitere Warnungen...
                </Typography>
              )}
            </Box>
          )}

          {/* Content based on view mode */}
          {viewMode === 'dashboard' && (
            <Grid container spacing={3}>
              {/* Active Batches */}
              <Grid item xs={12} md={6}>
                <Box>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={2}
                  >
                    <Typography variant="subtitle2">
                      Aktive Chargen ({activeBatches.length})
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => setExpandedBatches(!expandedBatches)}
                    >
                      {expandedBatches ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </Box>

                  {activeBatches
                    .slice(0, expandedBatches ? activeBatches.length : 3)
                    .map((batch) => (
                      <Card
                        key={batch.id}
                        variant="outlined"
                        sx={{
                          mb: 1,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                        onClick={() => handleBatchClick(batch.id)}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Box flex={1}>
                              <Typography variant="subtitle2" noWrap>
                                {batch.name}
                              </Typography>
                              <Box display="flex" gap={0.5} mt={0.5}>
                                <Chip
                                  label={batch.status}
                                  size="small"
                                  color={getBatchStatusColor(batch.status)}
                                  icon={getBatchStatusIcon(batch.status)}
                                />
                                <Chip
                                  label={`${batch.progress || 0}%`}
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                            </Box>

                            <Box textAlign="right">
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {batch.assignedStaffIds.length} Personen
                              </Typography>
                              <AvatarGroup
                                max={3}
                                sx={{ justifyContent: 'flex-end' }}
                              >
                                {batch.assignedStaffIds.map((staffId) => (
                                  <Avatar
                                    key={staffId}
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    {staffId}
                                  </Avatar>
                                ))}
                              </AvatarGroup>
                            </Box>
                          </Box>

                          <Box mt={1}>
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
                        </CardContent>
                      </Card>
                    ))}

                  {activeBatches.length === 0 && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      textAlign="center"
                      py={2}
                    >
                      Keine aktiven Chargen
                    </Typography>
                  )}
                </Box>
              </Grid>

              {/* Waiting & Pending Batches */}
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Warteschlange (
                    {pendingBatches.length + waitingBatches.length})
                  </Typography>

                  {[...pendingBatches, ...waitingBatches]
                    .slice(0, 5)
                    .map((batch) => (
                      <Card
                        key={batch.id}
                        variant="outlined"
                        sx={{
                          mb: 1,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                        onClick={() => handleBatchClick(batch.id)}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Box>
                              <Typography variant="subtitle2">
                                {batch.name}
                              </Typography>
                              <Box display="flex" gap={0.5} mt={0.5}>
                                <Chip
                                  label={batch.status}
                                  size="small"
                                  color={getBatchStatusColor(batch.status)}
                                />
                                <Chip
                                  label={batch.priority}
                                  size="small"
                                  color={
                                    batch.priority === 'urgent'
                                      ? 'error'
                                      : 'default'
                                  }
                                  variant="outlined"
                                />
                              </Box>
                            </Box>

                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {format(
                                parseISO(batch.plannedStartTime),
                                'HH:mm',
                                { locale: de }
                              )}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}

                  {pendingBatches.length === 0 &&
                    waitingBatches.length === 0 && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        textAlign="center"
                        py={2}
                      >
                        Keine wartenden Chargen
                      </Typography>
                    )}
                </Box>
              </Grid>
            </Grid>
          )}

          {/* Timeline View */}
          {viewMode === 'timeline' && showTimeline && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Produktions-Timeline
              </Typography>

              <List>
                {timeline.slice(0, 10).map((event, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {getTimelineIcon(event.type)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box>
                            <Typography variant="subtitle2">
                              {event.batchName}
                              {event.stepName && ` - ${event.stepName}`}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {event.type.replace('_', ' ')}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption">
                            {formatDistanceToNow(parseISO(event.timestamp), {
                              addSuffix: true,
                              locale: de,
                            })}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < timeline.length - 1 && (
                      <Divider variant="inset" component="li" />
                    )}
                  </React.Fragment>
                ))}
              </List>

              {timeline.length === 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                  py={2}
                >
                  Keine Timeline-Ereignisse
                </Typography>
              )}
            </Box>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Alle Chargen (
                {activeBatches.length +
                  pendingBatches.length +
                  waitingBatches.length}
                )
              </Typography>

              <List>
                {[...activeBatches, ...pendingBatches, ...waitingBatches].map(
                  (batch, index) => (
                    <React.Fragment key={batch.id}>
                      <ListItem
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                        onClick={() => handleBatchClick(batch.id)}
                      >
                        <ListItemAvatar>
                          <Avatar
                            sx={{
                              bgcolor:
                                getBatchStatusColor(batch.status) + '.main',
                            }}
                          >
                            {getBatchStatusIcon(batch.status)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box
                              display="flex"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Typography variant="subtitle2">
                                {batch.name}
                              </Typography>
                              <Box display="flex" gap={0.5}>
                                <Chip
                                  label={batch.status}
                                  size="small"
                                  color={getBatchStatusColor(batch.status)}
                                />
                                <Chip
                                  label={`${batch.progress || 0}%`}
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                            </Box>
                          }
                          secondary={
                            <Box
                              display="flex"
                              justifyContent="space-between"
                              mt={1}
                            >
                              <Typography variant="caption">
                                {batch.plannedQuantity} {batch.unit} •
                                Priorität: {batch.priority}
                              </Typography>
                              <Typography variant="caption">
                                {format(
                                  parseISO(batch.plannedStartTime),
                                  'HH:mm',
                                  { locale: de }
                                )}{' '}
                                -
                                {format(
                                  parseISO(batch.plannedEndTime),
                                  'HH:mm',
                                  { locale: de }
                                )}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index <
                        activeBatches.length +
                          pendingBatches.length +
                          waitingBatches.length -
                          1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  )
                )}
              </List>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Batch Details Panel */}
      {selectedBatchId && (
        <BatchDetailsPanel
          batchId={selectedBatchId}
          open={detailsPanelOpen}
          onClose={() => {
            setDetailsPanelOpen(false)
            setSelectedBatchId(null)
          }}
        />
      )}
    </>
  )
}

export default ProductionStatusPanel
