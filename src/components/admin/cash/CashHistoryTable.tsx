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
} from '@mui/material'
import {
  Search,
  FileDownload,
  Refresh,
  Euro,
  TrendingUp,
  TrendingDown,
  Edit,
  Delete,
  MoreVert,
} from '@mui/icons-material'
import { CashEntry } from '../../../services/types'
import { currencyUtils, dateUtils, cashCalculations, exportUtils } from '../../../utils/cashUtils'

interface CashHistoryTableProps {
  cashEntries: CashEntry[]
  loading: boolean
  onRefresh: () => void
  onEdit?: (entry: CashEntry) => void
  onDelete?: (entry: CashEntry) => void
}

type SortOrder = 'asc' | 'desc'
type SortBy = 'date' | 'amount' | 'createdAt'

const CashHistoryTable: React.FC<CashHistoryTableProps> = ({
  cashEntries,
  loading,
  onRefresh,
  onEdit,
  onDelete,
}) => {
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: '',
  })

  // Sorting logic
  const sortedEntries = useMemo(() => {
    const sorted = [...cashEntries].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date)
          bValue = new Date(b.date)
          break
        case 'amount':
          aValue = a.amount
          bValue = b.amount
          break
        case 'createdAt':
          aValue = new Date(a.createdAt)
          bValue = new Date(b.createdAt)
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [cashEntries, sortBy, sortOrder])

  // Filtering logic
  const filteredEntries = useMemo(() => {
    return sortedEntries.filter((entry) => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        entry.amount.toString().includes(searchTerm) ||
        entry.date.includes(searchTerm)

      // Date range filter
      const matchesDateRange = 
        (!dateFilter.startDate || entry.date >= dateFilter.startDate) &&
        (!dateFilter.endDate || entry.date <= dateFilter.endDate)

      return matchesSearch && matchesDateRange
    })
  }, [sortedEntries, searchTerm, dateFilter])

  const handleSort = (column: SortBy) => {
    const isAsc = sortBy === column && sortOrder === 'asc'
    setSortOrder(isAsc ? 'desc' : 'asc')
    setSortBy(column)
  }

  const exportToCSV = () => {
    const csvContent = exportUtils.generateCSV(filteredEntries)
    exportUtils.downloadCSV(csvContent)
  }

  const calculateTotal = () => {
    return cashCalculations.calculateTotal(filteredEntries)
  }

  const calculateAverage = () => {
    return cashCalculations.calculateAverage(filteredEntries)
  }

  const getTrendIcon = (currentAmount: number, previousAmount?: number) => {
    const trend = cashCalculations.getTrend(currentAmount, previousAmount)
    
    switch (trend) {
      case 'up':
        return <TrendingUp color="success" fontSize="small" />
      case 'down':
        return <TrendingDown color="error" fontSize="small" />
      default:
        return null
    }
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
        Kassenverlauf
      </Typography>

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              {currencyUtils.format(calculateTotal())}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gesamtsumme ({filteredEntries.length} Einträge)
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="success.main">
              {currencyUtils.format(calculateAverage())}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Durchschnitt pro Tag
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="info.main">
              {filteredEntries.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Einträge gefiltert
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters and Actions */}
      <Toolbar sx={{ pl: 0, pr: 0, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
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
          <Grid item xs={12} sm={3}>
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
          <Grid item xs={12} sm={3}>
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
          <Grid item xs={12} sm={2}>
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
              <TableCell align="right">
                <TableSortLabel
                  active={sortBy === 'amount'}
                  direction={sortBy === 'amount' ? sortOrder : 'asc'}
                  onClick={() => handleSort('amount')}
                >
                  Betrag
                </TableSortLabel>
              </TableCell>
              <TableCell>Trend</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'createdAt'}
                  direction={sortBy === 'createdAt' ? sortOrder : 'asc'}
                  onClick={() => handleSort('createdAt')}
                >
                  Erfasst am
                </TableSortLabel>
              </TableCell>
              {(onEdit || onDelete) && (
                <TableCell align="center" sx={{ width: 120 }}>
                  Aktionen
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(onEdit || onDelete) ? 5 : 4} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Keine Einträge gefunden
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry, index) => {
                const previousEntry = index < filteredEntries.length - 1 ? filteredEntries[index + 1] : undefined
                const trendIcon = getTrendIcon(entry.amount, previousEntry?.amount)
                
                return (
                  <TableRow key={entry.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="body2" fontWeight={600}>
                          {dateUtils.formatDisplay(entry.date)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dateUtils.formatWeekday(entry.date)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body1" fontWeight={600}>
                        {currencyUtils.format(entry.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {trendIcon}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {dateUtils.formatDateTime(entry.createdAt)}
                      </Typography>
                    </TableCell>
                    {(onEdit || onDelete) && (
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          {onEdit && (
                            <IconButton
                              size="small"
                              onClick={() => onEdit(entry)}
                              title="Bearbeiten"
                              sx={{
                                color: 'primary.main',
                                '&:hover': {
                                  backgroundColor: 'primary.lighter',
                                },
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          )}
                          {onDelete && (
                            <IconButton
                              size="small"
                              onClick={() => onDelete(entry)}
                              title="Löschen"
                              sx={{
                                color: 'error.main',
                                '&:hover': {
                                  backgroundColor: 'error.lighter',
                                },
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                    )}
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

export default CashHistoryTable