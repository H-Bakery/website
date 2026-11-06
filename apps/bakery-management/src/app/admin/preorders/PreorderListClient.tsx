'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  AddCircleOutline as NewIcon,
  CalendarMonth as DayIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import PaymentNote from '../../../components/preorders/PaymentNote'
import PreorderStatusChip from '../../../components/preorders/PreorderStatusChip'
import { useOptionalSession } from '../../../lib/session'
import {
  fetchPickupPoints,
  listPreorders,
  preorderErrorMessage,
  preorderListQuery,
  preorderPageQuery,
} from '../../../lib/preordersApi'
import {
  CHANNEL_LABELS,
  canWritePreorders,
  LADEN_PICKUP,
  PREORDER_CHANNELS,
  PREORDER_STATUSES,
  PREORDER_STATUS_LABELS,
  formatCurrency,
  formatDateWithWeekday,
  formatItems,
  formatPickupPlace,
  isBusinessDate,
  nextProductionDate,
  toBusinessDate,
  type PickupPoint,
  type Preorder,
  type PreorderChannel,
  type PreorderListFilters,
  type PreorderStatus,
} from '../../../lib/preordersTypes'

const SEARCH_DELAY_MS = 300

export interface PreorderListClientProps {
  /** Aus der URL; `undefined` = Vorgabe „ab heute". */
  initialFilters?: PreorderListFilters
}

function sameFilters(a: PreorderListFilters, b: PreorderListFilters) {
  return preorderListQuery(a) === preorderListQuery(b)
}

/**
 * P3: alle Vorbestellungen mit Suche (Name, Code, Telefon) und Filtern
 * (Zeitraum, Status, Bestellweg, Abholort). Die Filter stehen in der URL -
 * zurück aus einer Bestellung landet man wieder in derselben Liste.
 */
