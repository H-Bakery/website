'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  GlobalStyles,
  Grid,
  LinearProgress,
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
  useTheme,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Assessment as ReportIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Link from 'next/link'
import {
  fetchPartner,
  fetchStats,
  reportCsvUrl,
} from '../../../../../lib/partnerApi'
import {
  Partner,
  PartnerStats,
  WEEKDAY_SHORT,
  formatCurrency,
  formatDate,
  formatPercent,
  shiftDate,
  toBusinessDate,
  weekdayOf,
} from '../../../../../lib/partnerTypes'

/* ------------------------------------------------------------------ *
 * Zeitraum
 * ------------------------------------------------------------------ */

type PresetKey = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'

const PRESETS: PresetKey[] = ['thisWeek', 'lastWeek', 'thisMonth', 'lastMonth']

const PRESET_LABELS: Record<PresetKey, string> = {
  thisWeek: 'Diese Woche',
  lastWeek: 'Letzte Woche',
  thisMonth: 'Dieser Monat',
  lastMonth: 'Letzter Monat',
}

interface DateRange {
  from: string
  to: string
}

/**
 * Zeitraum eines Schnellfilters - ausschließlich mit `shiftDate`/`weekdayOf`
 * gerechnet, damit keine Datums-Bibliothek nötig ist.
 *
 * Laufende Zeiträume enden bewusst *heute* und nicht am Kalenderende: ein
 * Report, der bis in die Zukunft reicht, liest sich für den Partner falsch.
 */
function rangeForPreset(preset: PresetKey, today: string): DateRange {
  const monday = shiftDate(today, -((weekdayOf(today) ?? 1) - 1))
  const monthStart = `${today.slice(0, 7)}-01`

  switch (preset) {
    case 'lastWeek':
      return { from: shiftDate(monday, -7), to: shiftDate(monday, -1) }
    case 'thisMonth':
      return { from: monthStart, to: today }
    case 'lastMonth': {
      const end = shiftDate(monthStart, -1)
      return { from: `${end.slice(0, 7)}-01`, to: end }
    }
    case 'thisWeek':
    default:
      return { from: monday, to: today }
  }
}

/* ------------------------------------------------------------------ *
 * Formatierung
 * ------------------------------------------------------------------ */

const QTY_FORMAT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })
const AVG_FORMAT = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function formatQty(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '–'
  return QTY_FORMAT.format(value)
}

function formatAvg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '–'
  return AVG_FORMAT.format(value)
}

/** Kurzes Tagesetikett für die x-Achse, z.B. `Di 02.09.` */
function axisLabel(businessDate: string, weekday: number | null): string {
  const short = weekday ? `${WEEKDAY_SHORT[weekday]} ` : ''
  return `${short}${businessDate.slice(8, 10)}.${businessDate.slice(5, 7)}.`
}

/* ------------------------------------------------------------------ *
 * Chart
 * ------------------------------------------------------------------ */

interface DayDatum {
  label: string
  fullLabel: string
  isOpen: boolean
  /** Abholung erfasst, aber nicht jedes Produkt mit Bestand gezählt. */
  isIncomplete: boolean
  delivered: number
  sold: number
  returned: number
  revenue: number
}

const PATTERN_DELIVERED = 'partnerReportOpenDelivered'
const PATTERN_SOLD = 'partnerReportOpenSold'

