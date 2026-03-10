'use client'
import React from 'react'
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Avatar,
} from '@mui/material'
import {
  Inventory as ProductsIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Euro as EuroIcon,
} from '@mui/icons-material'
import type { ManagementProduct } from '../../../lib/products'

const categoryColors: Record<
  string,
  'primary' | 'secondary' | 'warning' | 'info' | 'success' | 'error'
> = {
  brot: 'primary',
  broetchen: 'primary',
  baguette: 'primary',
  teilchen: 'secondary',
  snacks: 'info',
  kuchen: 'warning',
  torten: 'warning',
}

interface ProductListClientProps {
  products: ManagementProduct[]
}

export default function ProductListClient({
  products,
}: ProductListClientProps) {
  const activeProducts = products.filter((p) => p.status === 'active').length
  const seasonalProducts = products.filter(
    (p) => p.status === 'seasonal'
  ).length
  const unavailableProducts = products.filter(
    (p) => p.status === 'unavailable'
  ).length
  const totalProducts = products.length

  return (
    <Box>
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
              Gesamt
            </Typography>
            <Typography variant="h3" color="primary">
              {totalProducts}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Produkte im Sortiment
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Verfügbar
            </Typography>
            <Typography variant="h3" color="success.main">
              {activeProducts}
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
              {seasonalProducts}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Begrenzt verfügbar
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Nicht verfügbar
            </Typography>
            <Typography variant="h3" color="error.main">
              {unavailableProducts}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Derzeit nicht im Angebot
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Product List Table */}
      <Paper elevation={2}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6">
            Produktliste ({products.length} Produkte)
          </Typography>
        </Box>
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>Produkt</TableCell>
                <TableCell>Kategorie</TableCell>
                <TableCell align="right">Preis</TableCell>
                <TableCell>Verfügbarkeit</TableCell>
                <TableCell align="center">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product.id}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        src={product.image || undefined}
                        alt={product.name}
                        variant="rounded"
                      >
                        {product.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body1" fontWeight={500}>
                          {product.name}
                        </Typography>
                        {product.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              maxWidth: 300,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {product.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={product.category}
                      size="small"
                      color={categoryColors[product.categoryKey] || 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 0.5,
                      }}
                    >
                      <Typography variant="body1" fontWeight={500}>
                        {product.price.toFixed(2)}
                      </Typography>
                      <EuroIcon fontSize="small" />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        product.status === 'active'
                          ? 'Verfügbar'
                          : product.status === 'seasonal'
                          ? 'Saisonal'
                          : 'Nicht verfügbar'
                      }
                      color={
                        product.status === 'active'
                          ? 'success'
                          : product.status === 'seasonal'
                          ? 'warning'
                          : 'error'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="primary"
                      aria-label="edit product"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="delete product"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
