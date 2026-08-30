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
  TextField,
} from '@mui/material'
import {
  CheckCircle,
  RadioButtonUnchecked,
  Kitchen,
  Warning,
  Add,
  ExpandMore,
} from '@mui/icons-material'
import {
  PrepSection,
  PrepTaskItem,
  AdditionalProductionItem,
} from '../../types/prepTask'

interface EnhancedPrepTaskCardProps {
  section: PrepSection
  sectionIndex: number
  isExpanded: boolean
  editMode: boolean
  onToggleSectionCompletion: (sectionIndex: number) => void
  onToggleItemCompletion: (sectionIndex: number, itemIndex: number) => void
  onToggleSectionExpanded: (sectionIndex: number) => void
  onUpdateItemQuantity: (
    sectionIndex: number,
    itemIndex: number,
    newQuantity: number
  ) => void
  onAddToProduction: (
    itemName: string,
    reason: AdditionalProductionItem['reason']
  ) => void
}

const EnhancedPrepTaskCard: React.FC<EnhancedPrepTaskCardProps> = ({
  section,
  sectionIndex,
  isExpanded,
  editMode,
  onToggleSectionCompletion,
  onToggleItemCompletion,
  onToggleSectionExpanded,
  onUpdateItemQuantity,
  onAddToProduction,
}) => {
  const calculateSectionProgress = (): number => {
    if (!section.items) return section.completed ? 100 : 0
    const totalItems = section.items.length
    const completedItems = section.items.filter((item) => item.completed).length
    return (completedItems / totalItems) * 100
  }

  const formatTrayInfo = (item: PrepTaskItem): string => {
    if (item.tray_numbers && item.trays_of) {
      return `${item.tray_numbers.length} Bleche à ${
        item.trays_of
      } (Blech ${item.tray_numbers.join(', ')})`
    }
    return `Blech ${item.tray_number}`
  }

  const getStockStatusLabel = (
    status?: PrepTaskItem['stock_status']
  ): string => {
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

  const sectionProgress = calculateSectionProgress()

  return (
    <Card
      sx={{
        mb: 2,
        border: section.completed ? '2px solid' : '1px solid',
        borderColor: section.completed ? 'success.main' : 'divider',
        boxShadow: section.completed ? 3 : 1,
        transition: 'all 0.3s ease',
      }}
    >
      <CardHeader
        avatar={
          <IconButton
            onClick={() => onToggleSectionCompletion(sectionIndex)}
            sx={{
              bgcolor: section.completed ? 'success.main' : 'transparent',
              '&:hover': {
                bgcolor: section.completed ? 'success.dark' : 'action.hover',
              },
            }}
          >
            {section.completed ? (
              <CheckCircle
                color="inherit"
                sx={{ color: 'success.contrastText' }}
              />
            ) : (
              <RadioButtonUnchecked />
            )}
          </IconButton>
        }
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="h6"
              sx={{
                textDecoration: section.completed ? 'line-through' : 'none',
              }}
            >
              {section.name}
            </Typography>
            {section.completed && (
              <Chip
                size="small"
                label="Fertig"
                color="success"
                variant="filled"
              />
            )}
            {section.time_completed && (
              <Chip
                size="small"
                label={`${section.time_completed}`}
                color="success"
                variant="outlined"
              />
            )}
          </Box>
        }
        subheader={section.description}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ minWidth: 120, textAlign: 'center' }}>
              <Typography variant="caption" display="block">
                {Math.round(sectionProgress)}% abgeschlossen
              </Typography>
              <LinearProgress
                variant="determinate"
                value={sectionProgress}
                sx={{
                  width: 100,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: section.completed
                      ? 'success.main'
                      : 'primary.main',
                  },
                }}
              />
            </Box>
            <IconButton onClick={() => onToggleSectionExpanded(sectionIndex)}>
              <ExpandMore
                sx={{
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s',
                }}
              />
            </IconButton>
          </Box>
        }
      />

      {isExpanded && (
        <CardContent>
          {section.instructions && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Anweisungen:
              </Typography>
              {section.instructions.map((instruction, idx) => (
                <Typography key={idx} variant="body2">
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
                title="Zutaten"
                avatar={<Kitchen color="primary" />}
                titleTypographyProps={{
                  variant: 'h6',
                  color: 'primary.main',
                }}
              />
              <CardContent>
                <Grid container spacing={1}>
                  {section.ingredients.map((ingredient, idx) => (
                    <Grid item xs={12} sm={6} md={4} key={idx}>
                      <Chip
                        label={`${ingredient.quantity}${ingredient.unit} ${ingredient.name}`}
                        variant="filled"
                        size="small"
                        color="primary"
                      />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          )}

          {section.items && (
            <List sx={{ bgcolor: 'background.default', borderRadius: 2, p: 1 }}>
              {section.items.map((item, itemIndex) => (
                <ListItem
                  key={itemIndex}
                  sx={{
                    bgcolor: item.completed
                      ? 'success.light'
                      : 'background.paper',
                    borderRadius: 1,
                    mb: 1,
                    border: 1,
                    borderColor: item.completed ? 'success.main' : 'divider',
                    boxShadow: 1,
                    transition: 'all 0.2s ease',
                    '&:hover': { boxShadow: 2 },
                  }}
                >
                  <ListItemIcon>
                    <Checkbox
                      checked={item.completed || false}
                      onChange={() =>
                        onToggleItemCompletion(sectionIndex, itemIndex)
                      }
                      color="success"
                      sx={{
                        '&.Mui-checked': {
                          color: 'success.main',
                        },
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primaryTypographyProps={{ component: 'div' }}
                    secondaryTypographyProps={{ component: 'div' }}
                    primary={
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <Typography
                          component="span"
                          variant="body1"
                          fontWeight={item.completed ? 400 : 600}
                          sx={{
                            textDecoration: item.completed
                              ? 'line-through'
                              : 'none',
                            opacity: item.completed ? 0.7 : 1,
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
                                item.stock_status === 'critical' ||
                                item.stock_status === 'empty'
                                  ? 'error'
                                  : item.stock_status === 'low'
                                  ? 'warning'
                                  : 'default'
                              }
                              variant="filled"
                            />
                          )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.secondary"
                          display="block"
                        >
                          {formatTrayInfo(item)}
                        </Typography>
                        {item.current_stock !== undefined && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              mt: 0.5,
                            }}
                          >
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                            >
                              Bestand: {item.current_stock}{' '}
                              {item.unit || 'Stück'}
                            </Typography>
                            {item.min_stock_level && (
                              <Typography
                                component="span"
                                variant="caption"
                                color="text.secondary"
                              >
                                (Min: {item.min_stock_level})
                              </Typography>
                            )}
                            {(item.stock_status === 'low' ||
                              item.stock_status === 'critical' ||
                              item.stock_status === 'empty') && (
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() =>
                                  onAddToProduction(
                                    item.name,
                                    item.stock_status === 'empty'
                                      ? 'empty_stock'
                                      : 'low_stock'
                                  )
                                }
                                sx={{ ml: 1 }}
                                title="Zur Produktion hinzufügen"
                              >
                                <Add />
                              </IconButton>
                            )}
                          </Box>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      {editMode ? (
                        <TextField
                          size="small"
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            onUpdateItemQuantity(
                              sectionIndex,
                              itemIndex,
                              parseInt(e.target.value) || 0
                            )
                          }
                          sx={{ width: 80 }}
                          inputProps={{ min: 0, max: 999 }}
                        />
                      ) : (
                        <Chip
                          label={`${item.quantity}${item.unit || ''}`}
                          size="medium"
                          color={item.completed ? 'success' : 'primary'}
                          variant={item.completed ? 'filled' : 'outlined'}
                          sx={{ fontWeight: 600 }}
                        />
                      )}
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
      )}
    </Card>
  )
}

export default EnhancedPrepTaskCard
