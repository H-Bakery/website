import React, { useState } from 'react'
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Divider,
  Grid,
  Paper,
  Chip,
  Alert,
} from '@mui/material'
import {
  parseWorkflowDefinition,
  generateWorkflowPlan,
} from '../../utils/workflowUtils'

interface WorkflowCreationFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (workflowData: any) => void
}

const WorkflowCreationForm: React.FC<WorkflowCreationFormProps> = ({
  open,
  onClose,
  onSubmit,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [product, setProduct] = useState('')
  const [quantity, setQuantity] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [customYaml, setCustomYaml] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const [workflowPreview, setWorkflowPreview] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const templates = [
    { id: 'croissant_production', name: 'Croissant Produktion' },
    { id: 'sourdough_bread', name: 'Sauerteigbrot' },
    { id: 'baguette', name: 'Baguette' },
    { id: 'ciabatta', name: 'Ciabatta' },
    { id: 'custom', name: 'Benutzerdefiniert' },
  ]

  const staff = [
    { id: 'franz', name: 'Franz Müller' },
    { id: 'maria', name: 'Maria Schmidt' },
    { id: 'lisa', name: 'Lisa Wagner' },
    { id: 'thomas', name: 'Thomas Weber' },
  ]

  // Sample YAML for custom workflow
  const sampleYaml = `# Beispiel für Croissant-Prozess
name: croissant_production
version: 1.2
steps:
  - name: teig_vorbereiten
    timeout: 30m
    activities:
      - mixen
      - kneten
  - name: erste_gehzeit
    type: sleep
    duration: 2h
    conditions:
      - temp > 22°C: 1.5h
  - name: formen
    parallel:
      - schneiden
      - rollen
  - name: zweite_gehzeit
    type: sleep
    duration: 1h
  - name: backen
    timeout: 20m
    params:
      temp: 190°C`

  const handlePreview = () => {
    try {
      setError(null)

      // Validate inputs
      if (!selectedTemplate) {
        setError('Bitte wählen Sie eine Vorlage aus')
        return
      }

      if (!product) {
        setError('Bitte geben Sie einen Produktnamen ein')
        return
      }

      if (quantity <= 0) {
        setError('Die Menge muss größer als 0 sein')
        return
      }

      if (!assignedTo) {
        setError('Bitte wählen Sie einen Verantwortlichen aus')
        return
      }

      if (!startDate || !startTime) {
        setError('Bitte wählen Sie Datum und Zeit aus')
        return
      }

      if (selectedTemplate === 'custom' && !customYaml.trim()) {
        setError('Bitte geben Sie eine YAML-Definition ein')
        return
      }

      // Create date from inputs
      const startDateTime = new Date(`${startDate}T${startTime}`)
      if (isNaN(startDateTime.getTime())) {
        setError('Ungültiges Datum oder ungültige Zeit')
        return
      }

      let workflowDefinition

      if (selectedTemplate === 'custom') {
        try {
          workflowDefinition = parseWorkflowDefinition(customYaml)
        } catch (err) {
          setError('Fehler beim Parsen der YAML-Definition')
          return
        }
      } else {
        // In a real app, you would fetch the template definition
        // For demo, we'll simulate predefined workflows
        const predefinedYaml =
          selectedTemplate === 'croissant_production'
            ? sampleYaml
            : `name: ${selectedTemplate}\nversion: 1.0`

        workflowDefinition = parseWorkflowDefinition(predefinedYaml)
      }

      const workflowPlan = generateWorkflowPlan(
        workflowDefinition,
        startDateTime
      )
      workflowPlan.product = product
      workflowPlan.batchSize = quantity
      workflowPlan.assignedTo =
        staff.find((s) => s.id === assignedTo)?.name || ''

      setWorkflowPreview(workflowPlan)
      setPreviewMode(true)
    } catch (error) {
      console.error('Error generating preview:', error)
      setError('Ein Fehler ist aufgetreten beim Erstellen der Vorschau')
    }
  }

  const handleBack = () => {
    setPreviewMode(false)
    setWorkflowPreview(null)
    setError(null)
  }

  const handleSubmit = () => {
    if (workflowPreview) {
      onSubmit(workflowPreview)
      onClose()
    } else {
      handlePreview()
    }
  }

  const handleTemplateChange = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    const value = event.target.value as string
    setSelectedTemplate(value)

    // Set default YAML for custom template
    if (value === 'custom' && !customYaml) {
      setCustomYaml(sampleYaml)
    }
  }

  // Initialize date and time if they're empty
  if (!startDate) {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    setStartDate(`${yyyy}-${mm}-${dd}`)

    const hours = String(today.getHours()).padStart(2, '0')
    const minutes = String(today.getMinutes()).padStart(2, '0')
    setStartTime(`${hours}:${minutes}`)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {previewMode
          ? 'Vorschau: Neuer Produktionsprozess'
          : 'Neuen Produktionsprozess erstellen'}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            {error}
          </Alert>
        )}

        {!previewMode ? (
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Vorlage auswählen</InputLabel>
                  <Select
                    value={selectedTemplate}
                    label="Vorlage auswählen"
                    onChange={(e) =>
                      setSelectedTemplate(e.target.value as string)
                    }
                  >
                    {templates.map((template) => (
                      <MenuItem key={template.id} value={template.id}>
                        {template.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Produkt"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="z.B. Butter Croissants"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Menge"
                  type="number"
                  InputProps={{ inputProps: { min: 1 } }}
                  value={quantity || ''}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  placeholder="Anzahl der Einheiten"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Verantwortlicher</InputLabel>
                  <Select
                    value={assignedTo}
                    label="Verantwortlicher"
                    onChange={(e) => setAssignedTo(e.target.value as string)}
                  >
                    {staff.map((person) => (
                      <MenuItem key={person.id} value={person.id}>
                        {person.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Datum"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Zeit"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {selectedTemplate === 'custom' && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Workflow Definition (YAML)
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={10}
                    value={customYaml}
                    onChange={(e) => setCustomYaml(e.target.value)}
                    placeholder="Geben Sie hier Ihre YAML-Definition ein"
                    variant="outlined"
                    sx={{ fontFamily: 'monospace' }}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: 'block' }}
                  >
                    Definieren Sie Ihren Workflow mit Schritten, Zeitangaben und
                    Bedingungen
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        ) : (
          <Box sx={{ pt: 2 }}>
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {workflowPreview.product}
              </Typography>
              <Divider sx={{ my: 1 }} />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Workflow
                  </Typography>
                  <Typography variant="body1">
                    {workflowPreview.name} v{workflowPreview.version}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Menge
                  </Typography>
                  <Typography variant="body1">
                    {workflowPreview.batchSize} Stk.
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Verantwortlich
                  </Typography>
                  <Typography variant="body1">
                    {workflowPreview.assignedTo}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Startzeit
                  </Typography>
                  <Typography variant="body1">
                    {startDate} um {startTime} Uhr
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            <Typography variant="h6" gutterBottom>
              Prozessschritte
            </Typography>
            {/* In a real app, you'd show a preview of the workflow steps */}
            <Box sx={{ mb: 2 }}>
              {workflowPreview.steps && workflowPreview.steps.length > 0 ? (
                workflowPreview.steps.map((step: any, index: number) => (
                  <Paper
                    key={index}
                    variant="outlined"
                    sx={{
                      p: 2,
                      mb: 1,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2">
                        {index + 1}. {step.name.replace(/_/g, ' ')}
                      </Typography>
                      {step.type === 'sleep' && (
                        <Chip
                          label="Ruhezeit"
                          size="small"
                          color="info"
                          sx={{ mr: 1 }}
                        />
                      )}
                      {step.duration && (
                        <Typography variant="body2" color="text.secondary">
                          Dauer: {step.duration}
                        </Typography>
                      )}
                    </Box>
                    <Chip label="Ausstehend" size="small" color="default" />
                  </Paper>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Keine Prozessschritte definiert
                </Typography>
              )}
            </Box>

            <Alert severity="info">
              Dies ist eine Vorschau des Workflows. Klicken Sie auf
              &apos;Erstellen&apos;, um den Prozess zu starten.
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {previewMode ? (
          <>
            <Button onClick={handleBack}>Zurück</Button>
            <Button onClick={handleSubmit} variant="contained">
              Produktionsprozess erstellen
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Abbrechen</Button>
            <Button onClick={handlePreview} variant="contained">
              Vorschau
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default WorkflowCreationForm
