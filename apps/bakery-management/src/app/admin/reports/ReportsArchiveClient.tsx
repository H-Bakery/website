'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Link as MuiLink,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import type { DailyReportList, DailyReportSummary } from '../../../lib/reports'
import {
  formatEuro,
  formatPercent,
  formatReportDate,
} from '../../../lib/reportFormat'
import {
  EmptyState,
  KeyFigures,
  PageLayout,
  PageSection,
} from '../../../components/layout'
import DateRangeFilter from '../../../components/analytics/DateRangeFilter'
import {
  formatIsoRange,
  reportArchiveNote,
  standardPresets,
} from '../../../components/analytics/dateRange'

interface Props {
  list: DailyReportList
  /** Jüngster Tag mit Bericht - `null`, wenn es gar keine Berichte gibt. */
  latestDate: string | null
  earliestDate: string | null
  /** Gewünschter Anfang, falls der Server den Zeitraum gekürzt hat. */
  requestedFrom?: string | null
  /** Obergrenze des Zeitraums in Tagen (aus dem Core). */
  maxRangeDays?: number
}

type OkDay = Extract<DailyReportSummary, { status: 'ok' }>
type ListDay = DailyReportList['days'][number]

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

/** Nebenwerte eines Tages als kurze Textteile (statt je eines Chips). */
function DayNotes({ day }: { day: OkDay }) {
  const parts: React.ReactNode[] = []
  if (day.stornoCount > 0) {
    parts.push(
      <span key="storno">{plural(day.stornoCount, 'Storno', 'Stornos')}</span>
    )
  }
  if (day.cancelledCount > 0) {
    parts.push(<span key="cancel">{`${day.cancelledCount} abgebrochen`}</span>)
  }
  if (day.closingCount > 1) {
    parts.push(
      <Tooltip
        key="closings"
        title="Mehrere Kassenabschlüsse an diesem Tag, zusammengerechnet"
      >
        <span>{`${day.closingCount} Abschlüsse`}</span>
      </Tooltip>
    )
  }
  if (parts.length === 0) return null
  return (
    <Typography component="span" variant="body2" color="text.secondary">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && ' · '}
          {part}
        </React.Fragment>
      ))}
    </Typography>
  )
}

