'use client'
import React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Chip,
  IconButton,
  Typography,
  LinearProgress,
  Alert,
  Box,
  Grid,
} from '@mui/material'
import {
  CheckCircle,
  RadioButtonUnchecked,
  Kitchen,
  Warning,
  ErrorOutline,
  Add,
  Inventory,
} from '@mui/icons-material'
import { PrepSection, PrepTaskItem } from '../../types/prepTask'

interface PrepTaskCardProps {
  section: PrepSection
  sectionIndex: number
  onToggleSection: (sectionIndex: number) => void
  onToggleItem: (sectionIndex: number, itemIndex: number) => void
  onAddToProduction?: (itemName: string, reason: string) => void
}

const PrepTaskCard: React.FC<PrepTaskCardProps> = ({
  section,
  sectionIndex,
  onToggleSection,
  onToggleItem,
  onAddToProduction,
}) => {
  const calculateSectionProgress = () => {
    if (!section.items) return section.completed ? 100 : 0
    const totalItems = section.items.length
    const completedItems = section.items.filter((item) => item.completed).length
    return (completedItems / totalItems) * 100
  }

  const formatTrayInfo = (item: PrepTaskItem) => {
    if (item.tray_numbers && item.trays_of) {
      return `${item.tray_numbers.length} Bleche à ${
        item.trays_of
      } (Blech ${item.tray_numbers.join(', ')})`
    }
    return `Blech ${item.tray_number}`
  }

  const getTimeEstimate = () => {
    // Estimate time based on number of items and complexity
    const baseTime = section.items ? section.items.length * 2 : 10 // 2 minutes per item
    const complexityBonus = section.ingredients ? 10 : 0 // Extra time for mixing
    return Math.max(5, baseTime + complexityBonus) // Minimum 5 minutes
  }

  const getStockStatusColor = (status?: PrepTaskItem['stock_status']) => {
    switch (status) {
      case 'critical':
        return 'error'
      case 'low':
        return 'warning'
      case 'empty':
        return 'error'
      default:
        return 'success'
    }
  }

  const getStockStatusLabel = (status?: PrepTaskItem['stock_status']) => {
    switch (status) {
      case 'critical':
        return 'Kritisch'
      case 'low':
        return 'Niedrig'
      case 'empty':
        return 'Leer'
      case 'sufficient':
        return 'Ausreichend'
      default:
        return 'Unbekannt'
    }
  }

  const getStockStatusIcon = (status?: PrepTaskItem['stock_status']) => {
    switch (status) {
      case 'critical':
      case 'empty':
        return <ErrorOutline />
      case 'low':
        return <Warning />
      default:
        return <Inventory />
    }
  }

  return (
    <Card
      sx={{
        mb: 2,
        border: section.completed ? '2px solid' : '1px solid',
        borderColor: section.completed ? 'success.main' : 'divider',
        boxShadow: section.completed ? 3 : 1,
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: 4,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardHeader
        avatar={
          <IconButton
            onClick={() => onToggleSection(sectionIndex)}
            sx={{
              p: 0.5,
              bgcolor: section.completed ? 'success.light' : 'transparent',
              '&:hover': {
                bgcolor: section.completed ? 'success.main' : 'action.hover',
              },
            }}
          >
            {section.completed ? (
              <CheckCircle color="success" />
            ) : (
              <RadioButtonUnchecked color="action" />
            )}
          </IconButton>
        }
        title={
          <Typography
            variant="h6"
            sx={{
              textDecoration: section.completed ? 'line-through' : 'none',
              opacity: section.completed ? 0.7 : 1,
              fontWeight: 600,
            }}
          >
            {section.name}
          </Typography>
        }
        subheader={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {section.description}
            </Typography>
            <Chip
              label={`~${getTimeEstimate()} Min`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {section.time_completed && (
              <Chip
                label={`Fertig: ${section.time_completed}`}
                size="small"
                color="success"
              />
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearProgress
                variant="determinate"
                value={calculateSectionProgress()}
                sx={{
                  width: 80,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(0,0,0,0.1)',
                }}
                color={section.completed ? 'success' : 'primary'}
              />
              <Typography variant="caption" sx={{ minWidth: 35 }}>
                {Math.round(calculateSectionProgress())}%
              </Typography>
            </Box>
          </Box>
        }
        sx={{
          bgcolor: section.completed ? 'success.light' : 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      />

      <CardContent>
        {section.instructions && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Anweisungen:
            </Typography>
            {section.instructions.map((instruction, idx) => (
              <Typography key={idx} variant="body2" sx={{ mb: 0.5 }}>
                • {instruction}
              </Typography>
            ))}
          </Alert>
        )}

        {section.ingredients && (
          <Card
            variant="outlined"
            sx={{ mb: 2, bgcolor: 'background.default' }}
          >
            <CardHeader
              avatar={<Kitchen color="primary" />}
              title="Zutaten"
              titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
              sx={{ pb: 1 }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Grid container spacing={1}>
                {section.ingredients.map((ingredient, idx) => (
                  <Grid item xs={12} sm={6} md={4} key={idx}>
                    <Chip
                      label={`${ingredient.quantity}${ingredient.unit} ${ingredient.name}`}
                      variant="outlined"
                      size="small"
                      sx={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        fontFamily: 'monospace',
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}

        {section.items && (
          <List sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
            {section.items.map((item, itemIndex) => (
              <ListItem
                key={itemIndex}
                sx={{
                  bgcolor: item.completed ? 'action.selected' : 'transparent',
                  borderRadius: 1,
                  mb: 0.5,
                  border: item.completed
                    ? '1px solid'
                    : '1px solid transparent',
                  borderColor: item.completed ? 'success.main' : 'transparent',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: item.completed
                      ? 'action.selected'
                      : 'action.hover',
                  },
                }}
              >
                <ListItemIcon>
                  <Checkbox
                    checked={item.completed || false}
                    onChange={() => onToggleItem(sectionIndex, itemIndex)}
                    color="primary"
                    sx={{
                      transform: 'scale(1.1)',
                      '&.Mui-checked': {
                        color: 'success.main',
                      },
                    }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        sx={{
                          textDecoration: item.completed
                            ? 'line-through'
                            : 'none',
                          opacity: item.completed ? 0.7 : 1,
                          fontWeight: item.completed ? 400 : 500,
                          flexGrow: 1,
                        }}
                      >
                        {item.name}
                      </Typography>
                      {item.stock_status &&
                        item.stock_status !== 'sufficient' && (
                          <Chip
                            size="small"
                            label={getStockStatusLabel(item.stock_status)}
                            color={
                              getStockStatusColor(item.stock_status) as any
                            }
                            icon={getStockStatusIcon(item.stock_status)}
                            variant="outlined"
                          />
                        )}
                      {item.needs_production && (
                        <Chip
                          size="small"
                          label="Nachproduzieren"
                          color="info"
                          variant="filled"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {formatTrayInfo(item)}
                      </Typography>
                      {item.current_stock !== undefined && (
                        <Typography variant="caption" color="text.secondary">
                          Aktueller Bestand: {item.current_stock}{' '}
                          {item.unit || 'Stück'}
                          {item.min_stock_level &&
                            ` (Min: ${item.min_stock_level})`}
                        </Typography>
                      )}
                      {item.production_notes && (
                        <Typography
                          variant="caption"
                          sx={{ display: 'block', fontStyle: 'italic' }}
                        >
                          Notiz: {item.production_notes}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {(item.stock_status === 'low' ||
                      item.stock_status === 'critical' ||
                      item.stock_status === 'empty') &&
                      onAddToProduction && (
                        <IconButton
                          size="small"
                          onClick={() =>
                            onAddToProduction(
                              item.name,
                              item.stock_status === 'empty'
                                ? 'empty_stock'
                                : 'low_stock'
                            )
                          }
                          color="primary"
                          sx={{ mr: 1 }}
                        >
                          <Add />
                        </IconButton>
                      )}
                    <Chip
                      label={`${item.quantity}${item.unit || ''}`}
                      size="small"
                      color={item.completed ? 'success' : 'default'}
                      variant={item.completed ? 'filled' : 'outlined'}
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}

        {section.final_step && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              <Warning sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Abschließender Schritt:
                </Typography>
                <Typography variant="body2">{section.final_step}</Typography>
              </Box>
            </Box>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

export default PrepTaskCard
