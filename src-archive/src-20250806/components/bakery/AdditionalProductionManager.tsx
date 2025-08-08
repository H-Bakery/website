'use client'
import React, { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  Grid,
  Divider,
  Fab,
  Tooltip,
} from '@mui/material'
import {
  Add,
  Delete,
  Warning,
  PriorityHigh,
  Schedule,
  Assignment,
  BakeryDining,
  LocalDining,
  Error,
  CheckCircle,
} from '@mui/icons-material'
import { AdditionalProductionItem } from '../../types/prepTask'

interface AdditionalProductionManagerProps {
  items: AdditionalProductionItem[]
  onItemsChange: (items: AdditionalProductionItem[]) => void
  onAddFromStock?: (itemName: string, reason: string) => void
}

const AdditionalProductionManager: React.FC<
  AdditionalProductionManagerProps
> = ({ items, onItemsChange, onAddFromStock }) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newItem, setNewItem] = useState<Partial<AdditionalProductionItem>>({
    name: '',
    quantity: 1,
    unit: 'Stück',
    reason: 'low_stock',
    urgency: 'medium',
    category: 'pastry',
    notes: '',
  })

  const reasonLabels = {
    low_stock: 'Geringer Bestand',
    empty_stock: 'Bestand leer',
    special_order: 'Sonderbestellung',
    weekend_prep: 'Wochenendvorbereitung',
    other: 'Sonstiges',
  }

  const urgencyLabels = {
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
    critical: 'Kritisch',
  }

  const urgencyColors = {
    low: 'info',
    medium: 'warning',
    high: 'error',
    critical: 'error',
  } as const

  const categoryLabels = {
    pastry: 'Teigwaren',
    bread: 'Brot',
    cake: 'Kuchen',
    filling: 'Füllungen',
    dough: 'Teig',
  }

  const categoryIcons = {
    pastry: <BakeryDining />,
    bread: <BakeryDining />,
    cake: <LocalDining />,
    filling: <Assignment />,
    dough: <Assignment />,
  }

  const handleAddItem = () => {
    if (!newItem.name || !newItem.quantity) return

    const item: AdditionalProductionItem = {
      name: newItem.name!,
      quantity: newItem.quantity!,
      unit: newItem.unit || 'Stück',
      reason: newItem.reason!,
      urgency: newItem.urgency!,
      category: newItem.category!,
      notes: newItem.notes,
      requested_by: 'Aktuelle Schicht', // Should come from auth context
      requested_at: new Date().toLocaleTimeString('de-DE'),
    }

    onItemsChange([...items, item])
    setNewItem({
      name: '',
      quantity: 1,
      unit: 'Stück',
      reason: 'low_stock',
      urgency: 'medium',
      category: 'pastry',
      notes: '',
    })
    setDialogOpen(false)
  }

  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    onItemsChange(newItems)
  }

  const getUrgencyIcon = (urgency: AdditionalProductionItem['urgency']) => {
    switch (urgency) {
      case 'critical':
        return <Error color="error" />
      case 'high':
        return <PriorityHigh color="error" />
      case 'medium':
        return <Warning color="warning" />
      default:
        return <CheckCircle color="info" />
    }
  }

  const getTotalItemsByCategory = () => {
    const counts = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return counts
  }

  const getHighPriorityCount = () => {
    return items.filter(
      (item) => item.urgency === 'high' || item.urgency === 'critical'
    ).length
  }

  const categoryCounts = getTotalItemsByCategory()
  const highPriorityCount = getHighPriorityCount()

  // Quick add suggestions based on common low-stock items
  const quickAddSuggestions = [
    { name: 'Croissant', category: 'pastry', reason: 'low_stock' },
    { name: 'Schokocroissant', category: 'pastry', reason: 'low_stock' },
    { name: 'Brötchen', category: 'bread', reason: 'low_stock' },
    { name: 'Nougatplunder', category: 'pastry', reason: 'low_stock' },
    { name: 'Streuselschnecken', category: 'pastry', reason: 'low_stock' },
    { name: 'Apfelfüllung', category: 'filling', reason: 'low_stock' },
  ]

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assignment color="primary" />
            <Typography variant="h6">Zusätzliche Nachtproduktion</Typography>
            {highPriorityCount > 0 && (
              <Chip
                label={`${highPriorityCount} Dringend`}
                color="error"
                size="small"
                icon={<Warning />}
              />
            )}
          </Box>
        }
        subheader={
          <Typography variant="body2" color="text.secondary">
            Artikel die während der Nachtschicht zusätzlich produziert werden
            sollen
          </Typography>
        }
        action={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setDialogOpen(true)}
            size="small"
          >
            Hinzufügen
          </Button>
        }
      />

      <CardContent>
        {items.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Noch keine zusätzlichen Produktionsaufträge. Klicken Sie auf
              "Hinzufügen" wenn Artikel nachproduziert werden müssen.
            </Typography>
          </Alert>
        ) : (
          <>
            {/* Summary Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Box
                  sx={{
                    textAlign: 'center',
                    p: 2,
                    bgcolor: 'background.default',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="h4" color="primary">
                    {items.length}
                  </Typography>
                  <Typography variant="caption">Artikel gesamt</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box
                  sx={{
                    textAlign: 'center',
                    p: 2,
                    bgcolor: 'background.default',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="h4" color="error">
                    {highPriorityCount}
                  </Typography>
                  <Typography variant="caption">Hohe Priorität</Typography>
                </Box>
              </Grid>
              {Object.entries(categoryCounts)
                .slice(0, 2)
                .map(([category, count]) => (
                  <Grid item xs={12} sm={6} md={3} key={category}>
                    <Box
                      sx={{
                        textAlign: 'center',
                        p: 2,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="h4" color="secondary">
                        {count}
                      </Typography>
                      <Typography variant="caption">
                        {
                          categoryLabels[
                            category as keyof typeof categoryLabels
                          ]
                        }
                      </Typography>
                    </Box>
                  </Grid>
                ))}
            </Grid>

            {/* Production Items List */}
            <List>
              {items
                .sort((a, b) => {
                  // Sort by urgency first, then by category
                  const urgencyOrder = {
                    critical: 0,
                    high: 1,
                    medium: 2,
                    low: 3,
                  }
                  const urgencyDiff =
                    urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
                  if (urgencyDiff !== 0) return urgencyDiff
                  return a.category.localeCompare(b.category)
                })
                .map((item, index) => (
                  <ListItem
                    key={index}
                    sx={{
                      border: 1,
                      borderColor:
                        item.urgency === 'critical'
                          ? 'error.main'
                          : item.urgency === 'high'
                          ? 'warning.main'
                          : 'divider',
                      borderRadius: 1,
                      mb: 1,
                      bgcolor:
                        item.urgency === 'critical'
                          ? 'error.light'
                          : item.urgency === 'high'
                          ? 'warning.light'
                          : 'background.paper',
                      '&:hover': {
                        bgcolor:
                          item.urgency === 'critical'
                            ? 'error.light'
                            : item.urgency === 'high'
                            ? 'warning.light'
                            : 'action.hover',
                      },
                    }}
                  >
                    <Box sx={{ mr: 2 }}>{categoryIcons[item.category]}</Box>
                    <ListItemText
                      primary={
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 600 }}
                          >
                            {item.name}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${item.quantity} ${item.unit}`}
                            color="primary"
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            label={urgencyLabels[item.urgency]}
                            color={urgencyColors[item.urgency]}
                            icon={getUrgencyIcon(item.urgency)}
                          />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Grund:</strong> {reasonLabels[item.reason]}{' '}
                            |<strong> Kategorie:</strong>{' '}
                            {categoryLabels[item.category]}
                            {item.requested_by && (
                              <span>
                                {' '}
                                | <strong>Angefordert von:</strong>{' '}
                                {item.requested_by} um {item.requested_at}
                              </span>
                            )}
                          </Typography>
                          {item.notes && (
                            <Typography
                              variant="body2"
                              sx={{ mt: 0.5, fontStyle: 'italic' }}
                            >
                              <strong>Notizen:</strong> {item.notes}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleDeleteItem(index)}
                        color="error"
                        size="small"
                      >
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
            </List>
          </>
        )}

        {/* Quick Add Suggestions */}
        {items.length < 3 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Häufig nachzuproduzierende Artikel:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {quickAddSuggestions.map((suggestion, index) => (
                <Chip
                  key={index}
                  label={suggestion.name}
                  onClick={() => {
                    setNewItem({
                      ...newItem,
                      name: suggestion.name,
                      category: suggestion.category as any,
                      reason: suggestion.reason as any,
                    })
                    setDialogOpen(true)
                  }}
                  variant="outlined"
                  size="small"
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>
        )}
      </CardContent>

      {/* Add Item Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Zusätzlichen Produktionsauftrag hinzufügen</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Artikelname"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              fullWidth
              required
            />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Menge"
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) =>
                    setNewItem({ ...newItem, quantity: Number(e.target.value) })
                  }
                  fullWidth
                  required
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Einheit"
                  value={newItem.unit}
                  onChange={(e) =>
                    setNewItem({ ...newItem, unit: e.target.value })
                  }
                  fullWidth
                />
              </Grid>
            </Grid>

            <FormControl fullWidth>
              <InputLabel>Grund</InputLabel>
              <Select
                value={newItem.reason}
                onChange={(e) =>
                  setNewItem({ ...newItem, reason: e.target.value as any })
                }
                label="Grund"
              >
                {Object.entries(reasonLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Dringlichkeit</InputLabel>
              <Select
                value={newItem.urgency}
                onChange={(e) =>
                  setNewItem({ ...newItem, urgency: e.target.value as any })
                }
                label="Dringlichkeit"
              >
                {Object.entries(urgencyLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getUrgencyIcon(value as any)}
                      {label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Kategorie</InputLabel>
              <Select
                value={newItem.category}
                onChange={(e) =>
                  setNewItem({ ...newItem, category: e.target.value as any })
                }
                label="Kategorie"
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {categoryIcons[value as keyof typeof categoryIcons]}
                      {label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Zusätzliche Notizen"
              value={newItem.notes}
              onChange={(e) =>
                setNewItem({ ...newItem, notes: e.target.value })
              }
              fullWidth
              multiline
              rows={2}
              placeholder="z.B. Spezielle Anweisungen, Grund für die Nachproduktion..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Abbrechen</Button>
          <Button
            onClick={handleAddItem}
            variant="contained"
            disabled={!newItem.name || !newItem.quantity}
          >
            Hinzufügen
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

export default AdditionalProductionManager
