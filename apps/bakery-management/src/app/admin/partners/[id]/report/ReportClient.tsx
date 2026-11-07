'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  GlobalStyles,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material'
import {
  Download as DownloadIcon,
  Print as PrintIcon,
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
import {
  fetchPartner,
  fetchStats,
  downloadReportCsv,
} from '../../../../../lib/partnerApi'
import {
  Partner,
  PartnerStats,
  WEEKDAY_SHORT,
  formatCurrency,
  formatDate,
  formatPercent,
  formatUnitPrice,
  plural,
  shiftDate,
  toBusinessDate,
  weekdayOf,
} from '../../../../../lib/partnerTypes'
import {
  EmptyState,
  ErrorState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../../components/layout'
import { ProvisionalBadge } from '../../partnerUi'
import { errorText } from '../../errorText'

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
        // Seitenkopf der App (Rücklink, Knöpfe) gehört nicht aufs Papier -
        // den Kopf des Dokuments liefert `.report-print-only`.
        '.report-root [data-testid="page-header"]': {
          display: 'none !important',
        },
        '.report-print-only': { display: 'block !important' },
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
        // A4 ist schmaler als die Tabelle mit Bildschirm-Abständen - sonst
        // fehlt rechts die Spalte „Umsatz“.
        '.report-table .MuiTableCell-root': {
          padding: '4px 6px !important',
        },
        // Achsenbeschriftung des Diagramms: im (Standard-)Dunkelmodus hell
        // eingefärbt und damit auf Papier unsichtbar.
        '.report-root svg text': { fill: '#000 !important' },
        '.report-root .recharts-cartesian-axis-line, .report-root .recharts-cartesian-axis-tick-line':
          { stroke: '#000 !important' },
        '.report-table thead': { display: 'table-header-group' },
        '.report-table tr': { pageBreakInside: 'avoid' },
      },
    }}
  />
)

