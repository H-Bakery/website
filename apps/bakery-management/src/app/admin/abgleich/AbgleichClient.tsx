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
  ToggleButton,
  ToggleButtonGroup,
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
  type AbgleichRange,
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
import AbgleichEuroView from './AbgleichEuroView'

const ALERT_TOUCH = {
  '& .MuiAlert-action .MuiButtonBase-root': { minHeight: 44, minWidth: 44 },
} as const

const HIDE_ON_PHONE = { display: { xs: 'none', sm: 'table-cell' } } as const
/**
 * CAP und „Nicht verkauft oder nicht kassiert“ erst ab `xl` (1536 px): quer
 * am Tablet und bis 1440 px schoben sie Ungeklärt und Ampel aus dem Bild.
 * Aufgeklappt stehen beide je Tag weiter da.
 */
const HIDE_BELOW_XL = { display: { xs: 'none', xl: 'table-cell' } } as const

/** Spalten der Tabelle je Posten (Aufklappen, Posten, 7 Werte) - für `colSpan`. */
const ITEM_COLUMNS = 9

/**
 * Engere Zellen bis `lg`: am Handy (390 px) steht die Ampel so neben dem
 * Posten, am Tablet passen alle sichtbaren Spalten. Gilt auch für die
 * aufgeklappten Tage. Die Aufklapp-Spalte (44 px Knopf) bekäme von MUI
 * sonst noch 28 px Rand.
 */
const COMPACT_CELLS = {
  '& th:not(.MuiTableCell-paddingCheckbox), & td:not(.MuiTableCell-paddingCheckbox)':
    { px: { xs: 1, lg: 2 } },
  '& th.MuiTableCell-paddingCheckbox, & td.MuiTableCell-paddingCheckbox': {
    pl: { xs: 0.5, lg: 2 },
    pr: { xs: 0, lg: 1.5 },
  },
} as const

/**
 * Mengen in einer Zeile („18 St.“ brach sonst nach der Zahl um); die
 * Rechenwege darunter (`caption`) brechen weiter um.
 */
const AMOUNT = {
  whiteSpace: 'nowrap',
  '& .MuiTypography-caption': { whiteSpace: 'normal' },
} as const

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
      // „prüfen (ohne Rest)“ bricht am Handy um, statt die Ampel neben dem
      // Posten aus dem Bild zu schieben.
      sx={{
        fontWeight: 600,
        height: 'auto',
        minHeight: 24,
        '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 },
      }}
    />
  )
}

function dateList(dates: string[]): string {
  return dates.map((d) => formatDayShort(d)).join(', ')
}

/** Gebacken, bei offener Grundmenge nur als Mindestwert „≥ n“. */
function bakedText(value: number, isMinimum: boolean, unit: string): string {
  return isMinimum
    ? `≥ ${formatQtyUnit(value, unit)}`
    : formatQtyUnit(value, unit)
}

/** Was in der Liste „nicht vergleichbar“ fehlt - je nach Grund. */
export function unmatchedHint(item: AbgleichItem): string {
  if (item.status === 'keine_plu') {
    return 'Kassennummer (plu) in hq config/backzettel.yaml eintragen.'
  }
  const sold =
    item.soldPieces === null
      ? ''
      : `Die Kasse zählt Stück (${formatNumber(
          item.soldPieces
        )} St. verkauft). `
  if (item.foreignPlu.length > 0) {
    return `${sold}Kassennummer ${item.foreignPlu.join(
      ', '
    )} gehört zu einem Produkt eines anderen Postens - in hq config/backzettel.yaml prüfen.`
  }
  if (item.unit === 'Stück') {
    return `${sold}Einige Produkte des Postens sind Teile (Faktor ≠ 1, z. B. Viertel) - jede Kassennummer dem passenden Produkt mit seinem Faktor zuordnen.`
  }
  return `${sold}Der Posten rechnet in ${item.unit} - jede Kassennummer einem Produkt des Postens mit Faktor zuordnen.`
}

