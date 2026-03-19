'use client'
import React from 'react'
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
} from '@mui/material'
import {
  Factory as ProductionIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
} from '@mui/icons-material'

// Mock production data
const productionMetrics = {
  efficiency: 87,
  dailyOutput: 1250,
  targetOutput: 1400,
  activeLines: 3,
  totalLines: 4,
}

const productionOrders = [
  {
    id: '1',
    product: 'Vollkornbrot',
    quantity: 120,
    completed: 80,
    status: 'in-progress',
    startTime: '04:00',
    estimatedEnd: '08:00',
  },
  {
    id: '2',
    product: 'Baguette',
    quantity: 200,
    completed: 200,
    status: 'completed',
    startTime: '05:00',
    estimatedEnd: '07:30',
  },
  {
    id: '3',
    product: 'Croissant',
    quantity: 150,
    completed: 0,
    status: 'pending',
    startTime: '08:00',
    estimatedEnd: '11:00',
  },
  {
    id: '4',
    product: 'Brezel',
    quantity: 300,
    completed: 120,
    status: 'in-progress',
    startTime: '06:00',
    estimatedEnd: '09:30',
  },
]

const resourceStatus = [
  { resource: 'Mehl', level: 85, unit: 'kg', status: 'good' },
  { resource: 'Hefe', level: 15, unit: 'kg', status: 'low' },
  { resource: 'Salz', level: 92, unit: 'kg', status: 'good' },
  { resource: 'Butter', level: 45, unit: 'kg', status: 'medium' },
]

export default function AdminProductionPage() {
  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          <ProductionIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Produktionsplanung
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Übersicht und Steuerung der Produktionsprozesse
        </Typography>
      </Box>

      {/* Production Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Produktionseffizienz
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h3" component="div" sx={{ flexGrow: 1 }}>
                {productionMetrics.efficiency}%
              </Typography>
              <TrendingUpIcon color="success" />
            </Box>
            <LinearProgress
              variant="determinate"
              value={productionMetrics.efficiency}
              sx={{ height: 10, borderRadius: 5 }}
              color="success"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Durchschnitt der letzten 7 Tage: 85%
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Produktionsstatus
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h4">
                {productionMetrics.activeLines}/{productionMetrics.totalLines}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktive Produktionslinien
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {[...Array(productionMetrics.totalLines)].map((_, index) => (
                <Chip
                  key={index}
                  label={`Linie ${index + 1}`}
                  color={
                    index < productionMetrics.activeLines
                      ? 'success'
                      : 'default'
                  }
                  size="small"
                />
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Tagesproduktion
            </Typography>
            <Box sx={{ mb: 1 }}>
              <Typography variant="h4">
                {productionMetrics.dailyOutput} /{' '}
                {productionMetrics.targetOutput}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Produzierte Einheiten
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={
                (productionMetrics.dailyOutput /
                  productionMetrics.targetOutput) *
                100
              }
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Production Orders and Resources */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Aktuelle Produktionsaufträge
            </Typography>
            <List>
              {productionOrders.map((order) => (
                <ListItem key={order.id} divider>
                  <ListItemText
                    primaryTypographyProps={{ component: 'span' }}
                    secondaryTypographyProps={{ component: 'span' }}
                    primary={
                      <Box
                        component="span"
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Typography variant="subtitle1" component="span">
                          {order.product}
                        </Typography>
                        <Chip
                          label={
                            order.status === 'completed'
                              ? 'Abgeschlossen'
                              : order.status === 'in-progress'
                              ? 'In Produktion'
                              : 'Wartend'
                          }
                          color={
                            order.status === 'completed'
                              ? 'success'
                              : order.status === 'in-progress'
                              ? 'primary'
                              : 'default'
                          }
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box component="span" sx={{ display: 'block' }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          component="span"
                          sx={{ display: 'block' }}
                        >
                          {order.startTime} - {order.estimatedEnd} |{' '}
                          {order.completed}/{order.quantity} Stück
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={(order.completed / order.quantity) * 100}
                          sx={{ mt: 1, height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" aria-label="control">
                      {order.status === 'in-progress' ? (
                        <PauseIcon />
                      ) : (
                        <PlayIcon />
                      )}
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Ressourcenübersicht
            </Typography>
            <List>
              {resourceStatus.map((resource) => (
                <ListItem key={resource.resource} dense>
                  <ListItemText
                    primaryTypographyProps={{ component: 'span' }}
                    secondaryTypographyProps={{ component: 'span' }}
                    primary={resource.resource}
                    secondary={
                      <Box component="span" sx={{ display: 'block' }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          component="span"
                          sx={{ display: 'block' }}
                        >
                          {resource.level} {resource.unit}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={resource.level}
                          color={
                            resource.status === 'good'
                              ? 'success'
                              : resource.status === 'medium'
                              ? 'warning'
                              : 'error'
                          }
                          sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    }
                  />
                  {resource.status === 'low' && (
                    <ListItemSecondaryAction>
                      <WarningIcon color="warning" />
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))}
            </List>
            <Box
              sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}
            >
              <Typography variant="body2" color="warning.dark">
                <WarningIcon
                  sx={{ verticalAlign: 'middle', mr: 1, fontSize: 'small' }}
                />
                Niedriger Hefebestand - Nachbestellung empfohlen
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
