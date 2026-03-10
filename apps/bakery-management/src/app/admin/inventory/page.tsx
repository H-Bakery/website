'use client'
import React from 'react'
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  LinearProgress,
} from '@mui/material'
import {
  Inventory2 as InventoryIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'

// Mock inventory data
const mockInventory = [
  {
    id: '1',
    name: 'Weizenmehl Type 550',
    category: 'Mehl',
    quantity: 250,
    unit: 'kg',
    minQuantity: 100,
    supplier: 'Mühlenbetrieb Schmidt',
    lastUpdated: '2025-08-04',
  },
  {
    id: '2',
    name: 'Roggenmehl Type 1150',
    category: 'Mehl',
    quantity: 180,
    unit: 'kg',
    minQuantity: 150,
    supplier: 'Mühlenbetrieb Schmidt',
    lastUpdated: '2025-08-04',
  },
  {
    id: '3',
    name: 'Frische Hefe',
    category: 'Triebmittel',
    quantity: 15,
    unit: 'kg',
    minQuantity: 20,
    supplier: 'Großhandel Weber',
    lastUpdated: '2025-08-05',
  },
  {
    id: '4',
    name: 'Salz',
    category: 'Gewürze',
    quantity: 45,
    unit: 'kg',
    minQuantity: 30,
    supplier: 'Großhandel Weber',
    lastUpdated: '2025-08-03',
  },
  {
    id: '5',
    name: 'Zucker',
    category: 'Süßungsmittel',
    quantity: 85,
    unit: 'kg',
    minQuantity: 50,
    supplier: 'Großhandel Weber',
    lastUpdated: '2025-08-03',
  },
]

export default function AdminInventoryPage() {
  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h4" component="h1">
            <InventoryIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
            Inventar & Lagerbestand
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} color="primary">
            Neuer Artikel
          </Button>
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          Übersicht und Verwaltung der Lagerbestände und Rohstoffe
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 2,
          mb: 4,
        }}
      >
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Gesamtartikel
          </Typography>
          <Typography variant="h3" color="primary">
            {mockInventory.length}
          </Typography>
        </Paper>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Niedrige Bestände
          </Typography>
          <Typography variant="h3" color="warning.main">
            {
              mockInventory.filter((item) => item.quantity <= item.minQuantity)
                .length
            }
          </Typography>
        </Paper>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Letzte Aktualisierung
          </Typography>
          <Typography variant="h3" color="text.secondary">
            Heute
          </Typography>
        </Paper>
      </Box>

      {/* Inventory Table */}
      <Paper elevation={2}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Artikel</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  Kategorie
                </TableCell>
                <TableCell align="right">Bestand</TableCell>
                <TableCell
                  align="right"
                  sx={{ display: { xs: 'none', md: 'table-cell' } }}
                >
                  Min. Bestand
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                  Status
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                  Lieferant
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                  Aktualisiert
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                >
                  Aktionen
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockInventory.map((item) => {
                const isLow = item.quantity <= item.minQuantity
                const percentage = (item.quantity / item.minQuantity) * 100

                return (
                  <TableRow
                    key={item.id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell component="th" scope="row">
                      {item.name}
                    </TableCell>
                    <TableCell
                      sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                    >
                      {item.category}
                    </TableCell>
                    <TableCell align="right">
                      {item.quantity} {item.unit}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ display: { xs: 'none', md: 'table-cell' } }}
                    >
                      {item.minQuantity} {item.unit}
                    </TableCell>
                    <TableCell
                      sx={{ display: { xs: 'none', md: 'table-cell' } }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        {isLow && (
                          <WarningIcon color="warning" fontSize="small" />
                        )}
                        <Box sx={{ width: 100 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(percentage, 100)}
                            color={isLow ? 'warning' : 'success'}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{ display: { xs: 'none', lg: 'table-cell' } }}
                    >
                      {item.supplier}
                    </TableCell>
                    <TableCell
                      sx={{ display: { xs: 'none', lg: 'table-cell' } }}
                    >
                      {item.lastUpdated}
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                    >
                      <IconButton
                        size="small"
                        color="primary"
                        aria-label="edit item"
                      >
                        <EditIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Low Stock Alert */}
      {mockInventory.some((item) => item.quantity <= item.minQuantity) && (
        <Box sx={{ mt: 3, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
          <Typography variant="body2" color="warning.dark">
            <WarningIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Es gibt{' '}
            {
              mockInventory.filter((item) => item.quantity <= item.minQuantity)
                .length
            }{' '}
            Artikel mit niedrigem Lagerbestand. Bitte bestellen Sie rechtzeitig
            nach.
          </Typography>
        </Box>
      )}
    </Box>
  )
}
