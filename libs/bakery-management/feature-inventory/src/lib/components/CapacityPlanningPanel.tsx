'use client'

// Capacity Planning Panel - Resource optimization and capacity management
// Shows staff schedules, equipment availability, and production capacity analysis

import React, { useState, useMemo } from 'react'
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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  LinearProgress,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
} from '@mui/material'
import {
  People,
  Build,
  Schedule,
  Warning,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Add,
  Remove,
  Settings,
  Assignment,
  Speed,
  Timeline,
  CalendarToday,
  Engineering,
  Person,
} from '@mui/icons-material'
import { format, parseISO, addHours, differenceInMinutes } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  useCapacityAnalysis,
  useOptimizeSchedule,
} from '../hooks/use-production'
import {
  CapacityAnalysis,
  StaffCapacity,
  EquipmentCapacity,
  WorkerCapacity,
  EquipmentStation,
  CapacityBottleneck,
} from '../../types/production'

interface CapacityPlanningPanelProps {
  selectedDate: Date
  onOptimizeSchedule?: () => void
}

export const CapacityPlanningPanel: React.FC<CapacityPlanningPanelProps> = ({
  selectedDate,
  onOptimizeSchedule,
}) => {
  const [viewMode, setViewMode] = useState<'overview' | 'staff' | 'equipment'>(
    'overview'
  )
  const [selectedWorker, setSelectedWorker] = useState<WorkerCapacity | null>(
    null
  )
  const [selectedEquipment, setSelectedEquipment] =
    useState<EquipmentStation | null>(null)

  // Fetch capacity analysis
  const {
    data: capacityData,
    isLoading: capacityLoading,
    error: capacityError,
    refetch: refetchCapacity,
  } = useCapacityAnalysis({
    date: format(selectedDate, 'yyyy-MM-dd'),
  })

  const getBottleneckIcon = (type: string, severity: string) => {
    if (type === 'staff')
      return <People color={severity === 'high' ? 'error' : 'warning'} />
    if (type === 'equipment')
      return <Build color={severity === 'high' ? 'error' : 'warning'} />
    return <Warning color="warning" />
  }

  const getBottleneckColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'error'
      case 'medium':
        return 'warning'
      case 'low':
        return 'info'
      default:
        return 'default'
    }
  }

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'error'
    if (percentage >= 70) return 'warning'
    if (percentage >= 50) return 'success'
    return 'info'
  }

  const calculateUtilization = (used: number, total: number) => {
    if (total === 0) return 0
    return Math.round((used / total) * 100)
  }

  if (capacityLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" p={2}>
            <LinearProgress sx={{ flex: 1, mr: 2 }} />
            <Typography>Lade Kapazitätsanalyse...</Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (capacityError || !capacityData) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            Fehler beim Laden der Kapazitätsanalyse:{' '}
            {(capacityError as any)?.message}
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const {
    staffCapacity,
    equipmentCapacity,
    workdayMinutes,
    totalStaffHours,
    availableStations,
    bottlenecks,
    maxConcurrentBatches,
  } = capacityData

  // Calculate utilization metrics
  const staffUtilization = calculateUtilization(
    staffCapacity.totalHours - staffCapacity.averageHours,
    staffCapacity.totalHours
  )
  const equipmentUtilization = calculateUtilization(
    equipmentCapacity.totalCapacity - equipmentCapacity.totalAvailableHours,
    equipmentCapacity.totalCapacity
  )

  return (
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
              Kapazitätsplanung -{' '}
              {format(selectedDate, 'dd.MM.yyyy', { locale: de })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Ressourcenübersicht und Optimierung
            </Typography>
          </Box>

          <Box display="flex" gap={1} alignItems="center">
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && setViewMode(newMode)}
              size="small"
            >
              <ToggleButton value="overview">
                <Assignment fontSize="small" />
              </ToggleButton>
              <ToggleButton value="staff">
                <People fontSize="small" />
              </ToggleButton>
              <ToggleButton value="equipment">
                <Build fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>

            {onOptimizeSchedule && (
              <Button
                variant="contained"
                size="small"
                startIcon={<TrendingUp />}
                onClick={onOptimizeSchedule}
              >
                Optimieren
              </Button>
            )}
          </Box>
        </Box>

        {/* Capacity Overview Cards */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Box
              textAlign="center"
              p={2}
              bgcolor="primary.light"
              borderRadius={1}
            >
              <People
                sx={{ fontSize: 40, color: 'primary.contrastText', mb: 1 }}
              />
              <Typography variant="h4" color="primary.contrastText">
                {staffCapacity.availableWorkers}
              </Typography>
              <Typography variant="caption" color="primary.contrastText">
                Verfügbare Mitarbeiter
              </Typography>
              <LinearProgress
                variant="determinate"
                value={staffUtilization}
                sx={{
                  mt: 1,
                  bgcolor: 'primary.dark',
                  '& .MuiLinearProgress-bar': { bgcolor: 'white' },
                }}
              />
              <Typography variant="caption" color="primary.contrastText">
                {staffUtilization}% Auslastung
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box
              textAlign="center"
              p={2}
              bgcolor="secondary.light"
              borderRadius={1}
            >
              <Build
                sx={{ fontSize: 40, color: 'secondary.contrastText', mb: 1 }}
              />
              <Typography variant="h4" color="secondary.contrastText">
                {availableStations}
              </Typography>
              <Typography variant="caption" color="secondary.contrastText">
                Arbeitsstationen
              </Typography>
              <LinearProgress
                variant="determinate"
                value={equipmentUtilization}
                sx={{
                  mt: 1,
                  bgcolor: 'secondary.dark',
                  '& .MuiLinearProgress-bar': { bgcolor: 'white' },
                }}
              />
              <Typography variant="caption" color="secondary.contrastText">
                {equipmentUtilization}% Auslastung
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box
              textAlign="center"
              p={2}
              bgcolor="success.light"
              borderRadius={1}
            >
              <Schedule
                sx={{ fontSize: 40, color: 'success.contrastText', mb: 1 }}
              />
              <Typography variant="h4" color="success.contrastText">
                {Math.floor(workdayMinutes / 60)}h
              </Typography>
              <Typography variant="caption" color="success.contrastText">
                Produktionszeit
              </Typography>
              <Typography variant="body2" color="success.contrastText" mt={1}>
                {totalStaffHours} Arbeitsstunden
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center" p={2} bgcolor="info.light" borderRadius={1}>
              <Speed sx={{ fontSize: 40, color: 'info.contrastText', mb: 1 }} />
              <Typography variant="h4" color="info.contrastText">
                {maxConcurrentBatches}
              </Typography>
              <Typography variant="caption" color="info.contrastText">
                Max. parallele Chargen
              </Typography>
              <Typography variant="body2" color="info.contrastText" mt={1}>
                Gleichzeitig möglich
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Bottlenecks Alert */}
        {bottlenecks.length > 0 && (
          <Box mb={3}>
            <Typography
              variant="subtitle2"
              gutterBottom
              display="flex"
              alignItems="center"
            >
              <Warning color="warning" sx={{ mr: 1 }} />
              Engpässe
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {bottlenecks.map((bottleneck, index) => (
                <Alert
                  key={index}
                  severity={getBottleneckColor(bottleneck.severity) as any}
                  icon={getBottleneckIcon(bottleneck.type, bottleneck.severity)}
                >
                  {bottleneck.message}
                </Alert>
              ))}
            </Box>
          </Box>
        )}

        {/* Content based on view mode */}
        {viewMode === 'overview' && (
          <Grid container spacing={3}>
            {/* Staff Overview */}
            <Grid item xs={12} md={6}>
              <Typography
                variant="subtitle2"
                gutterBottom
                display="flex"
                alignItems="center"
              >
                <People sx={{ mr: 1 }} />
                Personal-Übersicht
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Rolle</TableCell>
                      <TableCell align="center">Anzahl</TableCell>
                      <TableCell align="center">Stunden</TableCell>
                      <TableCell align="center">Auslastung</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(
                      staffCapacity.workers.reduce((acc, worker) => {
                        if (!acc[worker.role]) {
                          acc[worker.role] = { count: 0, hours: 0 }
                        }
                        acc[worker.role].count++
                        acc[worker.role].hours += worker.hours
                        return acc
                      }, {} as Record<string, { count: number; hours: number }>)
                    ).map(([role, data]) => (
                      <TableRow key={role}>
                        <TableCell>{role}</TableCell>
                        <TableCell align="center">
                          <Chip label={data.count} size="small" />
                        </TableCell>
                        <TableCell align="center">{data.hours}h</TableCell>
                        <TableCell align="center">
                          <LinearProgress
                            variant="determinate"
                            value={calculateUtilization(
                              data.hours * 0.8,
                              data.hours
                            )}
                            sx={{ width: 60, mx: 'auto' }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell>
                        <strong>Gesamt</strong>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={staffCapacity.availableWorkers}
                          size="small"
                          color="primary"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <strong>{totalStaffHours}h</strong>
                      </TableCell>
                      <TableCell align="center">
                        <LinearProgress
                          variant="determinate"
                          value={staffUtilization}
                          sx={{ width: 60, mx: 'auto' }}
                          color={getUtilizationColor(staffUtilization)}
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            {/* Equipment Overview */}
            <Grid item xs={12} md={6}>
              <Typography
                variant="subtitle2"
                gutterBottom
                display="flex"
                alignItems="center"
              >
                <Build sx={{ mr: 1 }} />
                Geräte-Übersicht
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Typ</TableCell>
                      <TableCell align="center">Anzahl</TableCell>
                      <TableCell align="center">Kapazität</TableCell>
                      <TableCell align="center">Verfügbar</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(
                      equipmentCapacity.stations.reduce((acc, station) => {
                        if (!acc[station.type]) {
                          acc[station.type] = {
                            count: 0,
                            capacity: 0,
                            available: 0,
                          }
                        }
                        acc[station.type].count++
                        acc[station.type].capacity += station.capacity
                        acc[station.type].available += station.availableHours
                        return acc
                      }, {} as Record<string, { count: number; capacity: number; available: number }>)
                    ).map(([type, data]) => (
                      <TableRow key={type}>
                        <TableCell>{type}</TableCell>
                        <TableCell align="center">
                          <Chip label={data.count} size="small" />
                        </TableCell>
                        <TableCell align="center">{data.capacity}</TableCell>
                        <TableCell align="center">
                          <Box
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            {data.available}h
                            <LinearProgress
                              variant="determinate"
                              value={calculateUtilization(
                                data.capacity - data.available,
                                data.capacity
                              )}
                              sx={{ width: 60, ml: 1 }}
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell>
                        <strong>Gesamt</strong>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={equipmentCapacity.totalStations}
                          size="small"
                          color="secondary"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <strong>{equipmentCapacity.totalCapacity}</strong>
                      </TableCell>
                      <TableCell align="center">
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <strong>
                            {equipmentCapacity.totalAvailableHours}h
                          </strong>
                          <LinearProgress
                            variant="determinate"
                            value={equipmentUtilization}
                            sx={{ width: 60, ml: 1 }}
                            color={getUtilizationColor(equipmentUtilization)}
                          />
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        )}

        {/* Staff Details View */}
        {viewMode === 'staff' && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Personal-Details ({staffCapacity.workers.length} Mitarbeiter)
            </Typography>

            <List>
              {staffCapacity.workers.map((worker) => (
                <ListItem
                  key={worker.id}
                  button
                  selected={selectedWorker?.id === worker.id}
                  onClick={() => setSelectedWorker(worker)}
                >
                  <ListItemIcon>
                    <Avatar>
                      <Person />
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle2">
                          Mitarbeiter #{worker.id}
                        </Typography>
                        <Chip
                          label={worker.role}
                          size="small"
                          color="primary"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {format(parseISO(worker.startTime), 'HH:mm')} -{' '}
                          {format(parseISO(worker.endTime), 'HH:mm')} (
                          {worker.hours}h)
                        </Typography>
                        <Box display="flex" gap={0.5} mt={0.5}>
                          {worker.skills.map((skill) => (
                            <Chip
                              key={skill}
                              label={skill}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box textAlign="right">
                      <Typography variant="caption" color="text.secondary">
                        Auslastung
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={80} // Placeholder - would calculate actual utilization
                        sx={{ width: 80, mt: 0.5 }}
                      />
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Equipment Details View */}
        {viewMode === 'equipment' && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Geräte-Details ({equipmentCapacity.stations.length} Stationen)
            </Typography>

            <Grid container spacing={2}>
              {equipmentCapacity.stations.map((station) => (
                <Grid item xs={12} sm={6} md={4} key={station.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      bgcolor:
                        selectedEquipment?.id === station.id
                          ? 'action.selected'
                          : 'background.paper',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => setSelectedEquipment(station)}
                  >
                    <CardContent>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={1}
                      >
                        <Typography variant="subtitle2">
                          {station.name}
                        </Typography>
                        <Engineering color="action" />
                      </Box>

                      <Chip label={station.type} size="small" sx={{ mb: 1 }} />

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Kapazität: {station.capacity} Einheiten
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={calculateUtilization(
                            station.capacity - station.availableHours,
                            station.capacity
                          )}
                          sx={{ mt: 0.5, mb: 0.5 }}
                        />
                        <Typography variant="caption">
                          {station.availableHours}h verfügbar
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

export default CapacityPlanningPanel
