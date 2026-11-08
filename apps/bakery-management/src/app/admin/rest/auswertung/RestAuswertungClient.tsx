'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
  useTheme,
} from '@mui/material'
import { Download as DownloadIcon } from '@mui/icons-material'
import {
  addDaysIso,
  DAY_STATUS_LABELS,
  downloadRestCsv,
  fetchRestSummary,
  formatDayShort,
  formatNumber,
  formatQtyUnit,
  formatRate,
  isIsoDate,
  type RestSummary,
  type RestSummaryDay,
  type RestSummaryItem,
} from '../../../../lib/restApi'

const ALERT_TOUCH = {
  '& .MuiAlert-action .MuiButtonBase-root': { minHeight: 44, minWidth: 44 },
} as const

const PRESETS: { label: string; days: number }[] = [
  { label: '7 Tage', days: 7 },
  { label: '4 Wochen', days: 28 },
  { label: '12 Wochen', days: 84 },
]

/** Tage, die als Lücke markiert werden (nicht 0). */
const GAP_STATUSES = new Set([
  'not_counted',
  'partial',
  'no_backzettel',
  'counted_without_backzettel',
])

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Unbekannter Fehler.'
}

// --------------------------------------------------------- Tagesverlauf

/**
 * Restquote je Tag einer Einheit (eine Reihe, daher ohne Legende - der Titel
 * nennt sie). Tage ohne vollständige Zählung stehen als Lücke da, nie als 0.
 */
