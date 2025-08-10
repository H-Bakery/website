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
  Button,
  IconButton,
  Checkbox,
} from '@mui/material'
import {
  ListAlt as BakingListIcon,
  Print as PrintIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Add as AddIcon,
} from '@mui/icons-material'

// Mock baking list data
const mockBakingList = [
  {
    id: '1',
    product: 'Vollkornbrot',
    quantity: 50,
    completed: 50,
    status: 'completed',
    startTime: '04:00',
    category: 'Brot',
  },
  {
    id: '2',
    product: 'Baguette',
    quantity: 80,
    completed: 60,
    status: 'in-progress',
    startTime: '05:00',
    category: 'Brot',
  },
  {
    id: '3',
    product: 'Croissant',
    quantity: 120,
    completed: 0,
    status: 'pending',
    startTime: '06:00',
    category: 'Gebäck',
  },
  {
    id: '4',
    product: 'Brezel',
    quantity: 100,
    completed: 100,
    status: 'completed',
    startTime: '04:30',
    category: 'Gebäck',
  },
  {
    id: '5',
    product: 'Apfelkuchen',
    quantity: 15,
    completed: 10,
    status: 'in-progress',
    startTime: '07:00',
    category: 'Kuchen',
  },
  {
    id: '6',
    product: 'Käsebrötchen',
    quantity: 60,
    completed: 0,
    status: 'pending',
    startTime: '06:30',
    category: 'Brötchen',
  },
]

const categoryColors = {
  Brot: 'primary',
  Gebäck: 'secondary',
  Kuchen: 'warning',
  Brötchen: 'info',
} as const

export default function AdminBakingListPage() {
  const totalItems = mockBakingList.reduce(
    (sum, item) => sum + item.quantity,
    0
  )
  const completedItems = mockBakingList.reduce(
    (sum, item) => sum + item.completed,
    0
  )
  const completionRate = Math.round((completedItems / totalItems) * 100)

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
            <BakingListIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
            Backliste
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              color="primary"
            >
              Drucken
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} color="primary">
              Artikel hinzufügen
            </Button>
          </Box>
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          Tägliche Backliste und Produktionsübersicht für{' '}
          {new Date().toLocaleDateString('de-DE')}
        </Typography>
      </Box>

      {/* Progress Summary */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 2,
          mb: 4,
        }}
      >
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Fortschritt
          </Typography>
          <Typography variant="h3" color="primary">
            {completionRate}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {completedItems} von {totalItems} Artikeln fertig
          </Typography>
        </Paper>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            In Bearbeitung
          </Typography>
          <Typography variant="h3" color="warning.main">
            {
              mockBakingList.filter((item) => item.status === 'in-progress')
                .length
            }
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Artikel werden gebacken
          </Typography>
        </Paper>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Ausstehend
          </Typography>
          <Typography variant="h3" color="text.secondary">
            {mockBakingList.filter((item) => item.status === 'pending').length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Noch zu produzieren
          </Typography>
        </Paper>
      </Box>

      {/* Baking List Table */}
      <Paper elevation={2}>
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox />
                </TableCell>
                <TableCell>Startzeit</TableCell>
                <TableCell>Produkt</TableCell>
                <TableCell>Kategorie</TableCell>
                <TableCell align="center">Menge</TableCell>
                <TableCell align="center">Fertig</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockBakingList.map((item) => (
                <TableRow
                  key={item.id}
                  sx={{
                    '&:last-child td, &:last-child th': { border: 0 },
                    opacity: item.status === 'completed' ? 0.7 : 1,
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox checked={item.status === 'completed'} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon fontSize="small" color="action" />
                      {item.startTime}
                    </Box>
                  </TableCell>
                  <TableCell component="th" scope="row">
                    <Typography variant="body1" fontWeight={500}>
                      {item.product}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.category}
                      size="small"
                      color={
                        categoryColors[
                          item.category as keyof typeof categoryColors
                        ]
                      }
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body1" fontWeight={500}>
                      {item.quantity}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography
                      variant="body1"
                      color={
                        item.completed === item.quantity
                          ? 'success.main'
                          : 'text.primary'
                      }
                    >
                      {item.completed}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        item.status === 'completed'
                          ? 'Abgeschlossen'
                          : item.status === 'in-progress'
                          ? 'In Produktion'
                          : 'Ausstehend'
                      }
                      color={
                        item.status === 'completed'
                          ? 'success'
                          : item.status === 'in-progress'
                          ? 'warning'
                          : 'default'
                      }
                      size="small"
                      icon={
                        item.status === 'completed' ? <CheckIcon /> : undefined
                      }
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="primary"
                      disabled={item.status === 'completed'}
                    >
                      <CheckIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Production Notes */}
      <Box sx={{ mt: 3, p: 3, bgcolor: 'info.light', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom color="info.dark">
          Produktionshinweise
        </Typography>
        <Typography variant="body2" color="info.dark" paragraph>
          • Vollkornbrot: Extra 10 Minuten Gehzeit einplanen
        </Typography>
        <Typography variant="body2" color="info.dark" paragraph>
          • Croissants: Butter rechtzeitig aus dem Kühlraum nehmen
        </Typography>
        <Typography variant="body2" color="info.dark">
          • Apfelkuchen: Frische Äpfel wurden gestern geliefert
        </Typography>
      </Box>
    </Box>
  )
}
