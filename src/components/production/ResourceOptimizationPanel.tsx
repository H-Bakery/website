'use client'

// Resource Optimization Panel - AI-powered production optimization
// Provides recommendations for resource allocation and schedule optimization

import React, { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Divider,
  Grid,
  Paper,
} from '@mui/material'
import {
  AutoFixHigh,
  TrendingUp,
  Schedule,
  People,
  Build,
  Warning,
  CheckCircle,
  PlayArrow,
  Info,
  Settings,
  Psychology,
  Speed,
  Assessment,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { useOptimizeSchedule } from '../../hooks/useProduction'

interface ResourceOptimizationPanelProps {
  selectedDate: Date
  onOptimizationComplete?: () => void
}

interface OptimizationConstraint {
  type: 'staff' | 'equipment' | 'time' | 'priority'
  name: string
  value: any
  enabled: boolean
}

interface OptimizationResult {
  success: boolean
  improvements: {
    efficiency: number
    throughput: number
    resourceUtilization: number
  }
  recommendations: Array<{
    type: string
    priority: 'low' | 'medium' | 'high'
    title: string
    description: string
    impact: string
  }>
  proposedSchedule?: any
}

export const ResourceOptimizationPanel: React.FC<ResourceOptimizationPanelProps> = ({
  selectedDate,
  onOptimizationComplete,
}) => {
  const [optimizationDialogOpen, setOptimizationDialogOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [constraints, setConstraints] = useState<OptimizationConstraint[]>([
    { type: 'staff', name: 'Mindestpersonal', value: 2, enabled: true },
    { type: 'staff', name: 'Maximalpersonal', value: 8, enabled: true },
    { type: 'equipment', name: 'Ofenkapazität', value: 100, enabled: true },
    { type: 'time', name: 'Produktionsstart', value: '06:00', enabled: true },
    { type: 'time', name: 'Produktionsende', value: '18:00', enabled: true },
    { type: 'priority', name: 'Eilaufträge zuerst', value: true, enabled: true },
  ])
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)

  const optimizeScheduleMutation = useOptimizeSchedule()

  const handleOptimizeClick = () => {
    setOptimizationDialogOpen(true)
    setActiveStep(0)
    setOptimizationResult(null)
  }

  const handleRunOptimization = async () => {
    try {
      // Prepare optimization data
      const enabledConstraints = constraints.filter(c => c.enabled)
      const constraintsData = enabledConstraints.reduce((acc, constraint) => {
        acc[constraint.name] = constraint.value
        return acc
      }, {} as Record<string, any>)

      const result = await optimizeScheduleMutation.mutateAsync({
        scheduleDate: format(selectedDate, 'yyyy-MM-dd'),
        constraints: constraintsData,
        // Mock demand data - in real implementation would come from orders
        productionDemand: [
          { productId: 1, workflowId: 'sourdough_bread', quantity: 50, priority: 'high' },
          { productId: 2, workflowId: 'croissant', quantity: 100, priority: 'medium' },
          { productId: 3, workflowId: 'pretzel', quantity: 30, priority: 'low' },
        ],
      })

      // Mock optimization result - in real implementation would come from backend
      setOptimizationResult({
        success: true,
        improvements: {
          efficiency: 15,
          throughput: 22,
          resourceUtilization: 18,
        },
        recommendations: [
          {
            type: 'schedule',
            priority: 'high',
            title: 'Parallelproduktion optimieren',
            description: 'Sauerteigbrot und Croissants können parallel produziert werden',
            impact: '30 Minuten Zeitersparnis',
          },
          {
            type: 'staff',
            priority: 'medium',
            title: 'Personal umverteilen',
            description: 'Ein Bäcker von Station 2 zu Station 1 verlegen für bessere Auslastung',
            impact: '15% bessere Personalauslastung',
          },
          {
            type: 'equipment',
            priority: 'low',
            title: 'Ofennutzung optimieren',
            description: 'Ofen 2 kann für kleinere Chargen effizienter genutzt werden',
            impact: '10% bessere Ofenauslastung',
          },
        ],
        proposedSchedule: result,
      })

      setActiveStep(2) // Jump to results
    } catch (error) {
      console.error('Optimization failed:', error)
      setOptimizationResult({
        success: false,
        improvements: { efficiency: 0, throughput: 0, resourceUtilization: 0 },
        recommendations: [],
      })
    }
  }

  const handleConstraintToggle = (index: number) => {
    const updated = [...constraints]
    updated[index].enabled = !updated[index].enabled
    setConstraints(updated)
  }

  const handleConstraintChange = (index: number, value: any) => {
    const updated = [...constraints]
    updated[index].value = value
    setConstraints(updated)
  }

  const getImprovementColor = (value: number) => {
    if (value >= 20) return 'success'
    if (value >= 10) return 'primary'
    if (value >= 5) return 'info'
    return 'default'
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <Warning color="error" />
      case 'medium': return <Info color="warning" />
      case 'low': return <Info color="info" />
      default: return <Info />
    }
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography variant="h6">
                Ressourcen-Optimierung
              </Typography>
              <Typography variant="caption" color="text.secondary">
                KI-gestützte Produktionsplanung
              </Typography>
            </Box>
            
            <Button
              variant="contained"
              startIcon={<AutoFixHigh />}
              onClick={handleOptimizeClick}
              color="primary"
            >
              Optimierung starten
            </Button>
          </Box>

          {/* Quick Insights */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Psychology sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h6">KI-Analyse</Typography>
                <Typography variant="body2" color="text.secondary">
                  Maschinelles Lernen für optimale Ressourcenverteilung
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Speed sx={{ fontSize: 40, color: 'secondary.main', mb: 1 }} />
                <Typography variant="h6">Echtzeitoptimierung</Typography>
                <Typography variant="body2" color="text.secondary">
                  Dynamische Anpassung an aktuelle Bedingungen
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Assessment sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h6">Messbare Ergebnisse</Typography>
                <Typography variant="body2" color="text.secondary">
                  Durchschnittlich 20% Effizienzsteigerung
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Optimization Dialog */}
      <Dialog
        open={optimizationDialogOpen}
        onClose={() => setOptimizationDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <AutoFixHigh sx={{ mr: 1 }} />
            Produktionsoptimierung - {format(selectedDate, 'dd.MM.yyyy', { locale: de })}
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {/* Step 1: Configure Constraints */}
            <Step>
              <StepLabel>Optimierungsparameter konfigurieren</StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Definieren Sie die Rahmenbedingungen für die Optimierung
                </Typography>
                
                <List>
                  {constraints.map((constraint, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        {constraint.type === 'staff' && <People />}
                        {constraint.type === 'equipment' && <Build />}
                        {constraint.type === 'time' && <Schedule />}
                        {constraint.type === 'priority' && <TrendingUp />}
                      </ListItemIcon>
                      <ListItemText
                        primary={constraint.name}
                        secondary={
                          constraint.type === 'time' ? (
                            <TextField
                              type="time"
                              value={constraint.value}
                              onChange={(e) => handleConstraintChange(index, e.target.value)}
                              size="small"
                              disabled={!constraint.enabled}
                            />
                          ) : constraint.type === 'priority' ? (
                            <FormControl size="small">
                              <Select
                                value={constraint.value ? 'true' : 'false'}
                                onChange={(e) => handleConstraintChange(index, e.target.value === 'true')}
                                disabled={!constraint.enabled}
                              >
                                <MenuItem value="true">Ja</MenuItem>
                                <MenuItem value="false">Nein</MenuItem>
                              </Select>
                            </FormControl>
                          ) : (
                            <TextField
                              type="number"
                              value={constraint.value}
                              onChange={(e) => handleConstraintChange(index, e.target.value)}
                              size="small"
                              disabled={!constraint.enabled}
                              sx={{ width: 100 }}
                            />
                          )
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton onClick={() => handleConstraintToggle(index)}>
                          {constraint.enabled ? (
                            <CheckCircle color="success" />
                          ) : (
                            <CheckCircle color="disabled" />
                          )}
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
                
                <Box mt={2}>
                  <Button
                    variant="contained"
                    onClick={() => setActiveStep(1)}
                    startIcon={<PlayArrow />}
                  >
                    Weiter
                  </Button>
                </Box>
              </StepContent>
            </Step>

            {/* Step 2: Run Optimization */}
            <Step>
              <StepLabel>Optimierung durchführen</StepLabel>
              <StepContent>
                <Box textAlign="center" py={3}>
                  {optimizeScheduleMutation.isLoading ? (
                    <>
                      <CircularProgress size={60} sx={{ mb: 2 }} />
                      <Typography variant="body1">
                        KI-Optimierung läuft...
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Dies kann einige Sekunden dauern
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Psychology sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                      <Typography variant="body1" gutterBottom>
                        Bereit zur Optimierung
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Die KI wird den optimalen Produktionsplan berechnen
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={handleRunOptimization}
                        startIcon={<AutoFixHigh />}
                        sx={{ mt: 2 }}
                      >
                        Optimierung starten
                      </Button>
                    </>
                  )}
                </Box>
              </StepContent>
            </Step>

            {/* Step 3: Show Results */}
            <Step>
              <StepLabel>Optimierungsergebnisse</StepLabel>
              <StepContent>
                {optimizationResult && (
                  <Box>
                    {optimizationResult.success ? (
                      <>
                        <Alert severity="success" sx={{ mb: 2 }}>
                          Optimierung erfolgreich abgeschlossen!
                        </Alert>
                        
                        {/* Improvements */}
                        <Typography variant="subtitle2" gutterBottom>
                          Verbesserungen
                        </Typography>
                        <Grid container spacing={2} mb={3}>
                          <Grid item xs={4}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color={getImprovementColor(optimizationResult.improvements.efficiency)}>
                                +{optimizationResult.improvements.efficiency}%
                              </Typography>
                              <Typography variant="caption">Effizienz</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={4}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color={getImprovementColor(optimizationResult.improvements.throughput)}>
                                +{optimizationResult.improvements.throughput}%
                              </Typography>
                              <Typography variant="caption">Durchsatz</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={4}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color={getImprovementColor(optimizationResult.improvements.resourceUtilization)}>
                                +{optimizationResult.improvements.resourceUtilization}%
                              </Typography>
                              <Typography variant="caption">Auslastung</Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                        
                        {/* Recommendations */}
                        <Typography variant="subtitle2" gutterBottom>
                          Empfehlungen
                        </Typography>
                        <List>
                          {optimizationResult.recommendations.map((rec, index) => (
                            <React.Fragment key={index}>
                              <ListItem>
                                <ListItemIcon>
                                  {getPriorityIcon(rec.priority)}
                                </ListItemIcon>
                                <ListItemText
                                  primary={rec.title}
                                  secondary={
                                    <Box>
                                      <Typography variant="body2" color="text.secondary">
                                        {rec.description}
                                      </Typography>
                                      <Chip
                                        label={rec.impact}
                                        size="small"
                                        color="success"
                                        sx={{ mt: 0.5 }}
                                      />
                                    </Box>
                                  }
                                />
                              </ListItem>
                              {index < optimizationResult.recommendations.length - 1 && <Divider />}
                            </React.Fragment>
                          ))}
                        </List>
                      </>
                    ) : (
                      <Alert severity="error">
                        Optimierung fehlgeschlagen. Bitte versuchen Sie es erneut.
                      </Alert>
                    )}
                  </Box>
                )}
              </StepContent>
            </Step>
          </Stepper>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setOptimizationDialogOpen(false)}>
            Abbrechen
          </Button>
          {optimizationResult?.success && (
            <Button
              variant="contained"
              onClick={() => {
                setOptimizationDialogOpen(false)
                onOptimizationComplete?.()
              }}
            >
              Optimierung anwenden
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ResourceOptimizationPanel