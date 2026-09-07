'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Link as MuiLink,
} from '@mui/material'
import {
  Assessment as ReportsIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material'
import type { DailyReportList } from '../../../lib/reports'
import {
  formatEuro,
  formatPercent,
  formatReportDate,
} from '../../../lib/reportFormat'

interface Props {
  list: DailyReportList
  /** Jüngster Tag mit Bericht - `null`, wenn es gar keine Berichte gibt. */
  latestDate: string | null
  earliestDate: string | null
}

function monthOf(date: string) {
  return date.slice(0, 7)
}

function lastDayOfMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${month}-${String(last).padStart(2, '0')}`
}

function previousMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function addDaysIso(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function ReportsArchiveClient({
  list,
  latestDate,
  earliestDate,
}: Props) {
  const router = useRouter()
  const [from, setFrom] = useState(list.from)
  const [to, setTo] = useState(list.to)
  const [hideGaps, setHideGaps] = useState(false)

  const navigate = (f: string, t: string) => {
    router.push(`/admin/reports?from=${f}&to=${t}`)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!from || !to) return
    navigate(from <= to ? from : to, from <= to ? to : from)
  }

  const anchor = latestDate ?? list.to
  const presets = [
    { label: '7 Tage', from: addDaysIso(anchor, -6), to: anchor },
    { label: '30 Tage', from: addDaysIso(anchor, -29), to: anchor },
    {
      label: 'Dieser Monat',
      from: `${monthOf(anchor)}-01`,
      to: lastDayOfMonth(monthOf(anchor)),
    },
    {
      label: 'Letzter Monat',
      from: `${previousMonth(monthOf(anchor))}-01`,
      to: lastDayOfMonth(previousMonth(monthOf(anchor))),
    },
  ]

  const summary = list.summary
  const days = hideGaps ? list.days.filter((d) => d.status === 'ok') : list.days
  const gapCount = list.days.filter((d) => d.status === 'no-data').length

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          <ReportsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Kassenberichte
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Tagesabschlüsse der Kasse aus dem HQ-Archiv
          {latestDate && earliestDate
            ? ` · Berichte von ${formatReportDate(
                earliestDate
              )} bis ${formatReportDate(latestDate)}`
            : ''}
        </Typography>
      </Box>

      {!list.available && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Das Berichtsverzeichnis (<code>hq/data/reports/converted</code>) ist
          auf diesem Rechner nicht erreichbar. Es werden keine Zahlen angezeigt
          - Beispieldaten gibt es hier bewusst nicht.
        </Alert>
      )}

      {/* Zeitraum */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box
          component="form"
          onSubmit={submit}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center',
          }}
        >
          <TextField
            label="Von"
            type="date"
            size="small"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'aria-label': 'Von' }}
          />
          <TextField
            label="Bis"
            type="date"
            size="small"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'aria-label': 'Bis' }}
          />
          <Button type="submit" variant="contained" size="small">
            Anzeigen
          </Button>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {presets.map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                size="small"
                variant={
                  p.from === list.from && p.to === list.to
                    ? 'filled'
                    : 'outlined'
                }
                color={
                  p.from === list.from && p.to === list.to
                    ? 'primary'
                    : 'default'
                }
                onClick={() => navigate(p.from, p.to)}
              />
            ))}
          </Stack>
        </Box>
      </Paper>

      {/* Kennzahlen des Zeitraums */}
      {summary.status === 'ok' ? (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Umsatz
              </Typography>
              <Typography variant="h5">
                {formatEuro(summary.revenue)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summary.dayCount} {summary.dayCount === 1 ? 'Tag' : 'Tage'} · Ø{' '}
                {formatEuro(summary.avgDayRevenue)} je Tag
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Bons
              </Typography>
              <Typography variant="h5">
                {summary.receiptCount.toLocaleString('de-DE')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summary.stornoCount > 0
                  ? `${summary.stornoCount} Storno${
                      summary.stornoCount === 1 ? '' : 's'
                    }`
                  : 'keine Stornos'}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Ø Bon
              </Typography>
              <Typography variant="h5">
                {formatEuro(summary.avgReceipt)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                bester Tag{' '}
                <MuiLink
                  component={Link}
                  href={`/admin/reports/${summary.bestDay.date}`}
                >
                  {formatReportDate(summary.bestDay.date)}
                </MuiLink>
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Zahlungsmix
              </Typography>
              <Typography variant="h5">
                {formatPercent(summary.cashShare)} bar
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatPercent(summary.cardShare)} Karte
                {summary.payments.other.count > 0
                  ? ` · ${summary.payments.other.count} ohne Zahlung`
                  : ''}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      ) : (
        list.available && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Für den Zeitraum {formatReportDate(list.from)} bis{' '}
            {formatReportDate(list.to)} liegt kein Kassenbericht vor.
          </Alert>
        )
      )}

      {/* Tagesliste */}
      <Paper>
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Typography variant="h6">
            Tage {formatReportDate(list.from)} - {formatReportDate(list.to)}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={hideGaps}
                onChange={(e) => setHideGaps(e.target.checked)}
              />
            }
            label={`Tage ohne Bericht ausblenden (${gapCount})`}
          />
        </Box>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label="Kassenberichte je Tag">
            <TableHead>
              <TableRow>
                <TableCell>Tag</TableCell>
                <TableCell align="right">Umsatz</TableCell>
                <TableCell align="right">Bons</TableCell>
                <TableCell align="right">Ø Bon</TableCell>
                <TableCell align="right">Bar</TableCell>
                <TableCell align="right">Karte</TableCell>
                <TableCell>Hinweise</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {days.map((day) =>
                day.status === 'ok' ? (
                  <TableRow key={day.date} hover>
                    <TableCell>
                      <Link
                        href={`/admin/reports/${day.date}`}
                        style={{ color: 'inherit', fontWeight: 500 }}
                      >
                        {formatReportDate(day.date)}
                      </Link>
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        {day.weekday}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
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
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {day.closingCount > 1 && (
                          <Tooltip title="Mehrere Kassenabschlüsse an diesem Tag, zusammengerechnet">
                            <Chip
                              size="small"
                              label={`${day.closingCount} Abschlüsse`}
                            />
                          </Tooltip>
                        )}
                        {day.stornoCount > 0 && (
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label={`${day.stornoCount} Storno${
                              day.stornoCount === 1 ? '' : 's'
                            }`}
                          />
                        )}
                        {day.cancelledCount > 0 && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`${day.cancelledCount} abgebrochen`}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        component={Link}
                        href={`/admin/reports/${day.date}`}
                        size="small"
                        endIcon={<ChevronRightIcon />}
                        aria-label={`Bericht vom ${formatReportDate(
                          day.date
                        )} öffnen`}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={day.date} sx={{ opacity: 0.6 }}>
                    <TableCell>
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
                    <TableCell colSpan={6}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label="kein Bericht"
                      />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )
              )}
              {days.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      Keine Tage im gewählten Zeitraum.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 2 }}
      >
        Umsatz = Summe aller Bons des Kassenabschlusses (Stornos negativ,
        abgebrochene Belege nicht gezählt). Karte = Zahlungsart „Unbar" der
        Kasse. Tage ohne Datei (Ruhetag, Betriebsferien, fehlender Export)
        erscheinen als „kein Bericht", nicht als Umsatz 0.
      </Typography>
    </Box>
  )
}