/** Was die Zeile zum Posten sagt: Richtung, Lücken, Restquote. */
function itemNotes(item: AbgleichItem): string[] {
  const notes: string[] = []
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
  if (item.ampel !== 'pruefen' && item.signalDays.pruefen > 0) {
    notes.push(
      `An ${item.signalDays.pruefen} ${
        item.signalDays.pruefen === 1 ? 'Tag' : 'Tagen'
      } „prüfen“ - Tage aufklappen`
    )
  }
  if (item.gaps.baseOpen.length > 0) {
    notes.push(
      `Grundmenge offen – kein Plan, kein Vergleich: ${dateList(
        item.gaps.baseOpen
      )}`
    )
  }
  if (item.gaps.noReport.length > 0) {
    notes.push(`kein Kassenbericht: ${dateList(item.gaps.noReport)}`)
  }
  const restGaps = [...item.gaps.restMissing, ...item.gaps.restPartial].sort()
  if (restGaps.length > 0) {
    notes.push(`Rest nicht (ganz) gezählt: ${dateList(restGaps)}`)
  }
  if (item.gaps.notOnBackzettel.length > 0) {
    notes.push(
      `verkauft, aber nicht auf dem Backzettel: ${dateList(
        item.gaps.notOnBackzettel
      )}`
    )
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
  return notes
}

function DayRowsTable({ item }: { item: AbgleichItem }) {
  const u = item.unit
  return (
    // `contain: inline-size`: die acht Spalten je Tag scrollen in ihrem eigenen
    // Container, statt die Tabelle je Posten breiter zu machen (390 px: die
    // Ampel lag sonst außer Sicht, sobald ein Posten aufgeklappt war).
    <TableContainer sx={{ overflowX: 'auto', contain: 'inline-size' }}>
      <Table size="small" aria-label={`${postenLabel(item)} je Tag`}>
        <TableHead>
          <TableRow>
            {/* Ergebnis vorn wie in der Zeile des Postens. */}
            <TableCell>Tag</TableCell>
            <TableCell align="right">Ungeklärt</TableCell>
            <TableCell>Ampel</TableCell>
            <TableCell align="right">Gebacken</TableCell>
            <TableCell align="right">CAP</TableCell>
            <TableCell align="right">Verkauft</TableCell>
            <TableCell align="right">Nicht verk./kass.</TableCell>
            <TableCell align="right">Rest</TableCell>
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
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
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
              <TableCell align="right" sx={AMOUNT}>
                {bakedText(r.baked, r.bakedIsMinimum, u)}
              </TableCell>
              <TableCell align="right" sx={AMOUNT}>
                {formatQtyUnit(r.cap, u)}
              </TableCell>
              <TableCell align="right" sx={r.report ? AMOUNT : undefined}>
                {!r.report
                  ? 'kein Bericht'
                  : r.status === 'einheit'
                  ? `${formatNumber(r.soldPieces)} St. (Kasse)`
                  : formatQtyUnit(r.sold, u)}
              </TableCell>
              <TableCell align="right" sx={AMOUNT}>
                {formatSigned(r.open, u)}
              </TableCell>
              <TableCell
                align="right"
                sx={r.rest === null ? undefined : AMOUNT}
              >
                {r.rest === null
                  ? REST_STATUS_LABELS[r.restStatus]
                  : formatQtyUnit(r.rest, u)}
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
  const notes = itemNotes(item)
  // Trennlinie nur unter dem letzten Teil des Postens (Aufklapp-Zeile).
  const noBorder = { '& > td': { borderBottom: 0 } }
  return (
    <>
      <TableRow data-testid={`item-${item.key}`} sx={noBorder}>
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
        <TableCell sx={{ minWidth: { xs: 128, sm: 140 } }}>
          {/* Übliche Namen bleiben am Handy ganz; nur sehr lange
              („Kürbiskernbrötchen“) werden getrennt, statt die Ampel aus dem
              Bild zu schieben. */}
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ hyphens: 'auto', overflowWrap: 'break-word' }}
          >
            {postenLabel(item)}
          </Typography>
        </TableCell>
        {/* Das Ergebnis gleich hinter dem Posten: quer am Tablet lagen
            Ungeklärt und Ampel sonst rechts außer Sicht. */}
        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
          {item.unexplained !== null ? (
            <>
              <strong>{formatSigned(item.unexplained, u)}</strong>
              {item.restDays < item.comparableDays && (
                // Ungeklärt gilt nur für die gezählten Tage - die Rechnung
                // dazu, damit die Spalten aufgehen.
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="div"
                  data-testid={`ungeklaert-basis-${item.key}`}
                  sx={{ whiteSpace: 'normal', minWidth: { sm: 96 } }}
                >
                  nur {item.restDays} von {item.comparableDays} Tagen:{' '}
                  {formatNumber(item.restShopBaked)} −{' '}
                  {formatNumber(item.restSold)} verkauft −{' '}
                  {formatNumber(item.rest)} Rest
                </Typography>
              )}
            </>
          ) : (
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {/* Ohne Rest nur „nicht verkauft oder nicht kassiert“ - mit
                  „*“, solange dessen Spalte ausgeblendet ist (unter xl). */}
              <Box
                component="span"
                sx={{ display: { xs: 'inline', xl: 'none' } }}
              >
                {formatSigned(item.open, u)}
                {item.open !== null && '*'}
              </Box>
              <Box
                component="span"
                sx={{ display: { xs: 'none', xl: 'inline' } }}
              >
                –
              </Box>
            </Box>
          )}
        </TableCell>
        <TableCell>
          <AmpelChip ampel={item.ampel} basis={item.ampelBasis} />
          {item.shortWithoutRest !== null && (
            // Die Zahl hinter „prüfen (ohne Rest)“: an Tagen ohne Rest mehr
            // verkauft als gebacken - übrige Ware anderer Tage gleicht das
            // nicht aus, deshalb steht sie nicht in den Spalten daneben.
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
              data-testid={`mehr-verkauft-${item.key}`}
              sx={{ minWidth: { sm: 96 } }}
            >
              {formatSigned(item.shortWithoutRest, u)} an{' '}
              {item.shortDays === 1 ? 'einem Tag' : `${item.shortDays} Tagen`}{' '}
              ohne Rest
            </Typography>
          )}
        </TableCell>
        <TableCell align="right" sx={{ ...HIDE_ON_PHONE, ...AMOUNT }}>
          {bakedText(item.baked, item.bakedIsMinimum, u)}
          {item.comparableDays > 0 && item.comparableDays < item.days && (
            // Gebacken zählt nur die vergleichbaren Tage, damit gebacken −
            // CAP − verkauft aufgeht - die Tage darunter summieren mehr.
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
              data-testid={`gebacken-basis-${item.key}`}
            >
              {item.comparableDays} von {item.days} Tagen (alle:{' '}
              {bakedText(item.allBaked, item.allBakedIsMinimum, u)})
            </Typography>
          )}
        </TableCell>
        <TableCell align="right" sx={{ ...HIDE_BELOW_XL, ...AMOUNT }}>
          {formatQtyUnit(item.cap, u)}
        </TableCell>
        <TableCell align="right" sx={{ ...HIDE_ON_PHONE, ...AMOUNT }}>
          {formatQtyUnit(item.sold, u)}
        </TableCell>
        <TableCell align="right" sx={{ ...HIDE_BELOW_XL, ...AMOUNT }}>
          {formatSigned(item.open, u)}
        </TableCell>
        <TableCell align="right" sx={{ ...HIDE_ON_PHONE, ...AMOUNT }}>
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
      </TableRow>
      {notes.length > 0 && (
        // Hinweise (Richtung, Lücken, Restquote) in einer zweiten Zeile über
        // die ganze Breite: in der Spalte „Posten“ machten sie diese breit und
        // schoben das Ergebnis aus dem Bild. Sie bleiben sichtbar (Lücken
        // sind keine Details).
        <TableRow data-testid={`notes-${item.key}`} sx={noBorder}>
          <TableCell padding="checkbox" />
          <TableCell colSpan={ITEM_COLUMNS - 1} sx={{ pt: 0 }}>
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
          </TableCell>
        </TableRow>
      )}
      <TableRow>
        <TableCell colSpan={ITEM_COLUMNS} sx={{ p: 0 }}>
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
        d.baseOpen > 0 ? `Grundmenge offen bei ${d.baseOpen} Posten` : null,
      ].filter(Boolean)
      return parts.join(' · ')
    }
  }
}

