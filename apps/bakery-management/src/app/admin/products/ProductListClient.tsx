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
  useMediaQuery,
  useTheme,
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
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
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
          mb: { xs: 2, md: 4 },
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: { xs: 1.5, sm: 0 },
        }}
      >
        <Box>
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}
          >
            <ProductsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Produktverwaltung
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            Verwaltung und Bearbeitung aller Backwaren und Produkte
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          size={isMobile ? 'medium' : 'large'}
        >
          Neues Produkt
        </Button>
      </Box>

      {/* Product Statistics */}
      <Grid
        container
        spacing={{ xs: 1.5, md: 3 }}
        sx={{ mb: { xs: 2, md: 4 } }}
      >
        <Grid item xs={6} md={3}>
          <Paper sx={{ p: { xs: 2, md: 3 }, textAlign: 'center' }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Gesamt
            </Typography>
            <Typography
              variant="h3"
              color="primary"
              sx={{ fontSize: { xs: '2rem', md: '3rem' } }}
            >
              {totalProducts}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              Produkte im Sortiment
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper sx={{ p: { xs: 2, md: 3 }, textAlign: 'center' }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Verfügbar
            </Typography>
            <Typography
              variant="h3"
              color="success.main"
              sx={{ fontSize: { xs: '2rem', md: '3rem' } }}
            >
              {activeProducts}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              Im Verkauf
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper sx={{ p: { xs: 2, md: 3 }, textAlign: 'center' }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Saisonal
            </Typography>
            <Typography
              variant="h3"
              color="warning.main"
              sx={{ fontSize: { xs: '2rem', md: '3rem' } }}
            >
              {seasonalProducts}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              Begrenzt verfügbar
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper sx={{ p: { xs: 2, md: 3 }, textAlign: 'center' }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Nicht verfügbar
            </Typography>
            <Typography
              variant="h3"
              color="error.main"
              sx={{ fontSize: { xs: '2rem', md: '3rem' } }}
            >
              {unavailableProducts}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              Derzeit nicht im Angebot
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Product List Table */}
      <Paper elevation={2}>
        <Box
          sx={{
            p: { xs: 1.5, md: 2 },
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="h6"
            sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}
          >
            Produktliste ({products.length})
          </Typography>
        </Box>
        <TableContainer>
          <Table size={isMobile ? 'small' : 'medium'}>
            <TableHead>
              <TableRow>
                <TableCell>Produkt</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                  Kategorie
                </TableCell>
                <TableCell align="right">Preis</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  Status
                </TableCell>
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
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: { xs: 1, md: 2 },
                      }}
                    >
                      <Avatar
                        src={product.image || undefined}
                        alt={product.name}
                        variant="rounded"
                        sx={{
                          width: { xs: 32, md: 40 },
                          height: { xs: 32, md: 40 },
                        }}
                      >
                        {product.name.charAt(0)}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          fontWeight={500}
                          noWrap
                          sx={{ maxWidth: { xs: 120, sm: 200, md: 300 } }}
                        >
                          {product.name}
                        </Typography>
                        {/* Show category as subtitle on mobile since column is hidden */}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: { xs: 'block', md: 'none' } }}
                        >
                          {product.category}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    <Chip
                      label={product.category}
                      size="small"
                      color={categoryColors[product.categoryKey] || 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={500} noWrap>
                      {product.price.toFixed(2)} €
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
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
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <IconButton
                      size="small"
                      color="primary"
                      aria-label="edit product"
                    >
                      <EditIcon fontSize={isMobile ? 'small' : 'medium'} />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="delete product"
                    >
                      <DeleteIcon fontSize={isMobile ? 'small' : 'medium'} />
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
