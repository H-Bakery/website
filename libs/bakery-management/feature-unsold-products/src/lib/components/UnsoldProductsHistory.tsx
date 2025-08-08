'use client'
import React, { useState, useMemo } from 'react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Button,
  Typography,
  Chip,
  Paper,
  IconButton,
  Toolbar,
  InputAdornment,
  Grid,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material'
import {
  Search,
  FileDownload,
  Refresh,
  Inventory,
  ExpandMore,
} from '@mui/icons-material'
import { UnsoldProduct, UnsoldProductSummary } from '@bakery/shared/types'

interface UnsoldProductsHistoryProps {
  unsoldProducts: UnsoldProduct[]
  summary: UnsoldProductSummary[]
  loading: boolean
  onRefresh: () => void
}

type SortOrder = 'asc' | 'desc'
type SortBy = 'date' | 'quantity' | 'productName' | 'category'

export const UnsoldProductsHistory: React.FC<UnsoldProductsHistoryProps> = ({
  unsoldProducts,
  summary,
  loading,
  onRefresh,
}) => {
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: '',
  })
  const [categoryFilter, setCategoryFilter] = useState('')

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(unsoldProducts.map(entry => entry.Product?.category || ''))
    return Array.from(cats).filter(Boolean).sort()
  }, [unsoldProducts])

  // Sorting logic
  const sortedEntries = useMemo(() => {
    const sorted = [...unsoldProducts].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date)
          bValue = new Date(b.date)
          break
        case 'quantity':
          aValue = a.quantity
          bValue = b.quantity
          break
        case 'productName':
          aValue = (a.Product?.name || '').toLowerCase()
          bValue = (b.Product?.name || '').toLowerCase()
          break
        case 'category':
          aValue = (a.Product?.category || '').toLowerCase()
          bValue = (b.Product?.category || '').toLowerCase()
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [unsoldProducts, sortBy, sortOrder])

  // Filtering logic
  const filteredEntries = useMemo(() => {
    return sortedEntries.filter((entry) => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        (entry.Product?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.Product?.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.quantity.toString().includes(searchTerm)

      // Date range filter
      const matchesDateRange = 
        (!dateFilter.startDate || entry.date >= dateFilter.startDate) &&
        (!dateFilter.endDate || entry.date <= dateFilter.endDate)

      // Category filter
      const matchesCategory = categoryFilter === '' || entry.Product?.category === categoryFilter

      return matchesSearch && matchesDateRange && matchesCategory
    })
  }, [sortedEntries, searchTerm, dateFilter, categoryFilter])

  const handleSort = (column: SortBy) => {
    const isAsc = sortBy === column && sortOrder === 'asc'
    setSortOrder(isAsc ? 'desc' : 'asc')
    setSortBy(column)
  }

  const exportToCSV = () => {
    const headers = ['Datum', 'Produkt', 'Kategorie', 'Anzahl unverkauft', 'Erfasst von', 'Erfasst am']
    const csvRows = [
      headers.join(','),
      ...filteredEntries.map(entry => [
        entry.date,
        `"${entry.Product?.name || ''}"`,
        entry.Product?.category || '',
        entry.quantity,
        entry.User?.username || '',
        new Date(entry.createdAt).toLocaleString('de-DE')
      ].join(','))
    ]
    
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `unverkaufte-produkte-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const calculateTotalWaste = () => {
    return filteredEntries.reduce((sum, entry) => sum + entry.quantity, 0)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Unverkaufte Produkte - Verlauf
      </Typography>

      {/* Summary Section */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle1" fontWeight={600}>
            Zusammenfassung nach Produkten
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {summary.map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item.productId}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h6" color="primary">
                    {item.totalUnsold}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {item.Product?.name || ''}
                  </Typography>
                  <Chip 
                    label={item.Product?.category || ''} 
                    size="small" 
                    color="secondary" 
                    variant="outlined"
                  />
                </Paper>
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              {calculateTotalWaste()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gesamt unverkauft ({filteredEntries.length} Einträge)
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="warning.main">
              {Math.round(calculateTotalWaste() / Math.max(filteredEntries.length, 1) * 10) / 10}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Durchschnitt pro Eintrag
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="info.main">
              {new Set(filteredEntries.map(e => e.Product?.name || '')).size}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Verschiedene Produkte
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters and Actions */}
      <Toolbar sx={{ pl: 0, pr: 0, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              size="small"
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField
              size="small"
              select
              label="Kategorie"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              SelectProps={{ native: true }}
              fullWidth
            >
              <option value="">Alle</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField
              size="small"
              label="Von Datum"
              type="date"
              value={dateFilter.startDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField
              size="small"
              label="Bis Datum"
              type="date"
              value={dateFilter.endDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton onClick={onRefresh} title="Aktualisieren">
                <Refresh />
              </IconButton>
              <IconButton onClick={exportToCSV} title="Als CSV exportieren">
                <FileDownload />
              </IconButton>
            </Box>
          </Grid>
        </Grid>
      </Toolbar>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'date'}
                  direction={sortBy === 'date' ? sortOrder : 'asc'}
                  onClick={() => handleSort('date')}
                >
                  Datum
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'productName'}
                  direction={sortBy === 'productName' ? sortOrder : 'asc'}
                  onClick={() => handleSort('productName')}
                >
                  Produkt
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'category'}
                  direction={sortBy === 'category' ? sortOrder : 'asc'}
                  onClick={() => handleSort('category')}
                >
                  Kategorie
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortBy === 'quantity'}
                  direction={sortBy === 'quantity' ? sortOrder : 'asc'}
                  onClick={() => handleSort('quantity')}
                >
                  Anzahl unverkauft
                </TableSortLabel>
              </TableCell>
              <TableCell>Erfasst von</TableCell>
              <TableCell>Erfasst am</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Keine Einträge gefunden
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => {
                const id = typeof entry.id === 'string' ? entry.id : entry.id.toString()
                return (
                  <TableRow key={id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {formatDate(entry.date)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {entry.Product?.name || ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={entry.Product?.category || ''} 
                        size="small" 
                        color="secondary" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                        <Inventory fontSize="small" color="action" />
                        <Typography variant="body1" fontWeight={600}>
                          {entry.quantity}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {entry.User?.username || ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateTime(entry.createdAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

export default UnsoldProductsHistory