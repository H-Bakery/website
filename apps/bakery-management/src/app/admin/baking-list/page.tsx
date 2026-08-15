'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  ListAlt as BakingListIcon,
  Print as PrintIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { apiClient } from '@bakery/shared/data-access'

export interface BakingListItem {
  id: string | number
  productId: string
  name: string
  category: string
  quantity: number
  unit: string
  status: string
  date: string
}

const CATEGORY_LABELS: Record<string, string> = {
  brot: 'Brot',
  broetchen: 'Brötchen',
  baguette: 'Baguette',
  teilchen: 'Teilchen',
  snacks: 'Snacks',
  kuchen: 'Kuchen',
  torten: 'Torten',
}

const CATEGORY_COLORS: Record<
  string,
  'primary' | 'secondary' | 'warning' | 'info' | 'success' | 'default'
> = {
  brot: 'primary',
  broetchen: 'primary',
  baguette: 'primary',
  teilchen: 'secondary',
  snacks: 'info',
  kuchen: 'warning',
  torten: 'warning',
}

const storageKey = (date: string) => `baking-list-done:${date}`

const readDone = (date: string): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(date))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

const writeDone = (date: string, ids: string[]) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(date), JSON.stringify(ids))
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

export default function AdminBakingListPage() {
  const [items, setItems] = useState<BakingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const listDate = items[0]?.date ?? today

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<BakingListItem[]>('/api/baking-list')
      const data = Array.isArray(res.data) ? res.data : []
      setItems(data)
      setDone(new Set(readDone(data[0]?.date ?? today)))
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Backliste konnte nicht geladen werden'
      )
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    load()
  }, [load])

  const toggle = (id: string | number, value?: boolean) => {
    const key = String(id)
    setDone((prev) => {
      const next = new Set(prev)
      const shouldBeDone = value ?? !next.has(key)
      if (shouldBeDone) next.add(key)
      else next.delete(key)
      writeDone(listDate, Array.from(next))
      return next
    })
  }

  const toggleAll = (checked: boolean) => {
    const next = checked
      ? new Set(items.map((i) => String(i.id)))
      : new Set<string>()
    setDone(next)
    writeDone(listDate, Array.from(next))
  }

  const totalItems = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
  const completedUnits = items
    .filter((i) => done.has(String(i.id)))
    .reduce((s, i) => s + (Number(i.quantity) || 0), 0)
  const completionRate =
    totalItems > 0 ? Math.round((completedUnits / totalItems) * 100) : 0
  const doneCount = items.filter((i) => done.has(String(i.id))).length
  const openCount = items.length - doneCount

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: { xs: 2, md: 4 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 1.5,
            mb: 1,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}
          >
            <BakingListIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Backliste
          </Typography>
          <Box
            sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
            className="no-print"
          >
            <Tooltip title="Aktualisieren">
              <span>
                <IconButton
                  aria-label="Backliste aktualisieren"
                  onClick={load}
                  disabled={loading}
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              color="primary"
              onClick={() => window.print()}
              disabled={loading || items.length === 0}
            >
              Drucken
            </Button>
          </Box>
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          Tägliche Backliste für{' '}
          {new Date(listDate).toLocaleDateString('de-DE', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
        </Typography>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={load}>
              Erneut versuchen
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Progress Summary */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 2,
          mb: { xs: 2, md: 4 },
        }}
      >
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" gutterBottom>
            Fortschritt
          </Typography>
          <Typography variant="h3" color="primary">
            {loading ? '–' : `${completionRate}%`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {completedUnits} von {totalItems} Stück fertig
          </Typography>
        </Paper>
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" gutterBottom>
            Fertig
          </Typography>
          <Typography variant="h3" color="success.main">
            {loading ? '–' : doneCount}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Positionen abgehakt
          </Typography>
        </Paper>
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" gutterBottom>
            Offen
          </Typography>
          <Typography variant="h3" color="text.secondary">
            {loading ? '–' : openCount}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Noch zu backen
          </Typography>
        </Paper>
      </Box>

      {/* Baking List Table */}
      <Paper elevation={2}>
        {loading ? (
          <Box
            sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
            role="status"
            aria-label="Backliste wird geladen"
          >
            <CircularProgress />
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary" gutterBottom>
              Für heute liegt keine Backliste vor.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Die Backliste wird aus den verfügbaren Produkten erzeugt. Sind
              keine Produkte hinterlegt, bleibt die Liste leer.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      inputProps={{ 'aria-label': 'Alle Positionen abhaken' }}
                      checked={items.length > 0 && doneCount === items.length}
                      indeterminate={doneCount > 0 && doneCount < items.length}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>Produkt</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    Kategorie
                  </TableCell>
                  <TableCell align="center">Menge</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell
                    align="center"
                    sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                  >
                    Aktion
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  const isDone = done.has(String(item.id))
                  return (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{
                        '&:last-child td, &:last-child th': { border: 0 },
                        opacity: isDone ? 0.7 : 1,
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isDone}
                          onChange={(e) => toggle(item.id, e.target.checked)}
                          inputProps={{
                            'aria-label': `${item.name} abhaken`,
                          }}
                        />
                      </TableCell>
                      <TableCell component="th" scope="row">
                        <Typography
                          variant="body1"
                          fontWeight={500}
                          sx={{
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}
                        >
                          {item.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: { xs: 'block', md: 'none' } }}
                        >
                          {CATEGORY_LABELS[item.category] ?? item.category}
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: 'none', md: 'table-cell' } }}
                      >
                        <Chip
                          label={
                            CATEGORY_LABELS[item.category] ?? item.category
                          }
                          size="small"
                          color={CATEGORY_COLORS[item.category] ?? 'default'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body1" fontWeight={500}>
                          {item.quantity} {item.unit}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={isDone ? 'Fertig' : 'Offen'}
                          color={isDone ? 'success' : 'default'}
                          size="small"
                          icon={isDone ? <CheckIcon /> : undefined}
                        />
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                      >
                        <Tooltip
                          title={
                            isDone
                              ? 'Als offen markieren'
                              : 'Als fertig markieren'
                          }
                        >
                          <IconButton
                            size="small"
                            color={isDone ? 'default' : 'primary'}
                            aria-label={
                              isDone
                                ? `${item.name} als offen markieren`
                                : `${item.name} als fertig markieren`
                            }
                            onClick={() => toggle(item.id)}
                          >
                            <CheckIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  )
}
