'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  Download as DownloadIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import {
  ABGLEICH_MAX_RANGE_DAYS,
  AMPEL_LABELS,
  BASIS_LABELS,
  REST_STATUS_LABELS,
  ROW_STATUS_LABELS,
  downloadAbgleichCsv,
  fetchAbgleich,
  postenLabel,
  type Abgleich,
  type AbgleichAmpel,
  type AbgleichAmpelBasis,
  type AbgleichDay,
  type AbgleichDayRow,
  type AbgleichItem,
} from '../../../lib/abgleichApi'
import {
  addDaysIso,
  formatDayShort,
  formatNumber,
  formatQtyUnit,
  formatRate,
  UNIT_SHORT,
} from '../../../lib/restApi'
import {
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
  type KeyFigure,
} from '../../../components/layout'
import { backzettelErrorText } from '../../../lib/backstubeErrors'
import DateRangeFilter from '../../../components/analytics/DateRangeFilter'
import type { RangePreset } from '../../../components/analytics/dateRange'

const ALERT_TOUCH = {
  '& .MuiAlert-action .MuiButtonBase-root': { minHeight: 44, minWidth: 44 },
} as const

const HIDE_ON_PHONE = { display: { xs: 'none', sm: 'table-cell' } } as const

const AMPEL_COLOR: Record<AbgleichAmpel, 'success' | 'warning' | 'error'> = {
  ok: 'success',
  auffaellig: 'warning',
  pruefen: 'error',
}

/** Zeiträume bis gestern - heute ist noch nicht abgeschlossen. */
function presetsFor(today: string): RangePreset[] {
  const to = addDaysIso(today, -1)
  return [
    { label: '7 Tage', from: addDaysIso(to, -6), to },
    { label: '4 Wochen', from: addDaysIso(to, -27), to },
    { label: '8 Wochen', from: addDaysIso(to, -55), to },
  ]
}

