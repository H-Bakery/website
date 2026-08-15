'use client'
import React from 'react'
import { Container, Typography, Alert } from '@mui/material'

export default function RecipesPage() {
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Rezepte
      </Typography>
      <Alert severity="info">
        Rezeptverwaltung wird in einer zukünftigen Version verfügbar sein.
      </Alert>
    </Container>
  )
}
