'use client'
import React from 'react'
import {
  Box,
  Container,
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

// Mock products data
const mockProducts = [
  {
    id: '1',
    name: 'Vollkornbrot',
    category: 'Brot',
    price: 3.5,
    stock: 45,
    status: 'active',
    image: '/api/placeholder/60/60',
  },
  {
    id: '2',
    name: 'Croissant',
    category: 'Gebäck',
    price: 2.2,
    stock: 0,
    status: 'out-of-stock',
    image: '/api/placeholder/60/60',
  },
  {
    id: '3',
    name: 'Baguette',
    category: 'Brot',
    price: 2.8,
    stock: 35,
    status: 'active',
    image: '/api/placeholder/60/60',
  },
  {
    id: '4',
    name: 'Apfelkuchen',
    category: 'Kuchen',
    price: 15.0,
    stock: 8,
    status: 'active',
    image: '/api/placeholder/60/60',
  },
  {
    id: '5',
    name: 'Brezel',
    category: 'Gebäck',
    price: 1.5,
    stock: 60,
    status: 'active',
    image: '/api/placeholder/60/60',
  },
  {
    id: '6',
    name: 'Schwarzwälder Kirschtorte',
    category: 'Kuchen',
    price: 28.0,
    stock: 3,
    status: 'seasonal',
    image: '/api/placeholder/60/60',
  },
]

const categoryColors = {
  Brot: 'primary',
  Gebäck: 'secondary',
  Kuchen: 'warning',
} as const

export default function AdminProductsPage() {
  const activeProducts = mockProducts.filter(
    (p) => p.status === 'active'
  ).length
  const seasonalProducts = mockProducts.filter(
    (p) => p.status === 'seasonal'
  ).length
  const outOfStockProducts = mockProducts.filter(
    (p) => p.status === 'out-of-stock'
  ).length
  const newProducts = 5 // Mock value

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
              Aktive Produkte
            </Typography>
            <Typography variant="h3" color="primary">
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
              Ausverkauft
            </Typography>
            <Typography variant="h3" color="error.main">
              {outOfStockProducts}
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
              {newProducts}
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

      {/* Product List Table */}
      <Paper elevation={2}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6">Produktliste</Typography>
        </Box>
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>Produkt</TableCell>
                <TableCell>Kategorie</TableCell>
                <TableCell align="right">Preis</TableCell>
                <TableCell align="center">Lagerbestand</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockProducts.map((product) => (
                <TableRow
                  key={product.id}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        src={product.image}
                        alt={product.name}
                        variant="rounded"
                      />
                      <Typography variant="body1" fontWeight={500}>
                        {product.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={product.category}
                      size="small"
                      color={
                        categoryColors[
                          product.category as keyof typeof categoryColors
                        ]
                      }
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
                  <TableCell align="center">
                    <Typography
                      variant="body1"
                      color={
                        product.stock === 0
                          ? 'error.main'
                          : product.stock < 10
                          ? 'warning.main'
                          : 'text.primary'
                      }
                      fontWeight={product.stock === 0 ? 500 : 400}
                    >
                      {product.stock}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        product.status === 'active'
                          ? 'Aktiv'
                          : product.status === 'seasonal'
                          ? 'Saisonal'
                          : 'Ausverkauft'
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
