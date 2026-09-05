'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
  Typography,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { fetchPickupPoints, fetchPreorderSummary } from '../preorderApi'
import {
  DELIVERY_WEEKDAY_LABELS,
  PickupPoint,
  PreorderSummary,
  deliveryWeekdayOf,
  formatCurrency,
  formatDate,
  isBusinessDate,
  nextDeliveryDate,
} from '../preorderTypes'

/** Samstag - der Liefertag, solange keine Sammelstelle geladen ist. */
const DEFAULT_WEEKDAY = 6

const LIST_HREF = '/admin/delivery/preorders'

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/* ------------------------------------------------------------------ *
 * Druck-Stylesheet
 * ------------------------------------------------------------------ */

/**
 * Dasselbe Muster wie im Partnerbericht (`partners/[id]/report/ReportClient`).
 * Zwei Dinge müssen hier stehen und nicht im `sx` des Blattes:
 *
 * - `TableCell` setzt seine Textfarbe selbst (`palette.text.primary`, im
 *   dunklen Admin-Bereich also weiß). Eine eigene Regel schlägt Vererbung -
 *   ohne `.backing-list-root *` druckte die Backliste weiß auf weiß, und in
 *   der Backstube hinge ein leeres Blatt.
 * - AppBar, Navigation und Breadcrumb kommen aus `admin/layout.tsx` und
 *   würden sonst mitgedruckt und das Blatt nach rechts schieben.
 */
const printStyles = (
  <GlobalStyles
    styles={{
      '@page': { margin: '14mm' },
      '@media print': {
        'html, body': {
          background: '#fff !important',
          color: '#000 !important',
        },
        '.MuiAppBar-root, nav, .MuiDrawer-root, [aria-label="Pfad"]': {
          display: 'none !important',
        },
        main: {
          padding: '0 !important',
          width: '100% !important',
        },
        'main > .MuiToolbar-root': { display: 'none !important' },
        '.backing-list-root, .backing-list-root *': {
          color: '#000 !important',
          backgroundColor: 'transparent !important',
          boxShadow: 'none !important',
        },
        '.backing-list-root .MuiTableCell-root': {
          borderBottom: '1px solid #bbb',
        },
        '.backing-list-root tr': { pageBreakInside: 'avoid' },
        '.backing-list-root thead': { display: 'table-header-group' },
      },
    }}
  />
)

export interface BackingListClientProps {
  initialDate?: string
  initialPickupPointId?: string
}

/**
 * Die Backliste: Menge je Produkt über alle Vorbestellungen eines Liefertags.
 *
 * Das ist das Blatt, das samstags früh in der Backstube hängt - deshalb große
 * Zahlen und ein Druckbild ohne Bedienelemente. Gezählt wird auf dem Server
 * (`GET /preorders/summary`), hier wird nur angezeigt.
 */
