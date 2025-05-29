'use client'
import React, { useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Divider,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Card,
  CardContent,
  TextField,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SaveIcon from '@mui/icons-material/Save'
import PrintIcon from '@mui/icons-material/Print'
import {
  HefezopfCalculator,
  ProductOrder,
  formatFillingName,
} from '../../utils/productionCalculator'

// Define interfaces for type safety
interface FillingBatches {
  [key: string]: number
}

interface Fillings {
  [key: string]: number
}

interface DoughPieces {
  [size: string]: number
}

interface Recipe {
  doughPerPiece: number
  filling?: string
  fillingAmount?: number
}

interface ProductionPlan {
  doughBatches: number
  totalDoughWeight: number
  doughPieces: DoughPieces
  fillingBatches: FillingBatches
  fillings: Fillings
}

interface SaturdayProductionDashboardProps {
  orders: ProductOrder
  onOrderChange: (product: string, quantity: number) => void
  date: string
}

const SaturdayProductionDashboard: React.FC<
  SaturdayProductionDashboardProps
> = ({ orders, onOrderChange, date }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const calculator = new HefezopfCalculator()
  const productionPlan = calculator.calculateProductionNeeds(orders)

  const handleQuantityChange = (product: string, newValue: string) => {
    const quantity = parseInt(newValue, 10) || 0
    if (quantity >= 0) {
      onOrderChange(product, quantity)
    }
  }

  const handleIncrement = (product: string) => {
    const currentQuantity = orders[product] || 0
    onOrderChange(product, currentQuantity + 1)
  }

  const handleDecrement = (product: string) => {
    const currentQuantity = orders[product] || 0
    if (currentQuantity > 0) {
      onOrderChange(product, currentQuantity - 1)
    }
  }

  const handleSavePlan = () => {
    // Save to localStorage
    localStorage.setItem(
      `bakery-plan-${date}`,
      JSON.stringify({
        orders,
        plan: productionPlan,
        date,
      })
    )

    alert('Produktionsplan gespeichert!')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Box className="production-dashboard">
      {/* Action buttons */}
      <Box
        sx={{
          mb: 2,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
        }}
      >
        <IconButton
          onClick={handleSavePlan}
          color="primary"
          aria-label="Plan speichern"
          size={isMobile ? 'small' : 'medium'}
        >
          <SaveIcon />
        </IconButton>
        <IconButton
          onClick={handlePrint}
          color="secondary"
          aria-label="Plan drucken"
          size={isMobile ? 'small' : 'medium'}
        >
          <PrintIcon />
        </IconButton>
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6}>
          <Paper
            sx={{
              p: 2,
              textAlign: 'center',
              bgcolor: 'primary.main',
              color: 'white',
            }}
          >
            <Typography variant="h4">{productionPlan.doughBatches}</Typography>
            <Typography variant="body2">Teigchargen</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6}>
          <Paper
            sx={{
              p: 2,
              textAlign: 'center',
              bgcolor: 'secondary.main',
              color: 'white',
            }}
          >
            <Typography variant="h4">
              {(productionPlan.totalDoughWeight / 1000).toFixed(1)} kg
            </Typography>
            <Typography variant="body2">Gesamtgewicht</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Order quantities - editable */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">Bestellmengen anpassen</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={1}>
            {Object.entries(calculator.recipes).map(([product, recipe]) => (
              <Grid item xs={12} key={product}>
                <Paper sx={{ p: 1.5, display: 'flex', alignItems: 'center' }}>
                  <Box flexGrow={1}>
                    <Typography variant="body1">{product}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {recipe.doughPerPiece}g Teig
                      {recipe.filling &&
                        ` + ${recipe.fillingAmount}g ${formatFillingName(
                          recipe.filling
                        )}`}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton
                      size="small"
                      onClick={() => handleDecrement(product)}
                      aria-label={`${product} verringern`}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                    <TextField
                      value={orders[product] || 0}
                      onChange={(e) =>
                        handleQuantityChange(product, e.target.value)
                      }
                      inputProps={{
                        min: 0,
                        style: {
                          textAlign: 'center',
                          width: '40px',
                          padding: '8px 4px',
                        },
                      }}
                      variant="outlined"
                      size="small"
                      aria-label={`${product} Menge`}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleIncrement(product)}
                      aria-label={`${product} erhöhen`}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Dough preparation section */}
      <Accordion defaultExpanded sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">Hefeteigproduktion</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Teigchargen ({productionPlan.doughBatches}):
                  </Typography>

                  {Array(productionPlan.doughBatches)
                    .fill(0)
                    .map((_, i) => (
                      <Chip
                        key={i}
                        label={`Charge ${i + 1}: ${(
                          productionPlan.totalDoughWeight /
                          productionPlan.doughBatches /
                          1000
                        ).toFixed(1)} kg`}
                        sx={{ m: 0.5 }}
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Teigstücke vorbereiten:
                  </Typography>

                  <Table size="small">
                    <TableBody>
                      {Object.entries(productionPlan.doughPieces).map(
                        ([size, count]) => (
                          <TableRow key={size}>
                            <TableCell sx={{ py: 1 }}>
                              <Typography variant="body2">{size}</Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ py: 1 }}>
                              <Chip
                                label={`${count} Stk`}
                                size="small"
                                color="secondary"
                              />
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Fillings section */}
      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">Füllungen</Typography>
          {Object.values(productionPlan.fillingBatches).some(
            (b) => (b as number) > 0
          ) && (
            <Chip
              size="small"
              label={
                Object.values(productionPlan.fillings).reduce(
                  (a, b) => a + b,
                  0
                ) /
                  1000 +
                ' kg'
              }
              color="info"
              sx={{ ml: 1 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          {Object.entries(productionPlan.fillingBatches).some(
            ([_, batches]) => (batches as number) > 0
          ) ? (
            <Grid container spacing={2}>
              {Object.entries(productionPlan.fillingBatches).map(
                ([filling, batches]) => {
                  if ((batches as number) > 0) {
                    return (
                      <Grid item xs={12} key={filling}>
                        <Paper sx={{ p: 1.5 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            {formatFillingName(filling)}
                          </Typography>
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Chip
                              label={`${batches} Charge${
                                (batches as number) > 1 ? 'n' : ''
                              }`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                            <Chip
                              label={`${(
                                productionPlan.fillings[
                                  filling as keyof typeof productionPlan.fillings
                                ] / 1000
                              ).toFixed(1)} kg`}
                              size="small"
                              color="secondary"
                            />
                          </Box>
                        </Paper>
                      </Grid>
                    )
                  }
                  return null
                }
              )}
            </Grid>
          ) : (
            <Typography variant="body2" sx={{ py: 2, textAlign: 'center' }}>
              Keine Füllungen für diesen Produktionsplan benötigt.
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}

export default SaturdayProductionDashboard