/** Menge mit Vorzeichen: „+3 St.“, „−2 St.“, „0 St.“ */
export function formatSigned(value: number | null, unit: string): string {
  if (value === null || value === undefined) return '–'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${formatNumber(Math.abs(value))} ${UNIT_SHORT[unit] ?? unit}`
}

export function AmpelChip({
  ampel,
  basis,
}: {
  ampel: AbgleichAmpel | null
  basis: AbgleichAmpelBasis | null
}) {
  if (!ampel) {
    return (
      <Typography variant="caption" color="text.secondary">
        –
      </Typography>
    )
  }
  const label =
    basis === 'ohne_rest'
      ? `${AMPEL_LABELS[ampel]} (ohne Rest)`
      : AMPEL_LABELS[ampel]
  return (
    <Chip
      size="small"
      label={label}
      color={AMPEL_COLOR[ampel]}
      data-ampel={ampel}
      sx={{ fontWeight: 600 }}
    />
  )
}

function dateList(dates: string[]): string {
  return dates.map((d) => formatDayShort(d)).join(', ')
}

/** Was die Zeile zum Posten sagt: Richtung, Lücken, Restquote. */
function ItemNotes({ item }: { item: AbgleichItem }) {
  const notes: React.ReactNode[] = []
  if (item.direction === 'fehlt') {
    notes.push(
      'Ware fehlt: weder an der Kasse noch im Rest (ohne Bon verkauft, Bruch, Personalverzehr oder verzählt?)'
    )
  } else if (item.direction === 'mehr_verkauft') {
    notes.push(
      'Mehr verkauft als gebacken (Kassennummer falsch zugeordnet, nachgebacken ohne Nachtrag oder Ware vom Vortag?)'
    )
  }
  if (item.basis && item.basis !== 'freigegeben') {
    notes.push(
      `Grundlage ${BASIS_LABELS[item.basis]}${
        item.plannedDays > 0 && item.basis === 'gemischt'
          ? ` (${item.plannedDays} ${item.plannedDays === 1 ? 'Tag' : 'Tage'})`
          : ''
      }`
    )
  }
  if (item.gaps.noReport.length > 0) {
    notes.push(`kein Kassenbericht: ${dateList(item.gaps.noReport)}`)
  }
  const restGaps = [...item.gaps.restMissing, ...item.gaps.restPartial].sort()
  if (restGaps.length > 0) {
    notes.push(`Rest nicht (ganz) gezählt: ${dateList(restGaps)}`)
  }
  if (item.overproduction) {
    notes.push(`Restquote ${formatRate(item.rate)} - zu viel produziert?`)
  }
  if (item.restExceedsDates.length > 0) {
    notes.push(
      `Mehr Rest als für den Laden gebacken am ${dateList(
        item.restExceedsDates
      )} - Zählung prüfen`
    )
  }
  if (notes.length === 0) return null
  return (
    <>
      {notes.map((n, i) => (
        <Typography
          key={i}
          variant="caption"
          color="text.secondary"
          component="div"
        >
          {n}
        </Typography>
      ))}
    </>
  )
}

function DayRowsTable({ item }: { item: AbgleichItem }) {
  const u = item.unit
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label={`${postenLabel(item)} je Tag`}>
        <TableHead>
          <TableRow>
            <TableCell>Tag</TableCell>
            <TableCell align="right">Gebacken</TableCell>
            <TableCell align="right">CAP</TableCell>
            <TableCell align="right">Verkauft</TableCell>
            <TableCell align="right">Nicht verk./kass.</TableCell>
            <TableCell align="right">Rest</TableCell>
            <TableCell align="right">Ungeklärt</TableCell>
            <TableCell>Ampel</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {item.dayRows.map((r: AbgleichDayRow) => (
            <TableRow key={r.date} data-testid={`day-${item.key}-${r.date}`}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {formatDayShort(r.date, r.weekdayName)}
                {r.basis === 'geplant' && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="div"
                  >
                    geplant
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">{formatQtyUnit(r.baked, u)}</TableCell>
              <TableCell align="right">{formatQtyUnit(r.cap, u)}</TableCell>
              <TableCell align="right">
                {r.status === 'kein_bericht'
                  ? 'kein Bericht'
                  : r.status === 'einheit'
                  ? `${formatNumber(r.soldPieces)} St. (Kasse)`
                  : formatQtyUnit(r.sold, u)}
              </TableCell>
              <TableCell align="right">{formatSigned(r.open, u)}</TableCell>
              <TableCell align="right">
                {r.rest === null
                  ? REST_STATUS_LABELS[r.restStatus]
                  : formatQtyUnit(r.rest, u)}
              </TableCell>
              <TableCell align="right">
                <strong>{formatSigned(r.unexplained, u)}</strong>
              </TableCell>
              <TableCell>
                {r.ampel ? (
                  <AmpelChip ampel={r.ampel} basis={r.ampelBasis} />
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {ROW_STATUS_LABELS[r.status]}
                  </Typography>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {item.variants.length > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          component="div"
          sx={{ px: 2, py: 1 }}
        >
          Sorten (die Kasse unterscheidet sie nicht, verglichen wird der
          Posten):{' '}
          {item.variants
            .map((v) => `${v.label ?? v.variant}: ${formatQtyUnit(v.baked, u)}`)
            .join(' · ')}
        </Typography>
      )}
    </TableContainer>
  )
}

function ItemRow({ item }: { item: AbgleichItem }) {
  const [open, setOpen] = useState(false)
  const u = item.unit
  return (
    <>
      <TableRow
        data-testid={`item-${item.key}`}
        sx={{ '& > td': { borderBottom: open ? 0 : undefined } }}
      >
        <TableCell padding="checkbox">
          <IconButton
            size="small"
            aria-label={`${postenLabel(item)}: Tage ${
              open ? 'zuklappen' : 'zeigen'
            }`}
            aria-expanded={open}
            onClick={() => setOpen((x) => !x)}
            sx={{ width: 44, height: 44 }}
          >
            {open ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ minWidth: { xs: 130, sm: 180 } }}>
          <Typography variant="body2" fontWeight={600}>
            {postenLabel(item)}
          </Typography>
          <ItemNotes item={item} />
        </TableCell>
        <TableCell align="right" sx={HIDE_ON_PHONE}>
          {formatQtyUnit(item.baked, u)}
        </TableCell>
        <TableCell align="right" sx={HIDE_ON_PHONE}>
          {formatQtyUnit(item.cap, u)}
        </TableCell>
        <TableCell align="right" sx={HIDE_ON_PHONE}>
          {formatQtyUnit(item.sold, u)}
        </TableCell>
        <TableCell align="right" sx={HIDE_ON_PHONE}>
          {formatSigned(item.open, u)}
        </TableCell>
        <TableCell align="right" sx={HIDE_ON_PHONE}>
          {item.rest === null ? '–' : formatQtyUnit(item.rest, u)}
          {item.restDays > 0 && item.restDays < item.comparableDays && (
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
            >
              {item.restDays} von {item.comparableDays} Tagen
            </Typography>
          )}
        </TableCell>
        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
          {item.unexplained !== null ? (
            <strong>{formatSigned(item.unexplained, u)}</strong>
          ) : (
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {/* Ohne Rest nur „nicht verkauft oder nicht kassiert“. */}
              <Box
                component="span"
                sx={{ display: { xs: 'inline', sm: 'none' } }}
              >
                {formatSigned(item.open, u)}*
              </Box>
              <Box
                component="span"
                sx={{ display: { xs: 'none', sm: 'inline' } }}
              >
                –
              </Box>
            </Box>
          )}
        </TableCell>
        <TableCell>
          <AmpelChip ampel={item.ampel} basis={item.ampelBasis} />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={9} sx={{ p: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 1, bgcolor: 'action.hover' }}>
              <DayRowsTable item={item} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

function dayText(d: AbgleichDay): string {
  switch (d.status) {
    case 'ruhetag':
      return 'Ruhetag'
    case 'geschlossen':
      return `geschlossen${d.dayKind?.note ? ` (${d.dayKind.note})` : ''}`
    case 'future':
      return 'noch nicht'
    case 'no_backzettel':
      return 'kein Backzettel'
    default: {
      const parts = [
        d.basis === 'geplant' ? 'geplant – nicht freigegeben' : 'freigegeben',
        d.report ? 'Kassenbericht da' : 'kein Kassenbericht',
        d.restStatus ? `Rest ${REST_STATUS_LABELS[d.restStatus]}` : null,
      ].filter(Boolean)
      return parts.join(' · ')
    }
  }
}

export default function AbgleichClient() {
  const [data, setData] = useState<Abgleich | null>(null)
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
      const result = await fetchAbgleich(range)
      if (id !== requestId.current) return
      setData(result)
    } catch (e) {
      if (id !== requestId.current) return
      setError(
        backzettelErrorText(e, 'Der Abgleich konnte nicht geladen werden.')
      )
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
      await downloadAbgleichCsv({ from: data.from, to: data.to })
    } catch (e) {
      setCsvError(
        backzettelErrorText(e, 'Die CSV-Datei konnte nicht geladen werden.')
      )
    } finally {
      setCsvBusy(false)
    }
  }

  const figures: KeyFigure[] = data
    ? [
        {
          label: 'Prüfen',
          value: String(data.signals.pruefen),
          tone: data.signals.pruefen > 0 ? 'error' : 'default',
          hint: `${data.signals.auffaellig} auffällig · ${data.signals.ok} ok`,
        },
        {
          label: 'Backtage',
          value: String(data.counts.bakeDays),
          tone: data.counts.planned > 0 ? 'warning' : 'default',
          hint:
            data.counts.planned > 0
              ? `${data.counts.planned} davon nur geplant (nicht freigegeben)`
              : 'alle freigegeben',
        },
        {
          label: 'Rest gezählt',
          value: `${data.counts.restCounted} von ${data.counts.bakeDays}`,
          tone:
            data.counts.restCounted < data.counts.bakeDays
              ? 'warning'
              : 'default',
          hint:
            data.counts.restPartial > 0
              ? `${data.counts.restPartial} teilweise gezählt`
              : 'Tage mit vollständiger Zählung',
        },
        {
          label: 'Kassenberichte',
          value: `${data.counts.bakeDays - data.counts.noReport} von ${
            data.counts.bakeDays
          }`,
          tone: data.counts.noReport > 0 ? 'warning' : 'default',
          hint:
            data.counts.noReport > 0
              ? `${data.counts.noReport} ohne Bericht - Lücke, keine 0`
              : 'an jedem Backtag da',
        },
      ]
    : []

  const shownDays = data
    ? data.days.filter((d) => d.status !== 'ruhetag' && d.status !== 'future')
    : []

  return (
    <PageLayout
      title="Abgleich Produktion ↔ Kasse"
      subtitle="Gebacken, verkauft, übrig - was bleibt ungeklärt?"
      back={{ href: '/admin/rest/auswertung', label: 'Rest-Auswertung' }}
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
      {data && (
        <DateRangeFilter
          from={data.from}
          to={data.to}
          onApply={(from, to) => void load({ from, to })}
          presets={presetsFor(data.today)}
          busy={loading}
          max={data.today}
          maxDays={ABGLEICH_MAX_RANGE_DAYS}
        />
      )}

      {loading && !data && !error && (
        <LoadingState label="Abgleich wird geladen …" />
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
          <Alert severity="info" data-testid="abgleich-hinweis">
            <strong>Hinweise, keine Beweise.</strong> Ein Unterschied kann viele
            Gründe haben - ohne Bon verkauft, Bruch, Personalverzehr, verzählt,
            falsche Kassennummer oder Ware vom Vortag. Er sagt nichts über
            einzelne Personen.
          </Alert>
          {data.configStatus !== 'ok' && (
            <Alert severity="warning">
              Die Backzettel-Stammdaten fehlen oder sind ungültig - ohne sie
              lässt sich nichts abgleichen.
            </Alert>
          )}
          {!data.reportsAvailable && (
            <Alert severity="warning">
              Keine Kassenberichte gefunden - „verkauft“ bleibt leer.
            </Alert>
          )}
          {data.basis && data.basis !== 'freigegeben' && (
            <Alert severity="warning" data-testid="abgleich-geplant">
              <strong>Grundlage: {BASIS_LABELS[data.basis]}.</strong>{' '}
              {data.counts.planned} von {data.counts.bakeDays} Backtagen sind
              nicht freigegeben - dort steht der geplante Wert statt „gebacken“.
              Für die volle Rechnung den Backzettel freigeben.
            </Alert>
          )}
          {data.counts.bakeDays > 0 && data.counts.restCounted === 0 && (
            <Alert severity="info" data-testid="abgleich-ohne-rest">
              Im Zeitraum wurde der Rest am Abend an keinem Tag vollständig
              gezählt. Ohne Rest steht nur „nicht verkauft oder nicht kassiert“,
              noch kein „Ungeklärt“ -{' '}
              <Link href="/admin/rest">Rest am Abend zählen</Link>.
            </Alert>
          )}

          <KeyFigures aria-label="Abgleich in Zahlen" items={figures} />

          <PageSection
            title={`Je Posten (${data.items.length})`}
            description="Größter Unterschied zuerst. Zeile aufklappen für die einzelnen Tage."
            disablePadding
            detailsLabel="So wird gerechnet"
            details={
              <Box
                component="ul"
                sx={{ m: 0, pl: 2.5, color: 'text.secondary' }}
              >
                <li>
                  <Typography variant="body2">
                    <strong>Gebacken</strong>: freigegebener Backzettel plus
                    quittierte Nachträge. Nicht freigegeben: der geplante Wert
                    („geplant“).
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>CAP</strong>: geht an den Verkaufspartner, wird
                    abgezogen. Vorbestellungen werden an der Kasse bezahlt und
                    nicht abgezogen (vorläufig).
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Verkauft</strong>: Kassenbons über die Kassennummern
                    (PLU) des Postens, Stornos abgezogen, in die Einheit des
                    Postens umgerechnet.
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Nicht verkauft oder nicht kassiert</strong> =
                    gebacken − CAP − verkauft. Das ist Rest plus alles, was ohne
                    Kasse den Laden verlassen hat.
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Rest</strong>: Zählung „Rest am Abend“. Fehlt sie,
                    ist das eine Lücke, keine 0.
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Ungeklärt</strong> = gebacken − CAP − verkauft −
                    Rest. Plus: Ware fehlt; minus: mehr verkauft als gebacken.
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Ampel</strong> (vorläufig): ok bis 1 Stück oder{' '}
                    {Math.round(data.thresholds.okShare * 100)} % von gebacken −
                    CAP, auffällig bis{' '}
                    {Math.round(data.thresholds.noticeShare * 100)} %, sonst
                    prüfen. „ohne Rest“: schon ohne Zählung mehr verkauft als
                    gebacken. Restquote über{' '}
                    {Math.round(data.thresholds.overproductionRate * 100)} %: zu
                    viel produziert?
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Für die volle Rechnung: Backzettel freigeben und den Rest
                    abends zählen. Ohne Kassenbericht bleibt der Tag eine Lücke.
                  </Typography>
                </li>
              </Box>
            }
          >
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Abgleich je Posten">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Posten</TableCell>
                    <TableCell align="right" sx={HIDE_ON_PHONE}>
                      Gebacken
                    </TableCell>
                    <TableCell align="right" sx={HIDE_ON_PHONE}>
                      CAP
                    </TableCell>
                    <TableCell align="right" sx={HIDE_ON_PHONE}>
                      Verkauft (Kasse)
                    </TableCell>
                    <TableCell align="right" sx={HIDE_ON_PHONE}>
                      Nicht verkauft oder nicht kassiert
                    </TableCell>
                    <TableCell align="right" sx={HIDE_ON_PHONE}>
                      Rest
                    </TableCell>
                    <TableCell align="right">Ungeklärt</TableCell>
                    <TableCell>Ampel</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((item) => (
                    <ItemRow key={item.key} item={item} />
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9}>
                        Im Zeitraum gibt es nichts abzugleichen.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
              sx={{ px: 2, py: 1, display: { xs: 'block', sm: 'none' } }}
            >
              * ohne gezählten Rest: nicht verkauft oder nicht kassiert
            </Typography>
          </PageSection>

          {data.unmatched.length > 0 && (
            <PageSection
              title={`Ohne Kassennummer / nicht vergleichbar (${data.unmatched.length})`}
              description="Diese Posten lassen sich nicht mit der Kasse abgleichen."
              disablePadding
            >
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table
                  size="small"
                  aria-label="Ohne Kassennummer oder nicht vergleichbar"
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>Posten</TableCell>
                      <TableCell align="right">Gebacken</TableCell>
                      <TableCell>Was fehlt</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.unmatched.map((item) => (
                      <TableRow
                        key={item.key}
                        data-testid={`unmatched-${item.key}`}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {postenLabel(item)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.status === 'keine_plu'
                              ? 'keine Kassennummer'
                              : 'nicht vergleichbar (Einheit)'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {formatQtyUnit(item.allBaked, item.unit)}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {item.status === 'keine_plu'
                              ? 'Kassennummer (plu) in hq config/backzettel.yaml eintragen.'
                              : `Die Kasse zählt Stück (${formatNumber(
                                  item.soldPieces
                                )} St. verkauft), der Posten rechnet in ${
                                  item.unit
                                } - jede Kassennummer einem Produkt des Postens mit Faktor zuordnen.`}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </PageSection>
          )}

          {shownDays.length > 0 && (
            <PageSection title="Tage" disablePadding>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" aria-label="Tage im Zeitraum">
                  <TableBody>
                    {shownDays.map((d) => (
                      <TableRow key={d.date} data-testid={`tag-${d.date}`}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {formatDayShort(d.date, d.weekdayName)}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{dayText(d)}</Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {d.signals.pruefen > 0 && (
                            <Chip
                              size="small"
                              color="error"
                              label={`${d.signals.pruefen} prüfen`}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </PageSection>
          )}
        </>
      )}
    </PageLayout>
  )
}
