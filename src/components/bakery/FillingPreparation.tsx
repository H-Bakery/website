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
} from '../../utils/productionCalculator'

interface FillingIngredient {
  [ingredient: string]: number | string
}

interface FillingIngredients {
  [fillingType: string]: FillingIngredient
}

// Define interface for production plan structure
interface FillingBatches {
  [key: string]: number
}

interface Fillings {
  [key: string]: number
}

interface Calculator {
  recipes: {
    [product: string]: {
      filling: string
      // Add other properties as needed
    }
  }
}

interface ProductionPlan {
  fillingBatches: FillingBatches
  fillings: Fillings
  calculator?: Calculator
  // Add other properties that might exist in productionPlan
}

interface FillingPreparationProps {
  productionPlan: ProductionPlan
  orders: ProductOrder
  onOrderChange: (product: string, quantity: number) => void
}

const FILLING_INGREDIENTS: FillingIngredients = {
  nuss: {
    'Gemahlene Haselnüsse': 500,
    Zucker: 300,
    Butter: 250,
    Zimtpulver: 15,
    Eigelb: 2,
  },
  schoko: {
    'Schokolade (Zartbitter)': 400,
    Butter: 200,
    Zucker: 150,
    Kakao: 50,
    Sahne: 100,
  },
  pudding: {
    'Puddingpulver (Vanille)': 80,
    Zucker: 150,
    Milch: 500,
    Butter: 100,
    Vanillezucker: 16,
  },
  marzipan: {
    Marzipanrohmasse: 450,
    Zucker: 100,
    Butter: 100,
    Ei: 1,
    'Geriebene Zitronenschale': 5,
  },
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
    .filter(([_, batches]) => (batches as number) > 0)
    .map(([filling, _]) => filling)

  const getIngredientsForFilling = (
    filling: string,
    batches: number
  ): FillingIngredient => {
    // Check if the filling exists in our definitions
    if (!FILLING_INGREDIENTS[filling]) {
      return {}
    }

    const baseIngredients = FILLING_INGREDIENTS[filling]
    const scaledIngredients: FillingIngredient = {}

    Object.entries(baseIngredients).forEach(([ingredient, amount]) => {
      if (typeof amount === 'number') {
        scaledIngredients[ingredient] = Math.round(amount * batches)
      } else if (typeof amount === 'string') {
        // For string values, append the quantity in parentheses or use a different approach
        scaledIngredients[ingredient] = `${amount} (×${batches})`
        // Or if these are actually numeric strings, you could convert and multiply:
        // scaledIngredients[ingredient] = String(Number(amount) * batches);
      } else {
        // For any other type, just use as is
        scaledIngredients[ingredient] = amount
      }
    })

    return scaledIngredients
  }

  const handleFillingClick = (filling: string) => {
    setSelectedFilling(filling === selectedFilling ? null : filling)
  }

  // Find all products that use this filling
  const getProductsWithFilling = (filling: string) => {
    const calculator = productionPlan.calculator || { recipes: {} }

    return Object.entries(calculator.recipes)
      .filter(([_, recipe]) => recipe.filling === filling)
      .map(([product, _]) => product)
  }

  // Adjust product quantity (which affects filling needed)
  const handleProductAdjust = (product: string, change: number) => {
    const currentQuantity = orders[product] || 0
    const newQuantity = Math.max(0, currentQuantity + change)
    onOrderChange(product, newQuantity)
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
                        {productionPlan.fillingBatches[filling]} Charge(n) (
                        {(productionPlan.fillings[filling] / 1000).toFixed(1)}{' '}
                        kg)
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
                <Typography variant="h6" gutterBottom>
                  {formatFillingName(selectedFilling)} - Zutaten
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
                    ).map(([ingredient, amount]) => (
                      <TableRow key={ingredient}>
                        <TableCell>{ingredient}</TableCell>
                        <TableCell align="right">
                          {typeof amount === 'number'
                            ? amount >= 1000
                              ? `${(amount / 1000).toFixed(1)} kg`
                              : `${amount} g`
                            : `${amount} Stk`}
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
                            (acc: { [key: string]: number }, filling) => {
                              const ingredients = getIngredientsForFilling(
                                filling,
                                productionPlan.fillingBatches[filling]
                              )

                              Object.entries(ingredients).forEach(
                                ([ing, amt]) => {
                                  if (typeof amt === 'number') {
                                    acc[ing] = (acc[ing] || 0) + amt
                                  }
                                }
                              )

                              return acc
                            },
                            {}
                          )
                        ).map(([ingredient, amount]) => (
                          <TableRow key={ingredient}>
                            <TableCell>{ingredient}</TableCell>
                            <TableCell align="right">
                              {typeof amount === 'number'
                                ? amount >= 1000
                                  ? `${(amount / 1000).toFixed(1)} kg`
                                  : `${amount} g`
                                : `${amount} Stk`}
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