/** Am Handy schmalere Zellränder, damit „Umsatz“ nicht aus dem Bild rutscht. */
const COMPACT_TABLE = {
  '& .MuiTableCell-root': { px: { xs: 1, sm: 2 } },
  '& .MuiTableCell-root:first-of-type': { pl: { xs: 2, sm: 2 } },
}

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
  const [csvBusy, setCsvBusy] = useState(false)
  const [csvError, setCsvError] = useState<string | null>(null)

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

  /** Nur die jüngste Anfrage darf den Zustand setzen (schnelles Umschalten). */
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    if (!range.from || !range.to) return
    const request = ++requestRef.current
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
      if (request !== requestRef.current) return
      setPartner(partnerData)
      setStats(statsData)
    } catch (err) {
      if (request !== requestRef.current) return
      setError(errorText(err, 'Der Report konnte nicht geladen werden'))
    } finally {
      if (request === requestRef.current) setLoading(false)
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

  const countsText = stats
    ? `${plural(
        stats.totals.dayCount,
        'Geschäftstag',
        'Geschäftstage'
      )} · ${plural(
        stats.totals.visitCount,
        'Besuch',
        'Besuche'
      )} · davon ${plural(
        stats.totals.refillCount,
        'Nachlieferung',
        'Nachlieferungen'
      )}`
    : ''

  const isEmpty = Boolean(stats && stats.byDay.length === 0)
  const csvReady = rangeReady && !rangeInvalid

  // F4: Download über fetch mit Token - ein schlichter Link bekäme von der
  // echten API 401 (jede Route braucht eine Sitzung).
  const exportCsv = async () => {
    if (!csvReady || csvBusy) return
    setCsvBusy(true)
    setCsvError(null)
    try {
      await downloadReportCsv(partnerId, range)
    } catch (err) {
      setCsvError(errorText(err, 'Der CSV-Export ist fehlgeschlagen.'))
    } finally {
      setCsvBusy(false)
    }
  }

  const periodText = rangeReady
    ? `${formatDate(stats?.range.from ?? range.from)} bis ${formatDate(
        stats?.range.to ?? range.to
      )}`
    : ''
  const provisional = Boolean(stats?.isProvisional)
  const openQty = stats?.totals.openQty ?? 0

  return (
    <Box className="report-root">
      {printStyles}

      <PageLayout
        title="Partner-Report"
        subtitle={
          partner
            ? `${partner.name}${periodText ? ` · ${periodText}` : ''}`
            : 'Abverkauf und Umsatz je Zeitraum - zum Ausdrucken für den Partner'
        }
        back={{
          href: `/admin/partners/${partnerId}`,
          label: 'Zurück zum Partner',
        }}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={
                csvBusy ? <CircularProgress size={16} /> : <DownloadIcon />
              }
              onClick={exportCsv}
              disabled={!csvReady || csvBusy}
            >
              CSV exportieren
            </Button>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
              disabled={!stats || rangeInvalid}
            >
              Drucken / PDF
            </Button>
          </>
        }
      >
        {/* Zeitraumwahl - gehört zur App, nicht zum Dokument */}
        <Box className="report-no-print">
          <PageSection
            title="Zeitraum"
            description={
              stats && partner && !rangeInvalid ? (
                // Eckdaten des Zeitraums gehören zur Zeitraumwahl - vorher
                // stand die Zeile lose zwischen den Abschnitten.
                <Box component="span" data-testid="report-counts">
                  {countsText} · {settlementText}
                  {addressLines.length === 0 &&
                    ' · Adresse noch nicht hinterlegt'}
                </Box>
              ) : undefined
            }
          >
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <ToggleButtonGroup
                exclusive
                size="small"
                value={preset}
                onChange={(_event, key: PresetKey | null) =>
                  key && applyPreset(key)
                }
                aria-label="Schnellauswahl Zeitraum"
                sx={(t) => ({
                  // Am Handy 2 × 2 statt einer umbrechenden Leiste mit
                  // abgeschnittenem Rahmen.
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1,
                  width: '100%',
                  '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5 },
                  '& .MuiToggleButtonGroup-grouped': {
                    m: 0,
                    border: `1px solid ${t.palette.divider}`,
                    borderRadius: `${t.shape.borderRadius}px`,
                  },
                  [t.breakpoints.up('sm')]: {
                    display: 'inline-flex',
                    gap: 0,
                    width: 'auto',
                    '& .MuiToggleButtonGroup-grouped:not(:first-of-type)': {
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                      borderLeft: 0,
                    },
                    '& .MuiToggleButtonGroup-grouped:not(:last-of-type)': {
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                    },
                  },
                })}
              >
                {PRESETS.map((key) => (
                  <ToggleButton key={key} value={key}>
                    {PRESET_LABELS[key]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <TextField
                  label="Von"
                  type="date"
                  size="small"
                  value={range.from}
                  onChange={(event) => changeRange('from', event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 170 }}
                />
                <TextField
                  label="Bis"
                  type="date"
                  size="small"
                  value={range.to}
                  onChange={(event) => changeRange('to', event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 170 }}
                />
              </Box>
            </Box>
          </PageSection>
        </Box>

        {rangeInvalid && (
          <Alert severity="warning" className="report-no-print">
            Das Startdatum liegt nach dem Enddatum - bitte den Zeitraum
            korrigieren.
          </Alert>
        )}

        {csvError && (
          <Alert
            severity="error"
            className="report-no-print"
            onClose={() => setCsvError(null)}
          >
            CSV-Export fehlgeschlagen: {csvError}
          </Alert>
        )}

        {error && (
          <Box className="report-no-print">
            <ErrorState message={error} onRetry={load} />
          </Box>
        )}

        {loading && !stats && (
          <Box className="report-no-print">
            <LoadingState label="Report wird geladen …" />
          </Box>
        )}

        {loading && stats && <LinearProgress className="report-no-print" />}

        {stats && partner && !rangeInvalid && (
          <>
            {/* Kopf des Ausdrucks - das bekommt der Partner zu sehen. Am
                Bildschirm stehen Partner und Zeitraum schon im Seitenkopf. */}
            <Box
              className="report-print-only"
              data-testid="report-print-head"
              sx={{ display: 'none' }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="overline">Partner-Report</Typography>
                  <Typography variant="h5" component="p">
                    {partner.name}
                  </Typography>
                  {addressLines.map((line) => (
                    <Typography key={line} variant="body2">
                      {line}
                    </Typography>
                  ))}
                  {partner.contactName && (
                    <Typography variant="body2">
                      Ansprechpartner: {partner.contactName}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2">
                    <strong>Zeitraum:</strong> {periodText}
                  </Typography>
                  <Typography variant="body2">{settlementText}</Typography>
                  {/* Im Druck fehlt die Zeitraumwahl - die Eckdaten stehen
                      deshalb hier, als Liste statt als Fließtext. */}
                  <Typography variant="body2">
                    Geschäftstage: {stats.totals.dayCount} · Besuche:{' '}
                    {stats.totals.visitCount} (davon Nachlieferungen:{' '}
                    {stats.totals.refillCount})
                  </Typography>
                  {createdAt && (
                    <Typography variant="body2">
                      Erstellt am {createdAt}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {provisional && (
              <Alert severity="warning">
                <AlertTitle>Vorläufige Zahlen</AlertTitle>
                {stats.openDates.length > 0 && (
                  <Box component="span" sx={{ display: 'block' }}>
                    {stats.openDates.length === 1
                      ? 'Ein Geschäftstag in diesem Zeitraum ist noch offen'
                      : `${stats.openDates.length} Geschäftstage in diesem Zeitraum sind noch offen`}{' '}
                    (keine Abholung erfasst):{' '}
                    <strong>
                      {stats.openDates.map(formatDate).join(', ')}
                    </strong>
                    . Die Abverkaufsquote rechnet nur Tage mit Abholung
                    {openQty > 0 &&
                      `; ${formatQty(
                        openQty
                      )} Stück aus diesen Tagen liegen noch im Schrank`}
                    .
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
                    {stats.totals.uncountedQty ?? 0} Stück sind weder als
                    verkauft noch als Retoure erfasst:{' '}
                    <strong>
                      {(stats.incompleteDates ?? []).map(formatDate).join(', ')}
                    </strong>
                  </Box>
                )}
              </Alert>
            )}

            {(stats.totals.discrepancyQty ?? 0) > 0 && (
              <Alert severity="warning" data-testid="report-discrepancy">
                <AlertTitle>
                  Abweichung: {stats.totals.discrepancyQty} Stück mehr gezählt,
                  als im Schrank sein konnten
                </AlertTitle>
                Weder verkauft noch Retoure - meist fehlt eine Lieferung, oder
                es wurde verzählt. Bitte die Besuche dieser Tage prüfen:{' '}
                <strong>
                  {stats.byDay
                    .filter((d) => d.discrepancyQty > 0)
                    .map((d) => formatDate(d.businessDate))
                    .join(', ')}
                </strong>
              </Alert>
            )}

            {isEmpty ? (
              <EmptyState
                title="Keine Daten im gewählten Zeitraum"
                description="Für diesen Zeitraum wurden noch keine Besuche erfasst."
              />
            ) : (
              <>
                {/* Kennzahlen - höchstens vier; Geliefert = Verkauft +
                    Retoure + Offen (W4-verify r5) steht in den Hinweisen. */}
                <KeyFigures
                  aria-label="Kennzahlen des Zeitraums"
                  items={[
                    {
                      label: 'Geliefert',
                      value: `${formatQty(stats.totals.deliveredQty)} Stück`,
                      hint:
                        openQty > 0
                          ? `davon ${formatQty(
                              openQty
                            )} Stück offen (ohne Abholung)`
                          : undefined,
                      'data-testid': 'report-kpi-geliefert',
                    },
                    {
                      label: 'Verkauft',
                      value: `${formatQty(stats.totals.soldQty)} Stück`,
                      hint: `Retoure ${formatQty(
                        stats.totals.returnedQty
                      )} Stück · ${formatCurrency(stats.totals.returnValue)}`,
                      badge: provisional ? <ProvisionalBadge /> : undefined,
                      'data-testid': 'report-kpi-verkauft',
                    },
                    {
                      // Kurze Bezeichnung, Einschränkung als Hinweis: die
                      // umbrochene Bezeichnung schob den Wert aus der Reihe.
                      label: 'Abverkaufsquote',
                      value: formatPercent(stats.totals.sellThroughRate),
                      hint:
                        stats.openDates.length > 0
                          ? 'nur Tage mit Abholung'
                          : undefined,
                      'data-testid': 'report-kpi-quote',
                    },
                    {
                      label: 'Umsatz (Abrechnung)',
                      value: formatCurrency(stats.totals.revenue),
                      badge: provisional ? <ProvisionalBadge /> : undefined,
                      'data-testid': 'report-kpi-umsatz',
                    },
                  ]}
                />

                {/* Je Produkt */}
                <PageSection
                  title="Abrechnung je Produkt"
                  description={`Umsatz = verkaufte Menge × Einzelpreis zum Zeitpunkt der Lieferung${
                    stats.byProduct.some(
                      (p) =>
                        p.unitPriceMin != null &&
                        p.unitPriceMax != null &&
                        p.unitPriceMin !== p.unitPriceMax
                    )
                      ? '. Eine Preisspanne (von–bis) heißt: der Preis hat sich im Zeitraum geändert, jedes Stück zählt zu seinem Preis.'
                      : ''
                  }`}
                  disablePadding
                >
                  <TableContainer>
                    <Table
                      size="small"
                      className="report-table"
                      sx={COMPACT_TABLE}
                    >
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
                              <Box component="span" sx={{ fontWeight: 600 }}>
                                {product.productName}
                              </Box>
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
                              {(product.openQty ?? 0) > 0 && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block' }}
                                >
                                  {product.openQty} Stück noch offen (Tag ohne
                                  Abholung)
                                </Typography>
                              )}
                              {(product.discrepancyQty ?? 0) > 0 && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block' }}
                                >
                                  {product.discrepancyQty} Stück Abweichung
                                  (mehr gezählt als möglich)
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell
                              align="right"
                              className="report-col-md"
                              sx={mdOnlyCell}
                            >
                              {formatUnitPrice(product)}
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
                </PageSection>

                {/* Tagesverlauf */}
                <PageSection
                  title="Tagesverlauf"
                  description="Gelieferte und verkaufte Stückzahl je Geschäftstag"
                >
                  <Box sx={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        // Bei ein, zwei Tagen sonst handbreite Balken. Feste
                        // Breite statt `maxBarSize`: die setzt jeden Balken
                        // einzeln in die Mitte seines Platzes, das Paar fällt
                        // auseinander. Ab drei Tagen reicht der Platz am Handy
                        // dafür nicht mehr.
                        barSize={chartData.length <= 2 ? 40 : undefined}
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
                </PageSection>

                {/* Wochentags-Mittel */}
                <PageSection
                  title="Durchschnitt je Wochentag"
                  description="Mittelwerte über die Geschäftstage mit Abholung. Offene Tage zählen erst nach der Abholung mit."
                  disablePadding
                >
                  <TableContainer>
                    <Table
                      size="small"
                      className="report-table"
                      sx={COMPACT_TABLE}
                    >
                      <TableHead>
                        <TableRow>
                          <TableCell>Wochentag</TableCell>
                          <TableCell
                            align="right"
                            className="report-col-md"
                            sx={mdOnlyCell}
                          >
                            Tage
                          </TableCell>
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
                            <TableCell
                              align="right"
                              className="report-col-md"
                              sx={mdOnlyCell}
                            >
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
                              {day.avgRevenue == null
                                ? '–'
                                : formatCurrency(day.avgRevenue)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </PageSection>
              </>
            )}
          </>
        )}
      </PageLayout>
    </Box>
  )
}