export function DailyRateChart({
  days,
  unit,
}: {
  days: RestSummaryDay[]
  unit: string
}) {
  const theme = useTheme()
  const scroller = useRef<HTMLDivElement | null>(null)
  const shown = days.filter((d) => d.status !== 'future')
  // Auf dem Handy passt der Zeitraum nicht ganz: die jüngsten Tage zeigen.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [days])
  if (shown.length === 0) return null
  const rates = shown.map((d) => d.byUnit[unit]?.rate ?? null)
  const max = Math.max(0.1, ...rates.map((r) => r ?? 0))
  const top = Math.ceil(max * 10) / 10
  const width = Math.max(320, shown.length * 22)
  const height = 160
  const left = 36
  const bottom = 22
  const plotH = height - bottom - 8
  const slot = (width - left) / shown.length
  const barW = Math.max(4, Math.min(16, slot - 4))
  const y = (r: number) => 8 + plotH - (r / top) * plotH
  const ticks = [0, top / 2, top]
  const ink = theme.palette.text.secondary
  return (
    <Box ref={scroller} sx={{ overflowX: 'auto' }} data-testid="daily-chart">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Restquote je Tag (${unit}). Lücken: Tage ohne vollständige Zählung.`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={left}
              x2={width}
              y1={y(t)}
              y2={y(t)}
              stroke={theme.palette.divider}
              strokeWidth={1}
            />
            <text
              x={left - 6}
              y={y(t) + 4}
              textAnchor="end"
              fontSize={11}
              fill={ink}
            >
              {Math.round(t * 100)} %
            </text>
          </g>
        ))}
        {shown.map((d, i) => {
          const x = left + i * slot + (slot - barW) / 2
          const rate = rates[i]
          const gap = GAP_STATUSES.has(d.status)
          const label = `${formatDayShort(d.date, d.weekdayName)}: ${
            rate !== null && !gap
              ? `${formatRate(rate)} Rest`
              : DAY_STATUS_LABELS[d.status]
          }`
          const showDate =
            shown.length <= 14 || i % Math.ceil(shown.length / 14) === 0
          return (
            <Tooltip key={d.date} title={label} placement="top">
              <g aria-label={label} data-status={d.status}>
                {/* Trefferfläche größer als der Balken */}
                <rect
                  x={left + i * slot}
                  y={8}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                />
                {rate !== null && !gap ? (
                  <rect
                    x={x}
                    y={y(rate)}
                    width={barW}
                    height={Math.max(1, y(0) - y(rate))}
                    rx={Math.min(4, barW / 2)}
                    fill={theme.palette.primary.main}
                  />
                ) : gap ? (
                  <rect
                    x={x}
                    y={y(0) - 10}
                    width={barW}
                    height={10}
                    fill="none"
                    stroke={theme.palette.text.disabled}
                    strokeDasharray="2 2"
                  />
                ) : null}
                {showDate && (
                  <text
                    x={left + i * slot + slot / 2}
                    y={height - 6}
                    textAnchor="middle"
                    fontSize={10}
                    fill={ink}
                  >
                    {d.date.slice(8, 10)}.{d.date.slice(5, 7)}.
                  </text>
                )}
              </g>
            </Tooltip>
          )
        })}
      </svg>
    </Box>
  )
}

// ----------------------------------------------------------- Wochentrend

export function WeekSparkline({ item }: { item: RestSummaryItem }) {
  const theme = useTheme()
  const weeks = item.weeks
  // Ein Verlauf braucht mindestens zwei Wochen mit Wert.
  if (weeks.filter((wk) => wk.rate !== null).length < 2) {
    return (
      <Typography variant="caption" color="text.secondary">
        –
      </Typography>
    )
  }
  const w = 96
  const h = 28
  const max = Math.max(0.1, ...weeks.map((wk) => wk.rate ?? 0))
  const step = weeks.length > 1 ? (w - 8) / (weeks.length - 1) : 0
  const pts = weeks.map((wk, i) => ({
    x: 4 + i * step,
    y: wk.rate === null ? null : 4 + (h - 8) * (1 - wk.rate / max),
  }))
  const segments: string[] = []
  let current: string[] = []
  for (const p of pts) {
    if (p.y === null) {
      if (current.length) segments.push(current.join(' '))
      current = []
    } else current.push(`${p.x},${p.y}`)
  }
  if (current.length) segments.push(current.join(' '))
  const label = weeks
    .map((wk) => `KW ${wk.week.slice(-2)}: ${formatRate(wk.rate)}`)
    .join(' · ')
  return (
    <Tooltip title={label}>
      <svg
        width={w}
        height={h}
        role="img"
        aria-label={`Wochenverlauf: ${label}`}
      >
        {segments.map((s) => (
          <polyline
            key={s}
            points={s}
            fill="none"
            stroke={theme.palette.primary.main}
            strokeWidth={2}
          />
        ))}
        {pts.map((p, i) =>
          p.y === null ? null : (
            <circle
              key={weeks[i].week}
              cx={p.x}
              cy={p.y}
              r={2.5}
              fill={theme.palette.primary.main}
            />
          )
        )}
      </svg>
    </Tooltip>
  )
}

function soldText(item: RestSummaryItem): string {
  switch (item.soldStatus) {
    case 'no_plu':
      return 'keine PLU'
    case 'no_report':
      return 'kein Bericht'
    case 'no_config':
      return '–'
    default: {
      const value =
        item.sold === null
          ? '–'
          : item.soldConverted
          ? formatQtyUnit(item.sold, item.unit)
          : `${formatNumber(item.sold)} St.`
      return item.soldStatus === 'partial'
        ? `${value} (${item.soldDays} ${item.soldDays === 1 ? 'Tag' : 'Tage'})`
        : value
    }
  }
}

// ------------------------------------------------------------------ Seite

export default function RestAuswertungClient() {
  const theme = useTheme()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<RestSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvBusy, setCsvBusy] = useState(false)
  const requestId = useRef(0)

  const load = useCallback(async (range: { from?: string; to?: string }) => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const result = await fetchRestSummary(range)
      if (id !== requestId.current) return
      setData(result)
      setFrom(result.from)
      setTo(result.to)
    } catch (e) {
      if (id !== requestId.current) return
      setError(errorMessage(e))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load({})
  }, [load])

  // Das Kalender-Symbol der nativen Datumsfelder folgt sonst nicht dem Modus.
  const dateSx = {
    flex: 1,
    '& input': { minHeight: 28, colorScheme: theme.palette.mode },
  }
  const rangeValid = isIsoDate(from) && isIsoDate(to) && from <= to

  const csv = async () => {
    if (!data) return
    setCsvBusy(true)
    setCsvError(null)
    try {
      await downloadRestCsv({ from: data.from, to: data.to })
    } catch (e) {
      setCsvError(errorMessage(e))
    } finally {
      setCsvBusy(false)
    }
  }

  const chartUnit =
    data?.totals.find((t) => t.unit === 'Stück')?.unit ?? data?.totals[0]?.unit

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            Rest-Auswertung
          </Typography>
          <Typography color="text.secondary">
            Gebacken, verkauft und übrig - je Posten
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button component={Link} href="/admin/rest" sx={{ minHeight: 44 }}>
            Zur Zählung
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => void csv()}
            disabled={!data || csvBusy}
            sx={{ minHeight: 44 }}
          >
            CSV
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack
          component="form"
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          onSubmit={(e) => {
            e.preventDefault()
            if (rangeValid) void load({ from, to })
          }}
        >
          <Stack direction="row" spacing={1}>
            <TextField
              label="Von"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              sx={dateSx}
            />
            <TextField
              label="Bis"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              sx={dateSx}
            />
          </Stack>
          <Button
            type="submit"
            variant="contained"
            disabled={!rangeValid || loading}
            sx={{ minHeight: 44 }}
          >
            Anzeigen
          </Button>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {PRESETS.map((p) => (
              <Button
                key={p.days}
                size="small"
                variant="outlined"
                disabled={!data || loading}
                onClick={() => {
                  if (!data) return
                  void load({
                    from: addDaysIso(data.today, -(p.days - 1)),
                    to: data.today,
                  })
                }}
                sx={{ minHeight: 44 }}
              >
                {p.label}
              </Button>
            ))}
          </Stack>
        </Stack>
        {!rangeValid && from && to && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            Der Anfang muss vor dem Ende liegen.
          </Typography>
        )}
      </Paper>

      {loading && !data && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="Lädt" />
        </Box>
      )}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, ...ALERT_TOUCH }}
          action={
            <Button color="inherit" onClick={() => void load({ from, to })}>
              Erneut versuchen
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {csvError && (
        <Alert
          severity="error"
          sx={{ mb: 2, ...ALERT_TOUCH }}
          onClose={() => setCsvError(null)}
        >
          {csvError}
        </Alert>
      )}

      {data && (
        <>
          {data.configStatus !== 'ok' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Die Backzettel-Stammdaten fehlen oder sind ungültig - ohne sie
              lässt sich nichts zuordnen.
            </Alert>
          )}
          {!data.reportsAvailable && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Keine Kassenberichte gefunden - „verkauft“ bleibt leer.
            </Alert>
          )}

          <Typography variant="body2" sx={{ mb: 2 }} data-testid="day-counts">
            {data.counts.counted} Tage ausgewertet · {data.counts.partial}{' '}
            teilweise gezählt · {data.counts.notCounted} ohne Zählung ·{' '}
            {data.counts.noBackzettel} ohne freigegebenen Backzettel
            {data.counts.ruhetag > 0
              ? ` · ${data.counts.ruhetag} Ruhetage`
              : ''}
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                lg: 'repeat(4, 1fr)',
              },
              gap: 2,
              mb: 3,
            }}
          >
            {data.totals.map((t) => (
              <Paper key={t.unit} variant="outlined" sx={{ p: 2 }}>
                <Typography variant="overline" color="text.secondary">
                  {t.unit} · {t.items} Posten
                </Typography>
                <Typography variant="h4" component="p">
                  {formatRate(t.rate)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Rest {formatQtyUnit(t.rest, t.unit)} von{' '}
                  {formatQtyUnit(t.shopBaked, t.unit)} im Laden
                </Typography>
                {(t.restExceedsItems ?? 0) > 0 && (
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ mt: 0.5 }}
                    data-testid={`rest-total-exceeds-${t.unit}`}
                  >
                    {t.restExceedsItems === 1
                      ? '1 Posten'
                      : `${t.restExceedsItems} Posten`}{' '}
                    mit mehr Rest als gebacken - Quote enthält vermutlich
                    Zählfehler.
                  </Typography>
                )}
              </Paper>
            ))}
          </Box>

          {chartUnit && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle1" component="h2" gutterBottom>
                Restquote je Tag ({chartUnit})
              </Typography>
              <DailyRateChart days={data.days} unit={chartUnit} />
              <Typography variant="caption" color="text.secondary">
                Gestrichelt: Tag ohne vollständige Zählung oder ohne
                freigegebenen Backzettel - eine Lücke, keine 0.
              </Typography>
            </Paper>
          )}

          <Paper variant="outlined" sx={{ mb: 2 }}>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Rest je Posten">
                <TableHead>
                  <TableRow>
                    <TableCell>Posten</TableCell>
                    <TableCell align="right">Tage</TableCell>
                    <TableCell align="right">Gebacken</TableCell>
                    <TableCell align="right">davon CAP</TableCell>
                    <TableCell align="right">Verkauft (Kasse)</TableCell>
                    <TableCell align="right">Rest</TableCell>
                    <TableCell align="right">Quote</TableCell>
                    <TableCell>Wochen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow
                      key={item.itemId}
                      data-testid={`item-${item.itemId}`}
                    >
                      <TableCell sx={{ minWidth: 160 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {item.name}
                        </Typography>
                        {item.variants.length > 0 && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                          >
                            {item.variants
                              .map((v) => `${v.label}: ${formatRate(v.rate)}`)
                              .join(' · ')}
                          </Typography>
                        )}
                        {item.uncountedDays > 0 && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                          >
                            {item.uncountedDays}{' '}
                            {item.uncountedDays === 1 ? 'Tag' : 'Tage'} nicht
                            vollständig gezählt
                          </Typography>
                        )}
                        {(item.restExceedsDates?.length ?? 0) > 0 && (
                          <Typography
                            variant="caption"
                            color="text.primary"
                            fontWeight={600}
                            component="div"
                            data-testid={`rest-exceeds-${item.itemId}`}
                          >
                            Mehr Rest als für den Laden gebacken am{' '}
                            {(item.restExceedsDates ?? [])
                              .map((d) => formatDayShort(d))
                              .join(', ')}{' '}
                            - Zählung prüfen
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{item.days}</TableCell>
                      <TableCell align="right">
                        {item.days ? formatQtyUnit(item.baked, item.unit) : '–'}
                      </TableCell>
                      <TableCell align="right">
                        {item.days ? formatQtyUnit(item.cap, item.unit) : '–'}
                      </TableCell>
                      <TableCell align="right">{soldText(item)}</TableCell>
                      <TableCell align="right">
                        {item.days ? formatQtyUnit(item.rest, item.unit) : '–'}
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatRate(item.rate)}</strong>
                      </TableCell>
                      <TableCell>
                        <WeekSparkline item={item} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8}>
                        Im Zeitraum gibt es nichts auszuwerten.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
          <Typography variant="caption" color="text.secondary" component="p">
            {data.rateBasis} Verkauft = Kassenbons über die PLU des Postens
            (Stornos abgezogen), an denselben ausgewerteten Tagen, soweit ein
            Kassenbericht da ist.
          </Typography>
        </>
      )}
    </Box>
  )
}
