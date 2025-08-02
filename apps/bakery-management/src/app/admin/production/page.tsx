'use client'
import React from 'react'
import { Box, Container, Typography, Grid, Paper } from '@mui/material'
import { Factory as ProductionIcon } from '@mui/icons-material'
import { Header, Footer } from '@bakery/shared/ui'
import {
  ProductionMetricsCard,
  ProductionStatusPanel,
  ResourceOptimizationPanel,
} from '@bakery/management/feature-inventory'

export default function AdminProductionPage() {
  return (
    <Box>
      <Header />

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            <ProductionIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
            Produktionsplanung
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Übersicht und Steuerung der Produktionsprozesse
          </Typography>
        </Box>

        {/* Production Metrics */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6} lg={4}>
            <ProductionMetricsCard />
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <ProductionStatusPanel />
          </Grid>
          <Grid item xs={12} lg={4}>
            <ResourceOptimizationPanel />
          </Grid>
        </Grid>

        {/* Production Planning */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Produktionsplanung
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Hier wird die detaillierte Produktionsplanung mit Backlisten,
            Zeitplänen und Ressourcenverteilung angezeigt.
          </Typography>
        </Paper>
      </Container>

      <Footer />
    </Box>
  )
}