/** Tooltip des Tagesverlaufs - MUI-Paper, damit er im Dark Mode stimmt. */
function DayTooltip({ active, datum }: { active?: boolean; datum?: DayDatum }) {
  if (!active || !datum) return null

  const rows: Array<[string, string]> = [
    ['Geliefert', `${formatQty(datum.delivered)} Stück`],
    ['Verkauft', `${formatQty(datum.sold)} Stück`],
    ['Retoure', `${formatQty(datum.returned)} Stück`],
    ['Umsatz', formatCurrency(datum.revenue)],
  ]

  return (
    <Paper
      elevation={4}
      sx={{
        p: 1.5,
        minWidth: 190,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {datum.fullLabel}
      </Typography>
      {datum.isOpen ? (
        <Chip
          size="small"
          color="warning"
          label="offen - vorläufig"
          sx={{ mb: 1 }}
        />
      ) : datum.isIncomplete ? (
        <Chip
          size="small"
          color="warning"
          label="Abholung unvollständig - vorläufig"
          sx={{ mb: 1 }}
        />
      ) : null}
      {rows.map(([label, value]) => (
        <Box
          key={label}
          sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2">{value}</Typography>
        </Box>
      ))}
    </Paper>
  )
}

/* ------------------------------------------------------------------ *
 * Druck-Stylesheet
 * ------------------------------------------------------------------ */

/**
 * Blendet die App-Hülle (AppBar, Navigation, Breadcrumb) sowie alle
 * Bedienelemente aus und zwingt Weiß auf Schwarz - der Ausdruck ist ein
 * Dokument für den Partner, keine Bildschirmkopie. Die unter `md`
 * ausgeblendeten Spalten kommen zurück: die Druckbreite (A4 ≈ 794 px) liegt
 * unterhalb des `md`-Breakpoints, ohne diese Regel fehlten sie im PDF.
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
        '.report-no-print': { display: 'none !important' },
        '.report-root, .report-root *': {
          color: '#000 !important',
          backgroundColor: 'transparent !important',
          boxShadow: 'none !important',
        },
        '.report-root .MuiPaper-root': {
          border: '1px solid #bbb',
          breakInside: 'avoid',
        },
        '.report-root .MuiChip-root': { border: '1px solid #666' },
        '.report-root .MuiAlert-root': { border: '1px solid #666' },
        '.report-col-md': { display: 'table-cell !important' },
        '.report-table': { pageBreakInside: 'auto' },
        '.report-table thead': { display: 'table-header-group' },
        '.report-table tr': { pageBreakInside: 'avoid' },
      },
    }}
  />
)

/** Spalten, die auf schmalen Bildschirmen wegfallen - im Druck aber bleiben. */
const mdOnlyCell = { display: { xs: 'none', md: 'table-cell' } }

/* ------------------------------------------------------------------ *
 * Seite
 * ------------------------------------------------------------------ */

export default function ReportClient({ partnerId }: { partnerId: string }) {
  const theme = useTheme()

  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const [preset, setPreset] = useState<PresetKey | null>('thisWeek')
  const [createdAt, setCreatedAt] = useState('')
  const [partner, setPartner] = useState<Partner | null>(null)
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Erst nach dem Mount: `new Date()` auf dem Server und im Browser kann
  // auseinanderlaufen und würde die Hydration zerlegen.
  useEffect(() => {
    const today = toBusinessDate()
    setRange(rangeForPreset('thisWeek', today))
    setCreatedAt(
      new Date().toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    )
  }, [])

  const rangeReady = Boolean(range.from && range.to)
  const rangeInvalid = rangeReady && range.from > range.to

  const load = useCallback(async () => {
    if (!range.from || !range.to) return
    // Ungültiger Zeitraum: nichts laden, aber auch nicht im Ladezustand hängen
    // bleiben - die Warnung oberhalb erklärt, was zu tun ist.
    if (range.from > range.to) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [partnerData, statsData] = await Promise.all([
        fetchPartner(partnerId),
        fetchStats(partnerId, range),
      ])
      setPartner(partnerData)
      setStats(statsData)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Der Report konnte nicht geladen werden'
      )
    } finally {
      setLoading(false)
    }
  }, [partnerId, range])

  useEffect(() => {
    load()
  }, [load])

  const applyPreset = (key: PresetKey) => {
    setPreset(key)
    setRange(rangeForPreset(key, toBusinessDate()))
  }

  const changeRange = (field: keyof DateRange, value: string) => {
    setPreset(null)
    setRange((prev) => ({ ...prev, [field]: value }))
  }

  const chartData = useMemo<DayDatum[]>(
    () =>
      (stats?.byDay ?? []).map((day) => ({
        label: axisLabel(day.businessDate, day.weekday),
        fullLabel: formatDate(day.businessDate),
        isOpen: day.isOpen,
        isIncomplete: !day.isOpen && day.isComplete === false,
        delivered: day.deliveredQty,
        sold: day.soldQty,
        returned: day.returnedQty,
        revenue: day.revenue,
      })),
    [stats]
  )

  const deliveredColor = theme.palette.primary.main
  const soldColor = theme.palette.success.main

  const addressLines = partner
    ? [partner.street, [partner.zip, partner.city].filter(Boolean).join(' ')]
        .map((line) => line.trim())
        .filter(Boolean)
    : []

  const settlementText =
    partner?.settlementModel === 'firm_sale'
      ? 'Abrechnung: Festkauf - vergütet wird die gelieferte Ware'
      : 'Abrechnung: Kommission - vergütet wird die verkaufte Ware'

  const isEmpty = Boolean(stats && stats.byDay.length === 0)
  const csvHref =
    rangeReady && !rangeInvalid ? reportCsvUrl(partnerId, range) : ''

  return (
    <Box className="report-root">
      {printStyles}

      {/* Kopfzeile der Seite - gehört zur App, nicht zum Dokument */}
      <Box className="report-no-print" sx={{ mb: { xs: 2, md: 3 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'center' },
            gap: 1.5,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}
            >
              <ReportIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Partner-Report
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Gelieferte Ware, Abverkauf und Umsatz je Zeitraum - so
              aufbereitet, dass der Ausdruck an den Partner gehen kann
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ alignItems: 'center' }}
          >
            <Button
              size="small"
              startIcon={<BackIcon />}
              component={Link}
              href={`/admin/partners/${partnerId}`}
            >
              Zum Partner
            </Button>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={load}
              disabled={loading || !rangeReady || rangeInvalid}
            >
              Aktualisieren
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              component="a"
              href={csvHref || undefined}
              download={`partner-report-${range.from}-bis-${range.to}.csv`}
              disabled={!csvHref}
            >
              CSV exportieren
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
              disabled={!stats || rangeInvalid}
            >
              Drucken / PDF
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* Zeitraumwahl */}
      <Paper
        className="report-no-print"
        sx={{ p: { xs: 2, md: 2.5 }, mb: { xs: 2, md: 3 } }}
      >
        <Typography variant="subtitle2" gutterBottom>
          Zeitraum
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 2 }}
        >
          {PRESETS.map((key) => (
            <Button
              key={key}
              size="small"
              variant={preset === key ? 'contained' : 'outlined'}
              onClick={() => applyPreset(key)}
            >
              {PRESET_LABELS[key]}
            </Button>
          ))}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Von"
            type="date"
            size="small"
            value={range.from}
            onChange={(event) => changeRange('from', event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 190 }}
          />
          <TextField
            label="Bis"
            type="date"
            size="small"
            value={range.to}
            onChange={(event) => changeRange('to', event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 190 }}
          />
        </Stack>
      </Paper>

      {rangeInvalid && (
        <Alert severity="warning" className="report-no-print" sx={{ mb: 2 }}>
          Das Startdatum liegt nach dem Enddatum - bitte den Zeitraum
          korrigieren.
        </Alert>
      )}

      {error && (
        <Alert
          severity="error"
          className="report-no-print"
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

      {loading && !stats && (
        <Box
          className="report-no-print"
          sx={{ display: 'flex', justifyContent: 'center', py: 6 }}
        >
          <Stack alignItems="center" spacing={2}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Report wird geladen …
            </Typography>
          </Stack>
        </Box>
      )}

      {loading && stats && (
        <LinearProgress className="report-no-print" sx={{ mb: 2 }} />
      )}

      {stats && partner && !rangeInvalid && (
        <>
          {/* Report-Kopf - das ist der Teil, den CAP zu sehen bekommt */}
          <Paper sx={{ p: { xs: 2, md: 3 }, mb: { xs: 2, md: 3 } }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography variant="overline" color="text.secondary">
                  Partner-Report
                </Typography>
                <Typography variant="h5" component="h2">
                  {partner.name}
                </Typography>
                {addressLines.map((line) => (
                  <Typography key={line} variant="body2" color="text.secondary">
                    {line}
                  </Typography>
                ))}
                {addressLines.length === 0 && (
                  <Typography
                    className="report-no-print"
                    variant="caption"
                    color="text.secondary"
                  >
                    Adresse ist noch nicht hinterlegt - bitte in den
                    Partner-Stammdaten ergänzen.
                  </Typography>
                )}
                {partner.contactName && (
                  <Typography variant="body2" color="text.secondary">
                    Ansprechpartner: {partner.contactName}
                  </Typography>
                )}
              </Box>
              <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                <Typography variant="body2">
                  <strong>Zeitraum:</strong>{' '}
                  {formatDate(stats.range.from ?? range.from)} bis{' '}
                  {formatDate(stats.range.to ?? range.to)}
                </Typography>
                <Typography variant="body2">{settlementText}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatQty(stats.totals.dayCount)} Geschäftstage ·{' '}
                  {formatQty(stats.totals.visitCount)} Besuche · davon{' '}
                  {formatQty(stats.totals.refillCount)} Nachlieferungen
                </Typography>
                {createdAt && (
                  <Typography variant="body2" color="text.secondary">
                    Erstellt am {createdAt}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Paper>

          {stats.isProvisional && (
            <Alert severity="warning" sx={{ mb: { xs: 2, md: 3 } }}>
              <AlertTitle>Vorläufige Zahlen</AlertTitle>
              {stats.openDates.length > 0 && (
                <Box component="span" sx={{ display: 'block' }}>
                  {stats.openDates.length === 1
                    ? 'Ein Geschäftstag in diesem Zeitraum ist noch offen'
                    : `${stats.openDates.length} Geschäftstage in diesem Zeitraum sind noch offen`}{' '}
                  - dort wurde noch keine Abholung erfasst. Verkauf, Retoure und
                  Umsatz sind an diesen Tagen deshalb vorläufig und können sich
                  noch ändern:{' '}
                  <strong>{stats.openDates.map(formatDate).join(', ')}</strong>
                </Box>
              )}
              {(stats.incompleteDates ?? []).length > 0 && (
                <Box
                  component="span"
                  sx={{
                    display: 'block',
                    mt: stats.openDates.length > 0 ? 1 : 0,
                  }}
                >
                  {(stats.incompleteDates ?? []).length === 1
                    ? 'An einem Geschäftstag'
                    : `An ${
                        (stats.incompleteDates ?? []).length
                      } Geschäftstagen`}{' '}
                  wurde bei der Abholung nicht jedes Produkt gezählt;{' '}
                  {stats.totals.uncountedQty ?? 0} Stück sind weder als verkauft
                  noch als Retoure erfasst:{' '}
                  <strong>
                    {(stats.incompleteDates ?? []).map(formatDate).join(', ')}
                  </strong>
                </Box>
              )}
            </Alert>
          )}

          {isEmpty ? (
            <Paper sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Keine Daten im gewählten Zeitraum
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Für diesen Zeitraum wurden noch keine Besuche erfasst.
              </Typography>
            </Paper>
          ) : (
            <>
              {/* Kennzahlen */}
              <Grid
                container
                spacing={{ xs: 1.5, md: 2 }}
                sx={{ mb: { xs: 2, md: 3 } }}
              >
                {[
                  {
                    label: 'Geliefert',
                    value: `${formatQty(stats.totals.deliveredQty)} Stück`,
                  },
                  {
                    label: 'Verkauft',
                    value: `${formatQty(stats.totals.soldQty)} Stück`,
                  },
                  {
                    label: 'Retoure',
                    value: `${formatQty(stats.totals.returnedQty)} Stück`,
                  },
                  {
                    label: 'Abverkaufsquote',
                    value: formatPercent(stats.totals.sellThroughRate),
                  },
                  {
                    label: 'Umsatz (Abrechnung)',
                    value: formatCurrency(stats.totals.revenue),
                  },
                  {
                    label: 'Retourenwert',
                    value: formatCurrency(stats.totals.returnValue),
                  },
                ].map((tile) => (
                  <Grid item xs={6} sm={4} md={2} key={tile.label}>
                    <Paper sx={{ p: { xs: 1.5, md: 2 }, height: '100%' }}>
                      <Typography variant="caption" color="text.secondary">
                        {tile.label}
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 600,
                          fontSize: { xs: '1.05rem', md: '1.25rem' },
                        }}
                      >
                        {tile.value}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              {/* Je Produkt */}
              <Paper sx={{ mb: { xs: 2, md: 3 } }}>
                <Box sx={{ p: { xs: 2, md: 3 }, pb: 1 }}>
                  <Typography variant="h6" component="h3">
                    Abrechnung je Produkt
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Umsatz = verkaufte Menge × Einzelpreis zum Zeitpunkt der
                    Lieferung
                  </Typography>
                </Box>
                <TableContainer>
                  <Table size="small" className="report-table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Produkt</TableCell>
                        <TableCell
                          align="right"
                          className="report-col-md"
                          sx={mdOnlyCell}
                        >
                          Einzelpreis
                        </TableCell>
                        <TableCell align="right">Geliefert</TableCell>
                        <TableCell align="right">Verkauft</TableCell>
                        <TableCell
                          align="right"
                          className="report-col-md"
                          sx={mdOnlyCell}
                        >
                          Retoure
                        </TableCell>
                        <TableCell
                          align="right"
                          className="report-col-md"
                          sx={mdOnlyCell}
                        >
                          Abverkaufsquote
                        </TableCell>
                        <TableCell align="right">Umsatz</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.byProduct.map((product) => (
                        <TableRow key={product.productSlug} hover>
                          <TableCell>
                            {product.productName}
                            {(product.uncountedQty ?? 0) > 0 && (
                              <Typography
                                component="span"
                                variant="caption"
                                color="warning.main"
                                sx={{ display: 'block' }}
                              >
                                {product.uncountedQty} Stück ungezählt
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell
                            align="right"
                            className="report-col-md"
                            sx={mdOnlyCell}
                          >
                            {formatCurrency(product.unitPrice)}
                          </TableCell>
                          <TableCell align="right">
                            {formatQty(product.deliveredQty)}
                          </TableCell>
                          <TableCell align="right">
                            {formatQty(product.soldQty)}
                          </TableCell>
                          <TableCell
                            align="right"
                            className="report-col-md"
                            sx={mdOnlyCell}
                          >
                            {formatQty(product.returnedQty)}
                          </TableCell>
                          <TableCell
                            align="right"
                            className="report-col-md"
                            sx={mdOnlyCell}
                          >
                            {formatPercent(product.sellThroughRate)}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(product.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow
                        sx={{
                          '& td': {
                            fontWeight: 700,
                            borderTop: '2px solid',
                            borderTopColor: 'divider',
                          },
                        }}
                      >
                        <TableCell>Gesamt</TableCell>
                        <TableCell
                          align="right"
                          className="report-col-md"
                          sx={mdOnlyCell}
                        />
                        <TableCell align="right">
                          {formatQty(stats.totals.deliveredQty)}
                        </TableCell>
                        <TableCell align="right">
                          {formatQty(stats.totals.soldQty)}
                        </TableCell>
                        <TableCell
                          align="right"
                          className="report-col-md"
                          sx={mdOnlyCell}
                        >
                          {formatQty(stats.totals.returnedQty)}
                        </TableCell>
                        <TableCell
                          align="right"
                          className="report-col-md"
                          sx={mdOnlyCell}
                        >
                          {formatPercent(stats.totals.sellThroughRate)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(stats.totals.revenue)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* Tagesverlauf */}
              <Paper sx={{ p: { xs: 2, md: 3 }, mb: { xs: 2, md: 3 } }}>
                <Typography variant="h6" component="h3">
                  Tagesverlauf
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Gelieferte und verkaufte Stückzahl je Geschäftstag
                </Typography>
                <Box sx={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <pattern
                          id={PATTERN_DELIVERED}
                          patternUnits="userSpaceOnUse"
                          width="6"
                          height="6"
                          patternTransform="rotate(45)"
                        >
                          <rect
                            width="6"
                            height="6"
                            fill={deliveredColor}
                            fillOpacity={0.18}
                          />
                          <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="6"
                            stroke={deliveredColor}
                            strokeWidth="3"
                          />
                        </pattern>
                        <pattern
                          id={PATTERN_SOLD}
                          patternUnits="userSpaceOnUse"
                          width="6"
                          height="6"
                          patternTransform="rotate(45)"
                        >
                          <rect
                            width="6"
                            height="6"
                            fill={soldColor}
                            fillOpacity={0.18}
                          />
                          <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="6"
                            stroke={soldColor}
                            strokeWidth="3"
                          />
                        </pattern>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.palette.divider}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        stroke={theme.palette.text.secondary}
                        tick={{
                          fill: theme.palette.text.secondary,
                          fontSize: 12,
                        }}
                      />
                      <YAxis
                        allowDecimals={false}
                        stroke={theme.palette.text.secondary}
                        tick={{
                          fill: theme.palette.text.secondary,
                          fontSize: 12,
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: theme.palette.action.hover }}
                        content={({ active, payload }) => (
                          <DayTooltip
                            active={active}
                            datum={
                              payload && payload.length
                                ? (payload[0].payload as DayDatum)
                                : undefined
                            }
                          />
                        )}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 12 }}
                        payload={[
                          {
                            id: 'delivered',
                            value: 'Geliefert',
                            type: 'square',
                            color: deliveredColor,
                          },
                          {
                            id: 'sold',
                            value: 'Verkauft',
                            type: 'square',
                            color: soldColor,
                          },
                          {
                            id: 'open',
                            value:
                              'Schraffiert: Abholung fehlt oder unvollständig (vorläufig)',
                            type: 'square',
                            color: theme.palette.text.secondary,
                          },
                        ]}
                      />
                      <Bar
                        dataKey="delivered"
                        name="Geliefert"
                        fill={deliveredColor}
                        radius={[3, 3, 0, 0]}
                      >
                        {chartData.map((day) => (
                          <Cell
                            key={`delivered-${day.fullLabel}`}
                            fill={
                              day.isOpen || day.isIncomplete
                                ? `url(#${PATTERN_DELIVERED})`
                                : deliveredColor
                            }
                          />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="sold"
                        name="Verkauft"
                        fill={soldColor}
                        radius={[3, 3, 0, 0]}
                      >
                        {chartData.map((day) => (
                          <Cell
                            key={`sold-${day.fullLabel}`}
                            fill={
                              day.isOpen || day.isIncomplete
                                ? `url(#${PATTERN_SOLD})`
                                : soldColor
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>

              {/* Wochentags-Mittel */}
              <Paper sx={{ mb: { xs: 2, md: 3 } }}>
                <Box sx={{ p: { xs: 2, md: 3 }, pb: 1 }}>
                  <Typography variant="h6" component="h3">
                    Durchschnitt je Wochentag
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Mittelwerte über alle Geschäftstage des Zeitraums - die
                    Grundlage für spätere Mengenempfehlungen (&bdquo;dienstags
                    werden im Schnitt 12 von 20 Broten verkauft, also 14
                    liefern&ldquo;).
                  </Typography>
                </Box>
                <TableContainer>
                  <Table size="small" className="report-table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Wochentag</TableCell>
                        <TableCell align="right">Tage</TableCell>
                        <TableCell align="right">Ø Geliefert</TableCell>
                        <TableCell align="right">Ø Verkauft</TableCell>
                        <TableCell
                          align="right"
                          className="report-col-md"
                          sx={mdOnlyCell}
                        >
                          Ø Retoure
                        </TableCell>
                        <TableCell
                          align="right"
                          className="report-col-md"
                          sx={mdOnlyCell}
                        >
                          Abverkaufsquote
                        </TableCell>
                        <TableCell align="right">Ø Umsatz</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.byWeekday.map((day) => (
                        <TableRow key={day.weekday} hover>
                          <TableCell>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <span>{day.weekdayLabel}</span>
                              {day.openDayCount > 0 && (
                                <Chip
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                  label={`${day.openDayCount} offen`}
                                />
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            {formatQty(day.dayCount)}
                          </TableCell>
                          <TableCell align="right">
                            {formatAvg(day.avgDeliveredQty)}
                          </TableCell>
                          <TableCell align="right">
                            {formatAvg(day.avgSoldQty)}
                          </TableCell>
                          <TableCell
                            align="right"
                            className="report-col-md"
                            sx={mdOnlyCell}
                          >
                            {formatAvg(day.avgReturnedQty)}
                          </TableCell>
                          <TableCell
                            align="right"
                            className="report-col-md"
                            sx={mdOnlyCell}
                          >
                            {formatPercent(day.sellThroughRate)}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(day.avgRevenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}
        </>
      )}
    </Box>
  )
}
