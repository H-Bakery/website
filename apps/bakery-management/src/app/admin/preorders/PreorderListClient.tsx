'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  MenuItem,
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
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import ItemsSummary from '../../../components/preorders/ItemsSummary'
import PaymentNote from '../../../components/preorders/PaymentNote'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../components/layout'
import PreorderStatusChip from '../../../components/preorders/PreorderStatusChip'
import { useOptionalSession } from '../../../lib/session'
import {
  fetchPickupPointInfo,
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
  formatPickupPlace,
  isBusinessDate,
  nextProductionDate,
  toBusinessDate,
  type PickupDays,
  type PickupPoint,
  type Preorder,
  type PreorderChannel,
  type PreorderListFilters,
  type PreorderStatus,
} from '../../../lib/preordersTypes'

const SEARCH_DELAY_MS = 300

export interface PreorderListClientProps {
  /** Aus der URL; `undefined` = Vorgabe „ab heute“. */
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
  // Gesperrte Abholtage vom Server (Z14); `null` = nur der Ruhetag.
  const [pickupDays, setPickupDays] = useState<PickupDays | null>(null)
  const [preorders, setPreorders] = useState<Preorder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const now = toBusinessDate(new Date())
    setToday(now)
    setFilters((current) => current ?? { from: now })
    fetchPickupPointInfo()
      .then((info) => {
        setPoints(info.points)
        setPickupDays(info.pickupDays)
      })
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

  // Schließtage des Kalenders sind kein Backtag (Z14).
  const nextDay = today ? nextProductionDate(today, pickupDays) : ''
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

  // Weitere Filter (Zeitraum, Bestellweg, Abholort, Status): am PC offen,
  // am Handy zugeklappt mit Zusammenfassung - sonst lagen ~330 px Filter vor
  // dem ersten Treffer.
  const [filtersOpenChoice, setFiltersOpenChoice] = useState<boolean | null>(
    null
  )
  const filtersOpen = filtersOpenChoice ?? wide
  const pointName = (id: string) =>
    id === LADEN_PICKUP
      ? 'Laden'
      : points.find((p) => p.id === id)?.name ?? 'Sammelstelle'
  const filterSummary = [
    preset === null && (range.from || range.to)
      ? `${range.from ? formatDateWithWeekday(range.from) : '…'} – ${
          range.to ? formatDateWithWeekday(range.to) : '…'
        }`
      : null,
    filters?.channel ? CHANNEL_LABELS[filters.channel] : null,
    filters?.pickupPointId ? pointName(filters.pickupPointId) : null,
    ...(filters?.status ?? []).map((s) => PREORDER_STATUS_LABELS[s]),
  ].filter((part): part is string => Boolean(part))

  // Zahlen sind keine Überschrift (Layout-Kit): Anzahl im Titel, Summe und
  // Stornierte als Beschreibung darunter (UI-Runde 1).
  const countTitle = `Bestellungen (${active.length})`
  const countLine = !loading && !error && (
    <span data-testid="preorder-count">
      Summe {formatCurrency(total)}
      {preorders.length > active.length
        ? ` · dazu ${preorders.length - active.length} storniert`
        : ''}
    </span>
  )

  return (
    <PageLayout
      width="wide"
      title="Vorbestellungen"
      subtitle="Alle Bestellwege und Abholorte"
      actions={
        <>
          {canWrite && (
            <Button
              component={NextLink}
              href="/admin/preorders/neu"
              variant="contained"
              startIcon={<NewIcon />}
            >
              Neue Vorbestellung
            </Button>
          )}
          <Button
            component={NextLink}
            href={dayHref}
            variant="outlined"
            startIcon={<DayIcon />}
          >
            Tagesübersicht
          </Button>
        </>
      }
    >
      <PageSection>
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
          alignItems="center"
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
          <Button
            onClick={() => setFiltersOpenChoice(!filtersOpen)}
            aria-expanded={filtersOpen}
            aria-controls="preorder-filters"
            startIcon={<FilterIcon />}
            endIcon={
              <ExpandMoreIcon
                sx={{
                  transition: 'transform 0.2s',
                  transform: filtersOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            }
            sx={{ ml: { sm: 'auto' } }}
          >
            {filterSummary.length > 0
              ? `Weitere Filter (${filterSummary.length})`
              : 'Weitere Filter'}
          </Button>
        </Stack>
        {!filtersOpen && filterSummary.length > 0 && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1 }}
            data-testid="filter-summary"
          >
            Aktiv: {filterSummary.join(' · ')}
          </Typography>
        )}

        <Collapse in={filtersOpen} id="preorder-filters" unmountOnExit>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1.5,
              mt: 2,
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
        </Collapse>
      </PageSection>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <LoadingState label="Vorbestellungen werden geladen …" />
      ) : preorders.length === 0 ? (
        <EmptyState
          title="Keine Vorbestellungen für diese Auswahl."
          description="Suche oder Filter ändern - oder „Alle Tage“ wählen."
        />
      ) : (
        <PageSection
          title={countTitle}
          description={countLine}
          variant={wide ? 'card' : 'plain'}
          disablePadding
          actions={
            <Tooltip title="Aktualisieren">
              <span>
                <IconButton
                  aria-label="Liste aktualisieren"
                  onClick={load}
                  disabled={loading}
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          }
        >
          {wide ? (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Vorbestellungen">
                <TableHead>
                  <TableRow>
                    {/* Status gleich hinter dem Code: am Laden-Tablet quer
                        (1180 px) war er rechts abgeschnitten (UI-Runde 1). */}
                    <TableCell>Code</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Abholung</TableCell>
                    <TableCell>Kunde</TableCell>
                    <TableCell>Artikel</TableCell>
                    <TableCell align="right">Summe</TableCell>
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
                        verticalAlign: 'top',
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
                        <PreorderStatusChip preorder={p} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 130, maxWidth: 220 }}>
                        <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                          {formatDateWithWeekday(p.pickupDate)}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {formatPickupPlace(p)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 140, maxWidth: 280 }}>
                        <Box sx={{ overflowWrap: 'break-word' }}>
                          {p.customerName}
                        </Box>
                        {p.customerPhone && (
                          <Typography variant="body2" color="text.secondary">
                            {p.customerPhone}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 180, maxWidth: 360 }}>
                        <ItemsSummary items={p.items} />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {formatCurrency(p.total)}
                        <PaymentNote preorder={p} />
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
                  component="li"
                  sx={
                    p.status === 'storniert'
                      ? {
                          color: 'text.secondary',
                          border: 1,
                          borderStyle: 'dashed',
                          borderColor: 'divider',
                        }
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
                      <Typography
                        variant="body2"
                        component="div"
                        sx={{ mt: 0.5 }}
                      >
                        <ItemsSummary items={p.items} />
                      </Typography>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="baseline"
                        spacing={1}
                        sx={{ mt: 0.5 }}
                      >
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontFamily: 'monospace' }}
                        >
                          {p.code}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, textAlign: 'right' }}
                        >
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
        </PageSection>
      )}
    </PageLayout>
  )
}
