'use client'
import React from 'react'
import { Box, Container, Typography, Grid, Paper, Button } from '@mui/material'
import { Inventory as ProductsIcon, Add as AddIcon } from '@mui/icons-material'
import { Header, Footer } from '@bakery/shared/ui'

export default function AdminProductsPage() {
  return (
    <Box>
      <Header />

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Page Header */}
        <Box
          sx={{
            mb: 4,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              <ProductsIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
              Produktverwaltung
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Verwaltung und Bearbeitung aller Backwaren und Produkte
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} size="large">
            Neues Produkt
          </Button>
        </Box>

        {/* Product Statistics */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Aktive Produkte
              </Typography>
              <Typography variant="h3" color="primary">
                42
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Im Verkauf
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Saisonale Artikel
              </Typography>
              <Typography variant="h3" color="warning.main">
                8
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Begrenzt verfügbar
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Ausverkauft
              </Typography>
              <Typography variant="h3" color="error.main">
                3
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Nicht verfügbar
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Neue Produkte (30T)
              </Typography>
              <Typography variant="h3" color="success.main">
                5
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Kürzlich hinzugefügt
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Product Categories */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Brot & Brötchen
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Verwaltung aller Brot- und Brötchensorten mit Rezepten und
                Produktionszeiten.
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Kuchen & Gebäck
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Süße Backwaren, Torten und Feingebäck mit Allergeninformationen.
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Sonderangebote
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Aktionsware und saisonale Spezialitäten mit besonderen Preisen.
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Product Management Table */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Produktliste
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Hier wird eine umfassende Tabelle mit allen Produkten angezeigt,
            einschließlich Name, Kategorie, Preis, Verfügbarkeit und
            Bearbeitungsoptionen.
          </Typography>
        </Paper>
      </Container>

      <Footer />
    </Box>
  )
}