export default function AbgleichClient() {
  const [mode, setMode] = useState<'stueck' | 'euro'>('stueck')
  const [data, setData] = useState<Abgleich | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvBusy, setCsvBusy] = useState(false)
  const lastRange = useRef<AbgleichRange>({})
  const requestId = useRef(0)

  const load = useCallback(async (range: AbgleichRange) => {
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
        mode === 'stueck' && (
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => void csv()}
            disabled={!data || csvBusy}
            sx={{ minHeight: 44 }}
          >
            CSV
          </Button>
        )
      }
    >
      {data && (
        <DateRangeFilter
          from={data.from}
          to={data.to}
          onApply={(from, to) => void load({ ...lastRange.current, from, to })}
          presets={presetsFor(data.today)}
          busy={loading}
          max={data.today}
          maxDays={ABGLEICH_MAX_RANGE_DAYS}
        />
      )}

      <ToggleButtonGroup
        exclusive
        value={mode}
        onChange={(_, value: 'stueck' | 'euro' | null) => {
          if (value) setMode(value)
        }}
        aria-label="Ansicht"
        size="small"
        sx={{ alignSelf: 'flex-start' }}
      >
        <ToggleButton value="stueck" sx={{ minHeight: 44 }}>
          Stück
        </ToggleButton>
        <ToggleButton value="euro" sx={{ minHeight: 44 }}>
          Euro
        </ToggleButton>
      </ToggleButtonGroup>

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

      {data && mode === 'euro' && (
        <AbgleichEuroView
          euro={data.euro}
          configAvailable={data.configStatus === 'ok'}
          busy={loading}
          onChange={(folgetag) => void load({ ...lastRange.current, folgetag })}
        />
      )}
      {data && mode === 'stueck' && (
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
          {data.counts.baseOpen > 0 && (
            <Alert severity="warning" data-testid="abgleich-grundmenge-offen">
              An {data.counts.baseOpen} von {data.counts.bakeDays} Backtagen ist
              für einzelne Posten die Grundmenge offen. Dort gibt es keinen Plan
              - gebacken steht nur als Mindestwert („≥“), ohne Ungeklärt und
              ohne Ampel. Grundmenge im Backzettel festlegen.
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
                    („geplant“). Ist die Grundmenge offen, gibt es keinen Plan:
                    gebacken steht als „≥ n“, ohne Vergleich. In der Zeile je
                    Posten zählen gebacken und CAP nur die vergleichbaren Tage
                    (mit Kassenbericht und festgelegter Grundmenge), damit die
                    Rechnung aufgeht; „x von y Tagen“ nennt dann auch alle Tage.
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>CAP</strong>: geht an den Verkaufspartner, wird
                    abgezogen. Vorbestellungen zählen in der Stückansicht mit.
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Verkauft</strong>: Kassenbons über die Kassennummern
                    (PLU) des Postens, Stornos abgezogen, in die Einheit des
                    Postens umgerechnet. Ein Stück-Posten, dessen Produkte je
                    ein Stück sind, wird Stück gegen Stück verglichen
                    (vorläufig).
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
                    Ist nur an einem Teil der Tage gezählt, gilt Ungeklärt nur
                    für diese Tage - die Rechnung steht darunter.
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Ampel</strong> (vorläufig): ok bis 1 Stück oder{' '}
                    {Math.round(data.thresholds.okShare * 100)} % von gebacken −
                    CAP, auffällig bis{' '}
                    {Math.round(data.thresholds.noticeShare * 100)} %, sonst
                    prüfen. „ohne Rest“: schon ohne Zählung mehr verkauft als
                    gebacken - die Menge steht unter der Ampel („an Tagen ohne
                    Rest“). Über den Zeitraum gilt die schlechtere Ampel aus den
                    gezählten und den nicht gezählten Tagen; übrige Ware eines
                    Tages gleicht zu viel Verkauf an einem anderen nicht aus.
                    Restquote über{' '}
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
              <Table
                size="small"
                aria-label="Abgleich je Posten"
                sx={COMPACT_CELLS}
              >
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Posten</TableCell>
                    <TableCell align="right">Ungeklärt</TableCell>
                    <TableCell>Ampel</TableCell>
                    <TableCell align="right" sx={HIDE_ON_PHONE}>
                      Gebacken
                    </TableCell>
                    <TableCell align="right" sx={HIDE_BELOW_XL}>
                      CAP
                    </TableCell>
                    <TableCell align="right" sx={HIDE_ON_PHONE}>
                      Verkauft (Kasse)
                    </TableCell>
                    <TableCell align="right" sx={HIDE_BELOW_XL}>
                      Nicht verkauft oder nicht kassiert
                    </TableCell>
                    <TableCell align="right" sx={HIDE_ON_PHONE}>
                      Rest
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((item) => (
                    <ItemRow key={item.key} item={item} />
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={ITEM_COLUMNS}>
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
              sx={{ px: 2, py: 1, display: { xs: 'block', xl: 'none' } }}
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
                          {bakedText(
                            item.allBaked,
                            item.allBakedIsMinimum,
                            item.unit
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {unmatchedHint(item)}
                          </Typography>
                          {item.status !== 'keine_plu' &&
                            item.gaps.noReport.length > 0 && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                component="div"
                              >
                                kein Kassenbericht:{' '}
                                {dateList(item.gaps.noReport)}
                              </Typography>
                            )}
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
