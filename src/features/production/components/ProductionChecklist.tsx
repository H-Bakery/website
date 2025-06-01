'use client'
import React from 'react'
import {
  Box,
  Typography,
  Paper,
  Checkbox,
  FormControlLabel,
  Divider,
  Grid,
} from '@mui/material'
import {
  ProductOrder,
  HefezopfCalculator,
  formatFillingName,
} from '../utils/productionCalculator'

interface ProductionChecklistProps {
  orders: ProductOrder
  date: string
}

const ProductionChecklist: React.FC<ProductionChecklistProps> = ({
  orders,
  date,
}) => {
  const calculator = new HefezopfCalculator()
  const productionPlan = calculator.calculateProductionNeeds(orders)

  return (
    <Paper sx={{ p: 3 }} className="production-checklist">
      <Box textAlign="center" mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          Produktions-Checkliste für Samstag
        </Typography>
        <Typography variant="h6" component="h2">
          {new Date(date).toLocaleDateString('de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Typography>
      </Box>

      {/* Dough Preparation */}
      <Box mb={4}>
        <Typography variant="h5" component="h3" gutterBottom>
          1. Hefeteig Vorbereitung ({productionPlan.doughBatches} Chargen à 40kg)
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          {Array(productionPlan.doughBatches)
            .fill(0)
            .map((_, index) => {
              // Berechne das Gewicht für jede Charge
              const isLastBatch = index === productionPlan.doughBatches - 1
              const batchWeight = isLastBatch && productionPlan.totalDoughWeight % 40000 !== 0
                ? (productionPlan.totalDoughWeight % 40000 / 1000).toFixed(1)
                : 40
                
              return (
                <Grid item xs={12} sm={6} key={`dough-${index}`}>
                  <FormControlLabel
                    control={<Checkbox />}
                    label={`Hefeteig Charge ${index + 1} (${batchWeight} kg)`}
                  />
                </Grid>
              )
            })}
        </Grid>
      </Box>

      {/* Dough Pieces */}
      <Box mb={4}>
        <Typography variant="h5" component="h3" gutterBottom>
          2. Teigstücke Abwiegen und Portionieren
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          {Object.entries(productionPlan.doughPieces).map(([name, count]) => {
            const doughPiece = calculator.getDoughPieceDetails(name)
            return (
              <Grid item xs={12} sm={6} key={`pieces-${name}`}>
                  <FormControlLabel
                    control={<Checkbox />}
                    label={`${count} Teigstücke: ${name} (${doughPiece?.weight || 0}g)`}
                  />
                </Grid>
            )
          })}
        </Grid>
      </Box>

      {/* Fillings */}
      <Box mb={4}>
        <Typography variant="h5" component="h3" gutterBottom>
          3. Füllungen Zubereiten
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {Object.entries(productionPlan.fillingBatches).length > 0 ? (
          <Grid container spacing={2}>
            {Object.entries(productionPlan.fillingBatches).map(
              ([filling, batches]) => {
                if (batches > 0) {
                  return (
                    <Grid item xs={12} key={`filling-${filling}`}>
                      <FormControlLabel
                        control={<Checkbox />}
                        label={`${formatFillingName(
                          filling
                        )}: ${batches} Charge(n) à 15kg (${(
                          productionPlan.fillings[filling] / 1000
                        ).toFixed(1)} kg gesamt)`}
                      />
                    </Grid>
                  )
                }
                return null
              }
            )}
          </Grid>
        ) : (
          <Typography>
            Keine Füllungen für diesen Produktionsplan benötigt.
          </Typography>
        )}
      </Box>

      {/* Final Products */}
      <Box mb={4}>
        <Typography variant="h5" component="h3" gutterBottom>
          4. Endprodukte Herstellen
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          {Object.entries(orders).map(([product, quantity]) => {
            if (quantity > 0) {
              return (
                <Grid item xs={12} sm={6} md={4} key={`product-${product}`}>
                  <FormControlLabel
                    control={<Checkbox />}
                    label={`${quantity}× ${product}`}
                  />
                  {calculator.recipes[product]?.doughPiece && (
                    <Typography variant="caption" display="block" ml={4} mt={-0.5}>
                      aus {calculator.getDoughPieceDetails(calculator.recipes[product].doughPiece)?.count || 0} Teigstücken geflochten
                    </Typography>
                  )}
                </Grid>
              )
            }
            return null
          })}
        </Grid>
      </Box>
    </Paper>
  )
}

export default ProductionChecklist