function DayTable({ days }: { days: ListDay[] }) {
  const router = useRouter()
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table
        size="small"
        aria-label="Kassenberichte je Tag"
        // Zahlen nicht umbrechen („70,2 %“ stand am Tablet zweizeilig).
        sx={{ '& .MuiTableCell-alignRight': { whiteSpace: 'nowrap' } }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Tag</TableCell>
            <TableCell align="right">Umsatz</TableCell>
            <TableCell align="right">Bons</TableCell>
            <TableCell align="right">Ø Bon</TableCell>
            <TableCell align="right">Bar</TableCell>
            <TableCell align="right">Karte</TableCell>
            <TableCell>Hinweise</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {days.map((day) =>
            day.status === 'ok' ? (
              <TableRow
                key={day.date}
                hover
                onClick={() => router.push(`/admin/reports/${day.date}`)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <MuiLink
                    component={Link}
                    href={`/admin/reports/${day.date}`}
                    underline="hover"
                    sx={{ fontWeight: 600 }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    {formatReportDate(day.date)}
                  </MuiLink>
                  <Typography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 1 }}
                  >
                    {day.weekday}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {formatEuro(day.revenue)}
                </TableCell>
                <TableCell align="right">{day.receiptCount}</TableCell>
                <TableCell align="right">
                  {formatEuro(day.avgReceipt)}
                </TableCell>
                <TableCell align="right">
                  {formatPercent(day.cashShare)}
                </TableCell>
                <TableCell align="right">
                  {formatPercent(day.cardShare)}
                </TableCell>
                <TableCell>
                  <DayNotes day={day} />
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={day.date}>
                <TableCell
                  sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}
                >
                  {formatReportDate(day.date)}
                  <Typography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 1 }}
                  >
                    {day.weekday}
                  </Typography>
                </TableCell>
                <TableCell colSpan={6} sx={{ color: 'text.secondary' }}>
                  kein Bericht
                </TableCell>
              </TableRow>
            )
          )}
          {days.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">
                  Keine Tage im gewählten Zeitraum.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

/** Am Handy: eine Zeile je Tag, Umsatz rechts, Nebenwerte darunter. */
function DayCards({ days }: { days: ListDay[] }) {
  if (days.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ p: 2 }}>
        Keine Tage im gewählten Zeitraum.
      </Typography>
    )
  }
  return (
    <Box
      component="ul"
      aria-label="Kassenberichte je Tag"
      sx={{ m: 0, p: 0, listStyle: 'none' }}
    >
      {days.map((day) => {
        const head = (
          <Typography component="span" sx={{ fontWeight: 600 }}>
            {day.weekday ? `${day.weekday.slice(0, 2)}, ` : ''}
            {formatReportDate(day.date)}
          </Typography>
        )
        return (
          <Box
            component="li"
            key={day.date}
            sx={{
              '&:not(:last-of-type)': {
                borderBottom: 1,
                borderColor: 'divider',
              },
            }}
          >
            {day.status === 'ok' ? (
              <Box
                component={Link}
                href={`/admin/reports/${day.date}`}
                aria-label={`Bericht vom ${formatReportDate(day.date)} öffnen`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1.25,
                  minHeight: 56,
                  color: 'inherit',
                  textDecoration: 'none',
                  '&:hover, &:focus-visible': { bgcolor: 'action.hover' },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {head}
                  <Typography variant="body2" color="text.secondary">
                    {day.receiptCount} Bons · Ø {formatEuro(day.avgReceipt)}
                    {day.stornoCount > 0
                      ? ` · ${plural(day.stornoCount, 'Storno', 'Stornos')}`
                      : ''}
                    {day.closingCount > 1
                      ? ` · ${day.closingCount} Abschlüsse`
                      : ''}
                  </Typography>
                </Box>
                <Typography
                  sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatEuro(day.revenue)}
                </Typography>
                <ChevronRightIcon
                  fontSize="small"
                  sx={{ color: 'text.secondary', mr: -0.5 }}
                />
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  color: 'text.secondary',
                }}
              >
                <Box sx={{ flex: 1 }}>{head}</Box>
                <Typography variant="body2">kein Bericht</Typography>
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

export default function ReportsArchiveClient({
  list,
  latestDate,
  earliestDate,
  requestedFrom = null,
  maxRangeDays,
}: Props) {
  const router = useRouter()
  const theme = useTheme()
  const compact = useMediaQuery(theme.breakpoints.down('sm'))
  const [hideGaps, setHideGaps] = useState(false)

  const navigate = (f: string, t: string) => {
    router.push(`/admin/reports?from=${f}&to=${t}`)
  }

  const anchor = latestDate ?? list.to
  const summary = list.summary
  const days = hideGaps ? list.days.filter((d) => d.status === 'ok') : list.days
  const gapCount = list.days.filter((d) => d.status === 'no-data').length

  return (
    <PageLayout
      title="Kassenberichte"
      subtitle="Tagesabschlüsse der Kasse"
      width="default"
    >
      {!list.available && (
        <Alert severity="warning">
          Das Berichtsverzeichnis (<code>hq/data/reports/converted</code>) ist
          auf diesem Rechner nicht erreichbar. Es werden keine Zahlen angezeigt
          - Beispieldaten gibt es hier bewusst nicht.
        </Alert>
      )}

      {requestedFrom && (
        <Alert severity="info">
          Der Zeitraum ab {formatReportDate(requestedFrom)} wurde auf
          {maxRangeDays ? ` ${maxRangeDays}` : ' die erlaubten'} Tage gekürzt
          und beginnt jetzt am {formatReportDate(list.from)}.
        </Alert>
      )}

      <DateRangeFilter
        from={list.from}
        to={list.to}
        onApply={navigate}
        presets={standardPresets(anchor)}
        min={earliestDate ?? undefined}
        note={reportArchiveNote(earliestDate, latestDate)}
      />

      {summary.status === 'ok' ? (
        <KeyFigures
          aria-label="Kennzahlen des Zeitraums"
          items={[
            {
              label: 'Umsatz',
              value: formatEuro(summary.revenue),
              hint: `${plural(
                summary.dayCount,
                'Tag',
                'Tage'
              )} · Ø ${formatEuro(summary.avgDayRevenue)} je Tag`,
            },
            {
              label: 'Bons',
              value: summary.receiptCount.toLocaleString('de-DE'),
              hint:
                summary.stornoCount > 0
                  ? plural(summary.stornoCount, 'Storno', 'Stornos')
                  : 'keine Stornos',
            },
            {
              label: 'Ø Bon',
              value: formatEuro(summary.avgReceipt),
              hint: (
                <>
                  bester Tag{' '}
                  <MuiLink
                    component={Link}
                    href={`/admin/reports/${summary.bestDay.date}`}
                  >
                    {formatReportDate(summary.bestDay.date)}
                  </MuiLink>
                </>
              ),
            },
            {
              label: 'Zahlungsmix',
              value: `${formatPercent(summary.cashShare)} bar`,
              hint: `${formatPercent(summary.cardShare)} Karte${
                summary.payments.other.count > 0
                  ? ` · ${summary.payments.other.count} ohne Zahlung`
                  : ''
              }`,
            },
          ]}
        />
      ) : (
        list.available && (
          <EmptyState
            title={`Für ${formatIsoRange(
              list.from,
              list.to
            )} liegt kein Kassenbericht vor.`}
            description="Tage ohne Bericht sind Lücken, kein Umsatz von 0 €."
          />
        )
      )}

      <PageSection
        title={`Tage ${formatIsoRange(list.from, list.to)}`}
        disablePadding
        actions={
          gapCount > 0 || hideGaps ? (
            <FormControlLabel
              sx={{ mr: 0 }}
              control={
                <Switch
                  size="small"
                  checked={hideGaps}
                  onChange={(e) => setHideGaps(e.target.checked)}
                />
              }
              label={
                <Typography variant="body2">
                  {`Tage ohne Bericht ausblenden (${gapCount})`}
                </Typography>
              }
            />
          ) : undefined
        }
        detailsLabel="So wird gerechnet"
        details={
          <Typography variant="body2" color="text.secondary">
            Umsatz = Summe aller Bons des Kassenabschlusses (Stornos negativ,
            abgebrochene Belege nicht gezählt). Karte = Zahlungsart „Unbar“ der
            Kasse. Tage ohne Datei (Ruhetag, Betriebsferien, fehlender Export)
            erscheinen als „kein Bericht“, nicht als Umsatz 0.
          </Typography>
        }
      >
        {compact ? <DayCards days={days} /> : <DayTable days={days} />}
      </PageSection>
    </PageLayout>
  )
}
