'use client'
import React from 'react'
import { Box, Container, Typography, Grid, Paper } from '@mui/material'
import { LocalShipping as DeliveryIcon } from '@mui/icons-material'
import { Header, Footer } from '@bakery/shared/ui'

export default function AdminDeliveryPage() {
  return (
    <Box>
      <Header />

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            <DeliveryIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
            Lieferungen
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Lieferstatus und Routen verwalten
          </Typography>
        </Box>

        {/* Delivery Overview */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Aktive Lieferungen
              </Typography>
              <Typography variant="h3" color="primary">
                8
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Unterwegs
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Wartende Bestellungen
              </Typography>
              <Typography variant="h3" color="warning.main">
                3
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Bereit für Lieferung
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Heute abgeschlossen
              </Typography>
              <Typography variant="h3" color="success.main">
                15
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Erfolgreich zugestellt
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Delivery Management */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Aktuelle Lieferungen
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Hier wird die Liste der aktuellen Lieferungen mit Status,
                Fahrerinfo und Routendetails angezeigt.
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Routenoptimierung
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Tools zur Optimierung der Lieferrouten basierend auf Standorten
                und Verkehr.
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Lieferkarte
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Hier wird eine interaktive Karte mit allen Lieferstandorten und
            Routen angezeigt.
          </Typography>
        </Paper>
      </Container>

      <Footer />
    </Box>
  )
}
