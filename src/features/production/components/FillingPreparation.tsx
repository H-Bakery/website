'use client'
import React, { useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  Card,
  CardContent,
  TextField,
  IconButton,
  Slider,
  Chip,
  Table,
  TableBody,
  TableRow,
  TableCell,
  FormControlLabel,
  Switch,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import {
  ProductOrder,
  formatFillingName,
  HefezopfCalculator,
} from '../utils/productionCalculator'
import { getFillingById } from '../data/fillings'

interface ProductionPlan {
  fillingBatches: { [key: string]: number }
  fillings: { [key: string]: number }
  calculator?: HefezopfCalculator
  // Add other properties that might exist in productionPlan
}

interface FillingPreparationProps {
  productionPlan: ProductionPlan
  orders: ProductOrder
  onOrderChange: (product: string, quantity: number) => void
}

const FillingPreparation: React.FC<FillingPreparationProps> = ({
  productionPlan,
  orders,
  onOrderChange,
}) => {
  const [selectedFilling, setSelectedFilling] = useState<string | null>(null)
  const [showAllIngredients, setShowAllIngredients] = useState(false)

  // Extract fillings that are needed
  const neededFillings = Object.entries(productionPlan.fillingBatches)
    .filter(([_, batches]) => batches > 0)
    .map(([filling, _]) => filling)

  const getIngredientsForFilling = (
    fillingId: string,
    batches: number
  ): { [ingredient: string]: { amount: number; unit: string } } => {
    const filling = getFillingById(fillingId)
    if (!filling) return {}

    const scaledIngredients: { [ingredient: string]: { amount: number; unit: string } } = {}
    
    // 15kg pro Batch (15000g)
    const batchSizeInGrams = 15000
    
    // Berechne wie viele Rezept-Durchgänge erforderlich sind
    const recipeMultiplier = (batches * batchSizeInGrams) / filling.recipeBatchSize
    
    filling.ingredients.forEach((ingredient) => {
      scaledIngredients[ingredient.name] = {
        amount: Math.round(ingredient.amount * recipeMultiplier),
        unit: ingredient.unit,
      }
    })

    return scaledIngredients
  }

  const handleFillingClick = (filling: string) => {
    setSelectedFilling(filling === selectedFilling ? null : filling)
  }

  // Find all products that use this filling
  const getProductsWithFilling = (filling: string) => {
    if (!productionPlan.calculator) return []
    
    return productionPlan.calculator.getProductsWithFilling(filling)
  }

  // Adjust product quantity (which affects filling needed)
  const handleProductAdjust = (product: string, change: number) => {
    const currentQuantity = orders[product] || 0
    const newQuantity = Math.max(0, currentQuantity + change)
    onOrderChange(product, newQuantity)
  }

  const formatAmount = (amount: number, unit: string): string => {
    if (unit === 'g') {
      return amount >= 1000 ? `${(amount / 1000).toFixed(1)} kg` : `${amount} g`
    } else if (unit === 'ml') {
      return amount >= 1000 ? `${(amount / 1000).toFixed(1)} l` : `${amount} ml`
    } else {
      return `${amount} ${unit}`
    }
  }

  return (
    <Box className="filling-preparation">
      <Typography variant="h6" gutterBottom>
        Füllungen für Samstagsproduktion
      </Typography>

      {neededFillings.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography>
            Keine Füllungen für diesen Produktionsplan benötigt.
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Filling cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {neededFillings.map((filling) => (
              <Grid item xs={12} key={filling}>
                <Paper
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border:
                      selectedFilling === filling
                        ? '2px solid #1976d2' // Use a specific color value
                        : 'none',
                  }}
                  onClick={() => handleFillingClick(filling)}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Box>
                      <Typography variant="h6">
                        {formatFillingName(filling)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {productionPlan.fillingBatches[filling]} Charge(n) à 15kg (
                        {(productionPlan.fillings[filling] / 1000).toFixed(1)}{' '}
                        kg gesamt)
                      </Typography>
                    </Box>
                    <Chip
                      label={
                        selectedFilling === filling ? 'Ausgewählt' : 'Details'
                      }
                      color={
                        selectedFilling === filling ? 'primary' : 'default'
                      }
                      size="small"
                    />
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* Details for selected filling */}
          {selectedFilling && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  {formatFillingName(selectedFilling)} - Zutaten (15kg pro Charge)
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={showAllIngredients}
                      onChange={(e) => setShowAllIngredients(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Alle Füllungen anzeigen"
                />

                <Divider sx={{ my: 2 }} />

                <Table size="small">
                  <TableBody>
                    {Object.entries(
                      getIngredientsForFilling(
                        selectedFilling,
                        productionPlan.fillingBatches[selectedFilling]
                      )
                    ).map(([ingredient, details]) => (
                      <TableRow key={ingredient}>
                        <TableCell>{ingredient}</TableCell>
                        <TableCell align="right">
                          {formatAmount(details.amount, details.unit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {showAllIngredients && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Alle Füllungen kombiniert:
                    </Typography>

                    <Table size="small">
                      <TableBody>
                        {Object.entries(
                          neededFillings.reduce(
                            (acc: { [key: string]: { amount: number; unit: string } }, filling) => {
                              const ingredients = getIngredientsForFilling(
                                filling,
                                productionPlan.fillingBatches[filling]
                              )

                              Object.entries(ingredients).forEach(
                                ([ing, details]) => {
                                  if (!acc[ing]) {
                                    acc[ing] = { ...details }
                                  } else if (acc[ing].unit === details.unit) {
                                    acc[ing].amount += details.amount
                                  }
                                }
                              )

                              return acc
                            },
                            {}
                          )
                        ).map(([ingredient, details]) => (
                          <TableRow key={ingredient}>
                            <TableCell>{ingredient}</TableCell>
                            <TableCell align="right">
                              {formatAmount(details.amount, details.unit)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Produkte mit dieser Füllung:
                </Typography>

                <List disablePadding>
                  {getProductsWithFilling(selectedFilling).map((product) => (
                    <ListItem key={product} disablePadding sx={{ mb: 1 }}>
                      <Paper
                        sx={{
                          p: 1,
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <ListItemText
                          primary={product}
                          secondary={`Aktuell: ${orders[product] || 0} Stk`}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <Box>
                          <IconButton
                            size="small"
                            onClick={() => handleProductAdjust(product, -1)}
                            disabled={(orders[product] || 0) <= 0}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleProductAdjust(product, 1)}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Paper>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  )
}

export default FillingPreparation