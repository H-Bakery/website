'use client'
import React from 'react'
import Link from 'next/link'
import { Alert, Box, Button, Paper, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

export default function NewProductPage() {
  return (
    <Box>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}
      >
        Neues Produkt anlegen
      </Typography>
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Neue Produkte werden derzeit zentral im HQ-Produktverzeichnis als
          Markdown-Datei gepflegt und erscheinen danach automatisch in der
          Produktverwaltung. Ein Formular zum Anlegen direkt in der Verwaltung
          ist noch nicht verfügbar.
        </Alert>
        <Typography variant="body2" color="text.secondary" paragraph>
          Bestehende Produkte können Sie in der Produktliste über das
          Stift-Symbol bearbeiten (Name, Kategorie, Preis, Status und
          Beschreibung).
        </Typography>
        <Button
          component={Link}
          href="/admin/products"
          startIcon={<ArrowBackIcon />}
          variant="outlined"
        >
          Zurück zur Produktliste
        </Button>
      </Paper>
    </Box>
  )
}
