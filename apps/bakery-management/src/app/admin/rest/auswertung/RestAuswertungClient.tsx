'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import { Download as DownloadIcon } from '@mui/icons-material'
import {
  DAY_STATUS_LABELS,
  downloadRestCsv,
  fetchRestSummary,
  formatDayShort,
  formatNumber,
  formatQtyUnit,
  formatRate,
  type RestSummary,
  type RestSummaryDay,
  type RestSummaryItem,
} from '../../../../lib/restApi'
import {
  KeyFigures,
  LoadingState,
  MAX_KEY_FIGURES,
  PageLayout,
  PageSection,
  type KeyFigure,
} from '../../../../components/layout'
import { backzettelErrorText } from '../../../../lib/backstubeErrors'
import DateRangeFilter from '../../../../components/analytics/DateRangeFilter'
import { weekPresets } from '../../../../components/analytics/dateRange'

/** Längster Zeitraum - wie `MAX_RANGE_DAYS` in `rest-am-abend.core.js`. */
const MAX_RANGE_DAYS = 400

const ALERT_TOUCH = {
  '& .MuiAlert-action .MuiButtonBase-root': { minHeight: 44, minWidth: 44 },
} as const

/** Tage, die als Lücke markiert werden (nicht 0). */
const GAP_STATUSES = new Set([
  'not_counted',
  'partial',
  'no_backzettel',
  'counted_without_backzettel',
])

/**
 * Deutscher Fehlertext: ohne Antwort (WLAN, API gestoppt) oder mit 502-504
 * von Caddy der WLAN-Hinweis statt „Failed to fetch“ / „HTTP 502: Bad
 * Gateway“ (UI-Runde 2), sonst die `message` der API.
 */
function errorMessage(error: unknown, fallback: string): string {
  return backzettelErrorText(error, fallback)
}

// --------------------------------------------------------- Tagesverlauf

/**
 * Breite eines Elements, nachgeführt über `ResizeObserver` (0, solange
 * nicht gemessen - z. B. in jsdom).
 */
function useElementWidth(el: HTMLElement | null): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!el) return
    setWidth(Math.round(el.getBoundingClientRect().width))
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (typeof w === 'number' && w > 0) setWidth(Math.round(w))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [el])
  return width
}

