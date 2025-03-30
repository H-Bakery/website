'use client'

import React from 'react'
import { Box, Container, Typography, Button } from '@mui/material'
import { useRouter } from 'next/navigation'

export default function ProductNotFound() {
  const router = useRouter()

  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 8, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Produkt nicht gefunden
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Entschuldigung, wir konnten das gesuchte Produkt nicht finden.
        </Typography>
        <Button variant="contained" onClick={() => router.push('/products')}>
          Zurück zu Produkten
        </Button>
      </Box>
    </Container>
  )
}
