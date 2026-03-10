'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Alert,
  Box,
  Grid,
  TextField,
  Button,
  Paper,
  Chip,
  Avatar,
  IconButton,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import type { ManagementProduct } from '../../../../lib/products'

const statusLabels: Record<string, string> = {
  active: 'Verfügbar',
  seasonal: 'Saisonal',
  unavailable: 'Nicht verfügbar',
}

const statusColors: Record<string, 'success' | 'warning' | 'error'> = {
  active: 'success',
  seasonal: 'warning',
  unavailable: 'error',
}

export default function ProductEditClient({
  productId,
  initialProduct,
}: {
  productId: string
  initialProduct?: ManagementProduct
}) {
  const router = useRouter()

  if (!initialProduct) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">
          Produkt mit ID &quot;{productId}&quot; nicht gefunden.
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/admin/products')}
          sx={{ mt: 2 }}
        >
          Zurück zur Produktliste
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ mt: 2, mb: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.back()} aria-label="back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ ml: 1 }}>
            {initialProduct.name}
          </Typography>
          <Chip
            label={statusLabels[initialProduct.status] || initialProduct.status}
            color={statusColors[initialProduct.status] || 'default'}
            size="small"
            sx={{ ml: 2 }}
          />
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {initialProduct.image ? (
                <Box
                  component="img"
                  src={initialProduct.image}
                  alt={initialProduct.name}
                  sx={{
                    width: '100%',
                    maxWidth: '180px',
                    height: 'auto',
                    maxHeight: '180px',
                    objectFit: 'contain',
                    borderRadius: 1,
                    mb: 2,
                    border: '1px solid #ddd',
                  }}
                />
              ) : (
                <Avatar
                  sx={{ width: 180, height: 180, mb: 2, fontSize: '4rem' }}
                  variant="rounded"
                >
                  {initialProduct.name.charAt(0)}
                </Avatar>
              )}
            </Box>
          </Grid>

          <Grid item xs={12} md={8}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Produktname"
                  value={initialProduct.name}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Kategorie"
                  value={initialProduct.category}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Preis"
                  value={`${initialProduct.price.toFixed(2)} €`}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Beschreibung"
                  value={initialProduct.description || 'Keine Beschreibung'}
                  fullWidth
                  multiline
                  rows={3}
                  variant="outlined"
                  size="small"
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={() => router.push('/admin/products')}
                startIcon={<ArrowBackIcon />}
              >
                Zurück zur Produktliste
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  )
}
