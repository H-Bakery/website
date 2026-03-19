'use client'
import React from 'react'
import { Container, Typography, Alert } from '@mui/material'

export default function NotificationsArchivalPage() {
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Archivierung
      </Typography>
      <Alert severity="info">
        Automatische Archivierung wird in einer zukünftigen Version verfügbar
        sein.
      </Alert>
    </Container>
  )
}