export default function PreorderListClient({
  initialFilters,
}: PreorderListClientProps) {
  const router = useRouter()
  const theme = useTheme()
  const wide = useMediaQuery(theme.breakpoints.up('md'))
  const session = useOptionalSession()
  const role = session?.user?.role ?? null
  const canWrite = canWritePreorders(role)

  const [filters, setFilters] = useState<PreorderListFilters | null>(
    initialFilters ?? null
  )
  const [search, setSearch] = useState(initialFilters?.q ?? '')
  const [today, setToday] = useState('')
  const [points, setPoints] = useState<PickupPoint[]>([])
  const [preorders, setPreorders] = useState<Preorder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const now = toBusinessDate(new Date())
    setToday(now)
    setFilters((current) => current ?? { from: now })
    fetchPickupPoints()
      .then(setPoints)
      .catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    if (!filters) return
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const list = await listPreorders(filters)
      if (id === requestId.current) setPreorders(list)
    } catch (err) {
      if (id === requestId.current) {
        setPreorders([])
        setError(
          preorderErrorMessage(
            err,
            'Die Vorbestellungen konnten nicht geladen werden.'
          )
        )
      }
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  // Filter in die URL, ohne neuen Verlaufseintrag.
  useEffect(() => {
    if (!filters) return
    router.replace(`/admin/preorders?${preorderPageQuery(filters)}`, {
      scroll: false,
    })
  }, [filters, router])

  // Suche verzögert übernehmen.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => {
        if (!current) return current
        const next = { ...current, q: search.trim() || undefined }
        return sameFilters(current, next) ? current : next
      })
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search])

  const update = (patch: Partial<PreorderListFilters>) =>
    setFilters((current) => ({ ...(current ?? {}), ...patch }))

  const toggleStatus = (status: PreorderStatus) => {
    const current = filters?.status ?? []
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status]
    update({ status: next.length > 0 ? next : undefined })
  }

  const range = {
    from: filters?.date ?? filters?.from ?? '',
    to: filters?.date ?? filters?.to ?? '',
  }
  const setRange = (from: string, to: string) =>
    update({
      date: undefined,
      from: isBusinessDate(from) ? from : undefined,
      to: isBusinessDate(to) ? to : undefined,
    })

  const nextDay = today ? nextProductionDate(today) : ''
  const preset =
    range.from === today && !range.to
      ? 'ab-heute'
      : range.from === nextDay && range.to === nextDay
      ? 'naechster'
      : !range.from && !range.to
      ? 'alle'
      : null

  const active = useMemo(
    () => preorders.filter((p) => p.status !== 'storniert'),
    [preorders]
  )
  const total = active.reduce((sum, p) => sum + p.total, 0)
  const dayHref = `/admin/preorders/tag${
    isBusinessDate(range.from) && range.from === range.to
      ? `?date=${range.from}`
      : nextDay
      ? `?date=${nextDay}`
      : ''
  }`

  const chipSx = { minHeight: 44 }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}
        >
          Vorbestellungen
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {canWrite && (
            <Button
              component={NextLink}
              href="/admin/preorders/neu"
              variant="contained"
              startIcon={<NewIcon />}
              sx={{ minHeight: 48 }}
            >
              Neue Vorbestellung
            </Button>
          )}
          <Button
            component={NextLink}
            href={dayHref}
            variant="outlined"
            startIcon={<DayIcon />}
            sx={{ minHeight: 48 }}
          >
            Tagesübersicht
          </Button>
          <Tooltip title="Aktualisieren">
            <span>
              <IconButton
                aria-label="Liste aktualisieren"
                onClick={load}
                disabled={loading}
                sx={{ width: 48, height: 48 }}
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
        <TextField
          label="Suche"
          placeholder="Name, Code oder Telefon"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          fullWidth
          autoComplete="off"
          InputProps={{
            startAdornment: (
              <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            ),
          }}
          inputProps={{ maxLength: 100 }}
          sx={{ mb: 1.5 }}
        />

        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 1.5 }}
        >
          <Chip
            label="Ab heute"
            color={preset === 'ab-heute' ? 'primary' : 'default'}
            variant={preset === 'ab-heute' ? 'filled' : 'outlined'}
            onClick={() => setRange(today, '')}
            aria-pressed={preset === 'ab-heute'}
            sx={chipSx}
          />
          <Chip
            label={
              nextDay
                ? `Nächster Backtag (${formatDateWithWeekday(nextDay)})`
                : 'Nächster Backtag'
            }
            color={preset === 'naechster' ? 'primary' : 'default'}
            variant={preset === 'naechster' ? 'filled' : 'outlined'}
            onClick={() => setRange(nextDay, nextDay)}
            aria-pressed={preset === 'naechster'}
            sx={chipSx}
          />
          <Chip
            label="Alle Tage"
            color={preset === 'alle' ? 'primary' : 'default'}
            variant={preset === 'alle' ? 'filled' : 'outlined'}
            onClick={() => setRange('', '')}
            aria-pressed={preset === 'alle'}
            sx={chipSx}
          />
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
            },
            gap: 1.5,
            mb: 1.5,
          }}
        >
          <TextField
            label="Von"
            type="date"
            value={range.from}
            onChange={(event) => setRange(event.target.value, range.to)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Bis"
            type="date"
            value={range.to}
            onChange={(event) => setRange(range.from, event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            label="Bestellweg"
            value={filters?.channel ?? ''}
            onChange={(event) =>
              update({
                channel: (event.target.value || undefined) as
                  | PreorderChannel
                  | undefined,
              })
            }
          >
            <MenuItem value="">Alle</MenuItem>
            {PREORDER_CHANNELS.map((channel) => (
              <MenuItem key={channel} value={channel}>
                {CHANNEL_LABELS[channel]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Abholort"
            value={filters?.pickupPointId ?? ''}
            onChange={(event) =>
              update({ pickupPointId: event.target.value || undefined })
            }
          >
            <MenuItem value="">Alle</MenuItem>
            <MenuItem value={LADEN_PICKUP}>Laden</MenuItem>
            {points.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          role="group"
          aria-label="Status"
        >
          {PREORDER_STATUSES.map((status) => {
            const on = filters?.status?.includes(status) ?? false
            return (
              <Chip
                key={status}
                label={PREORDER_STATUS_LABELS[status]}
                color={on ? 'primary' : 'default'}
                variant={on ? 'filled' : 'outlined'}
                onClick={() => toggleStatus(status)}
                aria-pressed={on}
                sx={chipSx}
              />
            )
          })}
        </Stack>
      </Paper>

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

      {!loading && !error && (
        <Typography
          color="text.secondary"
          sx={{ mb: 1 }}
          data-testid="preorder-count"
        >
          {active.length}{' '}
          {active.length === 1 ? 'Vorbestellung' : 'Vorbestellungen'} ·{' '}
          {formatCurrency(total)}
          {preorders.length > active.length
            ? ` · ${preorders.length - active.length} storniert`
            : ''}
        </Typography>
      )}

      {loading ? (
        <Box
          sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
          role="status"
          aria-label="Vorbestellungen werden geladen"
        >
          <CircularProgress />
        </Box>
      ) : preorders.length === 0 ? (
        !error && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              Keine Vorbestellungen für diese Auswahl.
            </Typography>
          </Paper>
        )
      ) : wide ? (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Vorbestellungen">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Abholung</TableCell>
                <TableCell>Kunde</TableCell>
                <TableCell>Artikel</TableCell>
                <TableCell align="right">Summe</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {preorders.map((p) => (
                <TableRow
                  key={p.id}
                  hover
                  onClick={() => router.push(`/admin/preorders/${p.id}`)}
                  sx={{
                    cursor: 'pointer',
                    ...(p.status === 'storniert' && {
                      '& td': {
                        // W4-Verifikation: text.disabled lag bei 2,7:1.
                        color: 'text.secondary',
                        textDecoration: 'line-through',
                      },
                      '& td:last-of-type': { textDecoration: 'none' },
                    }),
                  }}
                >
                  <TableCell
                    sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}
                  >
                    <NextLink
                      href={`/admin/preorders/${p.id}`}
                      style={{ color: 'inherit' }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {p.code}
                    </NextLink>
                  </TableCell>
                  <TableCell>
                    {formatDateWithWeekday(p.pickupDate)}
                    <Typography variant="body2" color="text.secondary">
                      {formatPickupPlace(p)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {p.customerName}
                    {p.customerPhone && (
                      <Typography variant="body2" color="text.secondary">
                        {p.customerPhone}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    {formatItems(p.items)}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {formatCurrency(p.total)}
                    <PaymentNote preorder={p} />
                  </TableCell>
                  <TableCell>
                    <PreorderStatusChip preorder={p} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Stack
          spacing={1}
          component="ul"
          aria-label="Vorbestellungen"
          sx={{ listStyle: 'none', p: 0, m: 0 }}
        >
          {preorders.map((p) => (
            <Card
              key={p.id}
              variant="outlined"
              component="li"
              sx={
                p.status === 'storniert'
                  ? { color: 'text.secondary', borderStyle: 'dashed' }
                  : undefined
              }
            >
              <CardActionArea
                component={NextLink}
                href={`/admin/preorders/${p.id}`}
              >
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={1}
                  >
                    <Typography sx={{ fontWeight: 600 }} noWrap>
                      {p.customerName}
                    </Typography>
                    <PreorderStatusChip preorder={p} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {formatDateWithWeekday(p.pickupDate)} ·{' '}
                    {formatPickupPlace(p)}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {formatItems(p.items)}
                  </Typography>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    sx={{ mt: 0.5 }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontFamily: 'monospace' }}
                    >
                      {p.code}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCurrency(p.total)}
                      <PaymentNote preorder={p} inline />
                    </Typography>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  )
}
