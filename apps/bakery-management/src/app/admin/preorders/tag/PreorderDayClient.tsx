'use client'

import React, { useCallback, useEffect, useState } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  GlobalStyles,
  IconButton,
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
} from '@mui/material'
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  ListAlt as ListIcon,
  Print as PrintIcon,
} from '@mui/icons-material'
import PreorderStatusChip from '../../../../components/preorders/PreorderStatusChip'
import {
  fetchPreorderDay,
  preorderErrorMessage,
} from '../../../../lib/preordersApi'
import {
  CHANNEL_LABELS,
  formatCurrency,
  formatDateWithWeekday,
  formatItems,
  formatPickupPlace,
  isBusinessDate,
  isProductionDay,
  nextProductionDate,
  shiftDate,
  toBusinessDate,
  variantLabel,
  type PreorderChannel,
  type PreorderDay,
} from '../../../../lib/preordersTypes'
import { TOUCH_LINK_STYLE } from '../../../../lib/muiTheme'

/**
 * Druckbild A4, schwarz auf weiß - der Admin-Bereich ist dunkel. Die Farben
 * stehen hier und nicht im `sx`: `TableCell` setzt seine Textfarbe selbst
 * (wie in der Mörsbach-Backliste). AppBar, Navigation, Pfad und Bedien-
 * elemente fallen weg.
 */
const printStyles = (
  <GlobalStyles
    styles={{
      '@page': { size: 'A4', margin: '12mm' },
      '@media print': {
        'html, body': {
          background: '#fff !important',
          color: '#000 !important',
        },
        '.MuiAppBar-root, nav, .MuiDrawer-root, [aria-label="Pfad"]': {
          display: 'none !important',
        },
        main: { padding: '0 !important', width: '100% !important' },
        'main > .MuiToolbar-root': { display: 'none !important' },
        '.preorder-day-root, .preorder-day-root *': {
          color: '#000 !important',
          backgroundColor: 'transparent !important',
          boxShadow: 'none !important',
        },
        '.preorder-day-root .MuiPaper-root': { border: 'none !important' },
        '.preorder-day-root .MuiChip-root': {
          border: '1px solid #000 !important',
        },
        '.preorder-day-root .MuiTableCell-root': {
          borderBottom: '1px solid #bbb',
          padding: '4px 6px',
        },
        '.preorder-day-root tr': { pageBreakInside: 'avoid' },
        '.preorder-day-root thead': { display: 'table-header-group' },
        '.preorder-day-noprint': { display: 'none !important' },
      },
    }}
  />
)

/** Schmalere Zellen am Telefon; die Summen-Tabelle passt so auf 390 px. */
const COMPACT_TABLE = { '& td, & th': { px: { xs: 1, sm: 2 } } } as const

function Tile({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string | null
}) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h6" component="p" sx={{ fontSize: '1.15rem' }}>
        {value}
      </Typography>
      {note ? (
        <Typography variant="caption" color="text.secondary" display="block">
          {note}
        </Typography>
      ) : null}
    </Box>
  )
}

/** Vorheriger/nächster Produktionstag (Montag übersprungen). */
function stepDay(date: string, direction: 1 | -1): string {
  let day = shiftDate(date, direction)
  while (!isProductionDay(day)) day = shiftDate(day, direction)
  return day
}

/**
 * P3: Tagesübersicht - was an einem Abholtag vorbestellt ist, summiert je
 * Produkt und Sorte (für die Backstube), dazu die Bestellungen und ein
 * A4-Druck. Gerechnet wird auf dem Server (`GET /api/preorders/day`);
 * stornierte zählen nirgends mit.
 */