export default function BackingListClient({
  initialDate,
  initialPickupPointId,
}: BackingListClientProps) {
  const router = useRouter()

  const [points, setPoints] = useState<PickupPoint[]>([])
  const [pointId, setPointId] = useState(initialPickupPointId ?? '')
  // Leer starten - der Vorgabetag kommt aus der Uhr (Hydration).
  const [date, setDate] = useState(initialDate ?? '')
  const [summary, setSummary] = useState<PreorderSummary | null>(null)
  const [pointsLoaded, setPointsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const point = useMemo(
    () => points.find((p) => p.id === pointId) ?? null,
    [points, pointId]
  )

  useEffect(() => {
    let active = true
    fetchPickupPoints()
      .then((list) => {
        if (!active) return
        setPoints(list)
        const first =
          list.find((p) => p.id === initialPickupPointId) ??
          list.find((p) => p.active !== false) ??
          list[0] ??
          null
        if (first && !initialPickupPointId) setPointId(first.id)
        setDate((current) =>
          isBusinessDate(current)
            ? current
            : nextDeliveryDate(first ? first.weekday : DEFAULT_WEEKDAY)
        )
      })
      .catch(() => {
        if (!active) return
        setDate((current) =>
          isBusinessDate(current) ? current : nextDeliveryDate(DEFAULT_WEEKDAY)
        )
      })
      .finally(() => {
        if (active) setPointsLoaded(true)
      })
    return () => {
      active = false
    }
  }, [initialPickupPointId])

  const load = useCallback(async () => {
    if (!isBusinessDate(date)) return
    setLoading(true)
    setError(null)
    try {
      setSummary(await fetchPreorderSummary(date, pointId || undefined))
    } catch (err) {
      setSummary(null)
      setError(messageOf(err, 'Die Backliste konnte nicht geladen werden'))
    } finally {
      setLoading(false)
    }
  }, [date, pointId])

  // Erst laden, wenn die Sammelstellen da sind - sonst liefe der erste Aufruf
  // ohne `pickupPointId` und der zweite gleich hinterher.
  useEffect(() => {
    if (pointsLoaded) load()
  }, [load, pointsLoaded])

  const weekday = isBusinessDate(date) ? deliveryWeekdayOf(date) : null
  const totalQty = (summary?.byProduct ?? []).reduce(
    (sum, entry) => sum + entry.qty,
    0
  )

  return (
    <Box className="backing-list-root" sx={{ maxWidth: 800, mx: 'auto' }}>
      {printStyles}
      {/* Bedienleiste - im Druckbild ausgeblendet. */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        sx={{ mb: 2, displayPrint: 'none' }}
      >
        <IconButton
          aria-label="Zurück zur Liste"
          onClick={() =>
            router.push(
              `${LIST_HREF}${isBusinessDate(date) ? `?date=${date}` : ''}`
            )
          }
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <TextField
          label="Liefertag"
          type="date"
          size="small"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 170 }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <IconButton
          aria-label="Backliste aktualisieren"
          onClick={load}
          disabled={loading || !isBusinessDate(date)}
        >
          <RefreshIcon />
        </IconButton>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
        >
          Drucken
        </Button>
      </Stack>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, displayPrint: 'none' }}
          action={
            <Button color="inherit" size="small" onClick={load}>
              Erneut versuchen
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Das Blatt. Im Druck bewusst schwarz auf weiß: der Admin-Bereich ist
          dunkel, und ein dunkles Blatt kostet nur Toner. Die Farben stehen in
          `printStyles` - im `sx` erreichten sie die Tabellenzellen nicht. */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 3 },
          '@media print': {
            border: 'none',
            boxShadow: 'none',
          },
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontSize: { xs: '1.6rem', md: '2rem' } }}
        >
          Backliste Vorbestellungen
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          {isBusinessDate(date)
            ? `${
                weekday != null ? `${DELIVERY_WEEKDAY_LABELS[weekday]}, ` : ''
              }${formatDate(date)}`
            : 'Kein gültiger Liefertag gewählt'}
          {point ? ` · ${point.name}` : ''}
          {point?.window ? ` · Übergabe ${point.window} Uhr` : ''}
        </Typography>

        {loading ? (
          <Box
            sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
            role="status"
            aria-label="Backliste wird geladen"
          >
            <CircularProgress />
          </Box>
        ) : !summary || summary.byProduct.length === 0 ? (
          !error && (
            <Typography color="text.secondary" sx={{ py: 4 }}>
              Für diesen Tag ist nichts vorbestellt.
            </Typography>
          )
        ) : (
          <>
            <TableContainer>
              <Table aria-label="Menge je Produkt">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 120, fontSize: '1.1rem' }}>
                      Menge
                    </TableCell>
                    <TableCell sx={{ fontSize: '1.1rem' }}>Produkt</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.byProduct.map((entry) => (
                    <TableRow key={entry.productId}>
                      <TableCell>
                        <Typography
                          variant="h5"
                          component="span"
                          sx={{ fontWeight: 700 }}
                        >
                          {entry.qty}
                        </Typography>
                        <Typography
                          variant="body2"
                          component="span"
                          sx={{ ml: 0.5 }}
                        >
                          {entry.unit}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="h6" component="span">
                          {entry.name}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="body1" sx={{ mt: 3 }}>
              {summary.count} Vorbestellung{summary.count === 1 ? '' : 'en'} ·{' '}
              {totalQty} Stück · {formatCurrency(summary.total)} zu kassieren
              {summary.cancelled > 0
                ? ` · ${summary.cancelled} storniert (nicht enthalten)`
                : ''}
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  )
}
