'use client'
import React from 'react'
import { Box, Container, Typography, Grid, Paper } from '@mui/material'
import { Inventory2 as InventoryIcon } from '@mui/icons-material'
import { Header, Footer } from '@bakery/shared/ui'
import {
  ProductionMetricsCard,
  ResourceOptimizationPanel,
} from '@bakery/management/feature-inventory'

export default function AdminInventoryPage() {
  return (
    <Box>
      <Header />

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            <InventoryIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
            Inventar & Lagerbestand
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Übersicht und Verwaltung der Lagerbestände und Rohstoffe
          </Typography>
        </Box>

        {/* Inventory Metrics */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <ProductionMetricsCard />
          </Grid>
          <Grid item xs={12} md={6}>
            <ResourceOptimizationPanel />
          </Grid>
        </Grid>

        {/* Inventory Status */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Kritische Bestände
              </Typography>
              <Typography variant="h3" color="error.main">
                5
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Artikel unter Mindestbestand
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Bestellungen ausstehend
              </Typography>
              <Typography variant="h3" color="warning.main">
                12
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Lieferungen erwartet
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Lagergesamtwert
              </Typography>
              <Typography variant="h3" color="success.main">
                €8,450
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktueller Bestandswert
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Inventory Management */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Lagerbestandstabelle
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Hier wird eine detaillierte Tabelle mit allen Rohstoffen,
            Verpackungsmaterialien und Hilfsstoffen angezeigt, einschließlich
            aktueller Bestände, Mindestmengen und Lieferantendaten.
          </Typography>
        </Paper>
      </Container>

      <Footer />
    </Box>
  )
}