export default function PreorderDayClient({
  initialDate,
}: {
  initialDate?: string
}) {
  const router = useRouter()
  // Leer starten: der Vorgabetag kommt aus der Uhr (Hydration).
  const [date, setDate] = useState(initialDate ?? '')
  const [day, setDay] = useState<PreorderDay | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDate((current) =>
      isBusinessDate(current)
        ? current
        : nextProductionDate(toBusinessDate(new Date()))
    )
  }, [])

  const load = useCallback(async () => {
    if (!isBusinessDate(date)) return
    setLoading(true)
    setError(null)
    try {
      setDay(await fetchPreorderDay(date))
    } catch (err) {
      setDay(null)
      setError(
        preorderErrorMessage(
          err,
          'Die Tagesübersicht konnte nicht geladen werden.'
        )
      )
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  const changeDate = (next: string) => {
    setDate(next)
    if (isBusinessDate(next)) {
      router.replace(`/admin/preorders/tag?date=${next}`, { scroll: false })
    }
  }

  const summary = day?.summary
  const channels = summary
    ? (Object.entries(summary.byChannel) as Array<[PreorderChannel, number]>)
        .filter(([, n]) => n > 0)
        .map(([c, n]) => `${CHANNEL_LABELS[c] ?? c} ${n}`)
        .join(' · ')
    : ''

  return (
    <Box className="preorder-day-root">
      {printStyles}

      <Stack
        className="preorder-day-noprint"
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Vorheriger Backtag">
            <span>
              <IconButton
                aria-label="Vorheriger Backtag"
                onClick={() => changeDate(stepDay(date, -1))}
                disabled={!isBusinessDate(date)}
                sx={{ width: 48, height: 48 }}
              >
                <PrevIcon />
              </IconButton>
            </span>
          </Tooltip>
          <TextField
            label="Abholtag"
            type="date"
            size="small"
            value={date}
            onChange={(event) => changeDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 170, flex: { xs: 1, md: 'none' } }}
          />
          <Tooltip title="Nächster Backtag">
            <span>
              <IconButton
                aria-label="Nächster Backtag"
                onClick={() => changeDate(stepDay(date, 1))}
                disabled={!isBusinessDate(date)}
                sx={{ width: 48, height: 48 }}
              >
                <NextIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          component={NextLink}
          href="/admin/preorders"
          startIcon={<ListIcon />}
          sx={{ minHeight: 48 }}
        >
          Alle Vorbestellungen
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
          disabled={!day}
          sx={{ minHeight: 48 }}
        >
          Drucken
        </Button>
      </Stack>

      <Typography
        variant="h4"
        component="h1"
        sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}
      >
        Vorbestellungen{' '}
        {isBusinessDate(date) ? formatDateWithWeekday(date) : ''}
      </Typography>
      {isBusinessDate(date) && !isProductionDay(date) && (
        <Alert severity="info" sx={{ mt: 1 }} className="preorder-day-noprint">
          Montag ist Ruhetag - an diesem Tag wird nicht gebacken.
        </Alert>
      )}

      {error && (
        <Alert
          severity="error"
          sx={{ my: 2 }}
          className="preorder-day-noprint"
          action={
            <Button color="inherit" size="small" onClick={load}>
              Erneut versuchen
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading && !day ? (
        <Box
          sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
          role="status"
          aria-label="Tagesübersicht wird geladen"
        >
          <CircularProgress />
        </Box>
      ) : (
        day &&
        summary && (
          <>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {summary.count}{' '}
              {summary.count === 1 ? 'Bestellung' : 'Bestellungen'}
              {channels ? ` · ${channels}` : ''}
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(3, minmax(0, 1fr))',
                  lg: 'repeat(6, minmax(0, 1fr))',
                },
                gap: 1.5,
                mb: 3,
              }}
            >
              <Tile label="Bestellungen" value={String(summary.count)} />
              <Tile label="Summe" value={formatCurrency(summary.total)} />
              <Tile label="Offen" value={String(summary.byStatus.offen)} />
              <Tile label="Bereit" value={String(summary.byStatus.bereit)} />
              <Tile
                label="Abgeholt"
                value={String(summary.byStatus.abgeholt)}
              />
              <Tile
                label="Noch zu kassieren"
                value={formatCurrency(summary.unpaidTotal)}
                note={
                  [
                    (summary.topUpTotal ?? 0) > 0
                      ? `davon ${formatCurrency(
                          summary.topUpTotal ?? 0
                        )} Rest bezahlter`
                      : null,
                    (summary.handedOverUnpaidTotal ?? 0) > 0
                      ? `+ ${formatCurrency(
                          summary.handedOverUnpaidTotal ?? 0
                        )} ohne Zahlung übergeben`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || null
                }
              />
              {(summary.refundTotal ?? 0) > 0 && (
                <Tile
                  label="Zu erstatten"
                  value={formatCurrency(summary.refundTotal ?? 0)}
                  note={`${
                    summary.refundCount ?? 0
                  } bezahlt und storniert oder billiger geworden`}
                />
              )}
            </Box>

            <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
              Summen je Produkt
            </Typography>
            {day.sums.length === 0 ? (
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                Für diesen Tag ist nichts vorbestellt.
              </Typography>
            ) : (
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ mb: 3 }}
              >
                <Table
                  size="small"
                  aria-label="Summen je Produkt und Sorte"
                  sx={COMPACT_TABLE}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>Produkt</TableCell>
                      <TableCell>Sorte</TableCell>
                      <TableCell align="right">Menge</TableCell>
                      <TableCell align="right">Bestellungen</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {day.sums.map((sum) => (
                      <TableRow key={`${sum.productId}|${sum.variant}`}>
                        <TableCell>{sum.name}</TableCell>
                        <TableCell>
                          {variantLabel(sum.variant) || '–'}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ fontWeight: 700, fontSize: '1.05rem' }}
                        >
                          {sum.quantity}
                          {sum.unit === 'Stück' ? '' : ` ${sum.unit}`}
                        </TableCell>
                        <TableCell align="right">{sum.preorders}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {day.pickupPoints.length > 0 && (
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {day.pickupPoints
                  .map(
                    (p) =>
                      `${p.name}: ${p.preorderCount} ${
                        p.preorderCount === 1 ? 'Bestellung' : 'Bestellungen'
                      }${p.window ? ` (Übergabe ${p.window})` : ''}`
                  )
                  .join(' · ')}
              </Typography>
            )}

            <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
              Bestellungen
            </Typography>
            {day.preorders.length === 0 ? (
              <Typography color="text.secondary">Keine.</Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table
                  size="small"
                  aria-label="Bestellungen des Tages"
                  sx={COMPACT_TABLE}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>Code</TableCell>
                      <TableCell>Kunde</TableCell>
                      <TableCell>Abholung</TableCell>
                      <TableCell>Artikel</TableCell>
                      <TableCell align="right">Summe</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {day.preorders.map((p) => (
                      <TableRow
                        key={p.id}
                        sx={
                          p.status === 'storniert'
                            ? {
                                '& td': {
                                  color: 'text.secondary',
                                  textDecoration: 'line-through',
                                },
                              }
                            : undefined
                        }
                      >
                        <TableCell
                          sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}
                        >
                          <NextLink
                            href={`/admin/preorders/${p.id}`}
                            style={{ color: 'inherit', ...TOUCH_LINK_STYLE }}
                          >
                            {p.code}
                          </NextLink>
                        </TableCell>
                        <TableCell>
                          {p.customerName}
                          {p.customerPhone && (
                            <Typography variant="body2" color="text.secondary">
                              {p.customerPhone}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{formatPickupPlace(p)}</TableCell>
                        <TableCell>{formatItems(p.items)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {formatCurrency(p.total)}
                          {p.paid ? ' ✓' : ''}
                        </TableCell>
                        <TableCell>
                          <PreorderStatusChip preorder={p} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: 'block' }}
            >
              ✓ = bezahlt. Stornierte stehen grau in der Liste und zählen in
              keiner Summe - außer schon Bezahltes unter „Zu erstatten“.
            </Typography>
          </>
        )
      )}
    </Box>
  )
}