/** Mindestbreite je Tag - darunter scrollt das Diagramm (Handy). */
export const DAY_SLOT_MIN = 22

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
  // Element als State, nicht als Ref: das Diagramm erscheint oft erst mit
  // den Daten, und erst dann darf gemessen werden.
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  const available = useElementWidth(scroller)
  const shown = days.filter((d) => d.status !== 'future')
  // Auf dem Handy passt der Zeitraum nicht ganz: die jüngsten Tage zeigen.
  useEffect(() => {
    if (scroller) scroller.scrollLeft = scroller.scrollWidth
  }, [days, scroller, available])
  if (shown.length === 0) return null
  const rates = shown.map((d) => d.byUnit[unit]?.rate ?? null)
  const max = Math.max(0.1, ...rates.map((r) => r ?? 0))
  const top = Math.ceil(max * 10) / 10
  // Die ganze Kartenbreite nutzen (früher feste Pixel: am PC endete das
  // Diagramm in der Mitte der Karte); nur wenn die Tage dort nicht passen,
  // wird es breiter und scrollt.
  const width = Math.max(320, shown.length * DAY_SLOT_MIN, available)
  const height = available >= 600 ? 200 : 160
  const left = 36
  const bottom = 22
  const plotH = height - bottom - 8
  const slot = (width - left) / shown.length
  const barW = Math.max(4, Math.min(28, slot - 6))
  const y = (r: number) => 8 + plotH - (r / top) * plotH
  const ticks = [0, top / 2, top]
  const ink = theme.palette.text.secondary
  return (
    <Box ref={setScroller} sx={{ overflowX: 'auto' }} data-testid="daily-chart">
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

const HIDE_ON_PHONE = { display: { xs: 'none', sm: 'table-cell' } } as const

/** Eine Einheit als Kennzahl: Restquote groß, darunter Rest von gebacken. */
function unitFigure(t: RestSummary['totals'][number]): KeyFigure {
  const exceeds = t.restExceedsItems ?? 0
  return {
    label: `Restquote ${t.unit}`,
    value: formatRate(t.rate),
    tone: exceeds > 0 ? 'warning' : 'default',
    hint: (
      <>
        <Box component="span" sx={{ display: 'block' }}>
          Rest {formatQtyUnit(t.rest, t.unit)} von{' '}
          {formatQtyUnit(t.shopBaked, t.unit)} im Laden · {t.items} Posten
        </Box>
        {exceeds > 0 && (
          <Box
            component="span"
            data-testid={`rest-total-exceeds-${t.unit}`}
            sx={{
              display: 'block',
              mt: 0.5,
              color: 'text.primary',
              fontWeight: 600,
            }}
          >
            {exceeds === 1 ? '1 Posten' : `${exceeds} Posten`} mit mehr Rest als
            gebacken - Quote enthält vermutlich Zählfehler.
          </Box>
        )}
      </>
    ),
  }
}

export default function RestAuswertungClient() {
  const [data, setData] = useState<RestSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvBusy, setCsvBusy] = useState(false)
  const lastRange = useRef<{ from?: string; to?: string }>({})
  const requestId = useRef(0)

  const load = useCallback(async (range: { from?: string; to?: string }) => {
    const id = ++requestId.current
    lastRange.current = range
    setLoading(true)
    setError(null)
    try {
      const result = await fetchRestSummary(range)
      if (id !== requestId.current) return
      setData(result)
    } catch (e) {
      if (id !== requestId.current) return
      setError(errorMessage(e, 'Die Auswertung konnte nicht geladen werden.'))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load({})
  }, [load])

  const csv = async () => {
    if (!data) return
    setCsvBusy(true)
    setCsvError(null)
    try {
      await downloadRestCsv({ from: data.from, to: data.to })
    } catch (e) {
      setCsvError(errorMessage(e, 'Die CSV-Datei konnte nicht geladen werden.'))
    } finally {
      setCsvBusy(false)
    }
  }

  const chartUnit =
    data?.totals.find((t) => t.unit === 'Stück')?.unit ?? data?.totals[0]?.unit
  // Dieselben Wochen-Zeiträume wie das Tagesziel (Wochentage vergleichen).
  const presets = data ? weekPresets(data.today) : []

  return (
    <PageLayout
      title="Rest-Auswertung"
      subtitle="Gebacken, verkauft und übrig - je Posten"
      back={{ href: '/admin/rest', label: 'Rest am Abend' }}
      actions={
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => void csv()}
          disabled={!data || csvBusy}
          sx={{ minHeight: 44 }}
        >
          CSV
        </Button>
      }
    >
      {/* Erst mit Daten: vorher stünden leere Von/Bis-Felder (tt.mm.jjjj)
          ohne Grenze über der Lade- bzw. Fehlermeldung (UI-Runde 2). */}
      {data && (
        <DateRangeFilter
          from={data.from}
          to={data.to}
          onApply={(from, to) => void load({ from, to })}
          presets={presets}
          busy={loading}
          max={data.today}
          maxDays={MAX_RANGE_DAYS}
        />
      )}

      {loading && !data && !error && (
        <LoadingState label="Auswertung wird geladen …" />
      )}
      {error && (
        <Alert
          severity="error"
          sx={ALERT_TOUCH}
          action={
            <Button
              color="inherit"
              onClick={() => void load(lastRange.current)}
            >
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
          sx={ALERT_TOUCH}
          onClose={() => setCsvError(null)}
        >
          {csvError}
        </Alert>
      )}

      {data && (
        <>
          {data.configStatus !== 'ok' && (
            <Alert severity="warning">
              Die Backzettel-Stammdaten fehlen oder sind ungültig - ohne sie
              lässt sich nichts zuordnen.
            </Alert>
          )}
          {!data.reportsAvailable && (
            <Alert severity="info">
              Keine Kassenberichte gefunden - „verkauft“ bleibt leer.
            </Alert>
          )}

          {data.totals.length > 0 && (
            <KeyFigures
              aria-label="Restquote je Einheit"
              items={data.totals.slice(0, MAX_KEY_FIGURES).map(unitFigure)}
            />
          )}

          {chartUnit && (
            <PageSection
              title={`Restquote je Tag (${chartUnit})`}
              description="Gestrichelt: Tag ohne vollständige Zählung oder ohne freigegebenen Backzettel - eine Lücke, keine 0."
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5 }}
                data-testid="day-counts"
              >
                {data.counts.counted} Tage ausgewertet · {data.counts.partial}{' '}
                teilweise gezählt · {data.counts.notCounted} ohne Zählung ·{' '}
                {data.counts.noBackzettel} ohne freigegebenen Backzettel
                {data.counts.ruhetag > 0
                  ? ` · ${data.counts.ruhetag} Ruhetage`
                  : ''}
              </Typography>
              <DailyRateChart days={data.days} unit={chartUnit} />
            </PageSection>
          )}

          <PageSection
            title={`Rest je Posten (${data.items.length})`}
            disablePadding
            detailsLabel="So wird gerechnet"
            details={
              <Typography variant="body2" color="text.secondary">
                {data.rateBasis} Verkauft = Kassenbons über die PLU des Postens
                (Stornos abgezogen), an denselben ausgewerteten Tagen, soweit
                ein Kassenbericht da ist.
              </Typography>
            }
          >
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Rest je Posten">
                <TableHead>
                  <TableRow>
                    <TableCell>Posten</TableCell>
                    <TableCell align="right" sx={HIDE_ON_PHONE}>
                      Tage
                    </TableCell>
                    <TableCell align="right" sx={HIDE_ON_PHONE}>
                      Gebacken
                    </TableCell>
                    <TableCell align="right" sx={HIDE_ON_PHONE}>
                      davon CAP
                    </TableCell>
                    <TableCell align="right" sx={HIDE_ON_PHONE}>
                      Verkauft (Kasse)
                    </TableCell>
                    <TableCell align="right">Rest</TableCell>
                    <TableCell align="right">Quote</TableCell>
                    <TableCell sx={HIDE_ON_PHONE}>Wochen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow
                      key={item.itemId}
                      data-testid={`item-${item.itemId}`}
                    >
                      <TableCell sx={{ minWidth: { xs: 120, sm: 160 } }}>
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
                      <TableCell align="right" sx={HIDE_ON_PHONE}>
                        {item.days}
                      </TableCell>
                      <TableCell align="right" sx={HIDE_ON_PHONE}>
                        {item.days ? formatQtyUnit(item.baked, item.unit) : '–'}
                      </TableCell>
                      <TableCell align="right" sx={HIDE_ON_PHONE}>
                        {item.days ? formatQtyUnit(item.cap, item.unit) : '–'}
                      </TableCell>
                      <TableCell align="right" sx={HIDE_ON_PHONE}>
                        {soldText(item)}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {item.days ? formatQtyUnit(item.rest, item.unit) : '–'}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <strong>{formatRate(item.rate)}</strong>
                      </TableCell>
                      <TableCell sx={HIDE_ON_PHONE}>
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
          </PageSection>
        </>
      )}
    </PageLayout>
  )
}
