'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Chip,
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
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material'
import type { DailyReportResult } from '../../../../lib/reports'
import {
  formatEuro,
  formatPercent,
  formatQuantity,
  formatReportDate,
  formatReportDateLong,
} from '../../../../lib/reportFormat'

interface Props {
  report: DailyReportResult
  previousDate: string | null
  nextDate: string | null
  invalidDate?: boolean
}

export default function DayReportClient({
  report,
  previousDate,
  nextDate,
  invalidDate,
}: Props) {
  const [filter, setFilter] = useState('')

  const nav = (
    <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap">
      <Button
        component={Link}
        href="/admin/reports"
        startIcon={<ArrowBackIcon />}
        size="small"
      >
        Zum Archiv
      </Button>
      <Button
        component={Link}
        href={previousDate ? `/admin/reports/${previousDate}` : '#'}
        disabled={!previousDate}
        startIcon={<ChevronLeftIcon />}
        size="small"
      >
        {previousDate ? formatReportDate(previousDate) : 'kein früherer'}
      </Button>
      <Button
        component={Link}
        href={nextDate ? `/admin/reports/${nextDate}` : '#'}
        disabled={!nextDate}
        endIcon={<ChevronRightIcon />}
        size="small"
      >
        {nextDate ? formatReportDate(nextDate) : 'kein späterer'}
      </Button>
    </Stack>
  )

  if (report.status !== 'ok') {
    return (
      <Box>
        {nav}
        <Typography variant="h4" component="h1" gutterBottom>
          <ReceiptIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          {invalidDate
            ? 'Kassenbericht'
            : formatReportDateLong(report.date, report.weekday)}
        </Typography>
        <Alert severity="info">
          {invalidDate
            ? `„${report.date}" ist kein gültiges Datum (erwartet: JJJJ-MM-TT).`
            : 'Für diesen Tag liegt kein Kassenbericht vor - Ruhetag, Betriebsferien oder fehlender Export. Das ist eine Lücke, kein Umsatz von 0 €.'}
        </Alert>
      </Box>
    )
  }

  const maxHourRevenue = Math.max(0, ...report.hours.map((h) => h.revenue))
  const needle = filter.trim().toLocaleLowerCase('de-DE')
  const products = needle
    ? report.products.filter((p) =>
        p.productName.toLocaleLowerCase('de-DE').includes(needle)
      )
    : report.products
  const negativeProducts = report.products.filter((p) => p.quantity < 0)
  const positionsRevenue = report.products.reduce((s, p) => s + p.revenue, 0)
  const positionsGap =
    Math.round((report.revenue - positionsRevenue) * 100) / 100

  return (
    <Box>
      {nav}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          <ReceiptIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          {formatReportDateLong(report.date, report.weekday)}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {report.closings.map((c, i) => (
            <Chip
              key={c.filename ?? i}
              size="small"
              variant="outlined"
              label={`Kasse ${c.registerId ?? '?'} · Abschluss ${
                c.reportNumber ?? i + 1
              } · ${c.transactionCount} Bons`}
            />
          ))}
          {report.firstReceipt && report.lastReceipt && (
            <Chip
              size="small"
              variant="outlined"
              label={`${report.firstReceipt} - ${report.lastReceipt} Uhr`}
            />
          )}
        </Stack>
      </Box>

      {report.closingCount > 1 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          An diesem Tag gab es {report.closingCount} Kassenabschlüsse; die
          Zahlen sind zusammengerechnet.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Umsatz
            </Typography>
            <Typography variant="h5">{formatEuro(report.revenue)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Bons
            </Typography>
            <Typography variant="h5">{report.receiptCount}</Typography>
            <Typography variant="caption" color="text.secondary">
              {report.stornoCount > 0
                ? `${report.stornoCount} Storno${
                    report.stornoCount === 1 ? '' : 's'
                  } (${formatEuro(report.stornoAmount)})`
                : 'keine Stornos'}
              {report.cancelledCount > 0
                ? ` · ${report.cancelledCount} abgebrochen`
                : ''}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Ø Bon
            </Typography>
            <Typography variant="h5">
              {formatEuro(report.avgReceipt)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Zahlungsmix
            </Typography>
            <Typography variant="body1">
              Bar {formatEuro(report.payments.cash.amount)} (
              {formatPercent(report.cashShare)}, {report.payments.cash.count}{' '}
              Bons)
            </Typography>
            <Typography variant="body1">
              Karte {formatEuro(report.payments.card.amount)} (
              {formatPercent(report.cardShare)}, {report.payments.card.count}{' '}
              Bons)
            </Typography>
            {report.payments.other.count > 0 && (
              <Typography variant="body2" color="text.secondary">
                Ohne Zahlung {formatEuro(report.payments.other.amount)} (
                {report.payments.other.count} Bons)
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Stundenverlauf */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Stundenverlauf
            </Typography>
            {report.hours.length === 0 ? (
              <Typography color="text.secondary">Keine Bons.</Typography>
            ) : (
              <Stack spacing={1}>
                {report.hours.map((h) => (
                  <Box key={h.hour}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="body2">
                        {h.hour}:00 -{' '}
                        {String(Number(h.hour) + 1).padStart(2, '0')}
                        :00
                      </Typography>
                      <Typography variant="body2">
                        {formatEuro(h.revenue)} · {h.receiptCount} Bons
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={
                        maxHourRevenue > 0
                          ? Math.max(0, (h.revenue / maxHourRevenue) * 100)
                          : 0
                      }
                      sx={{ height: 8, borderRadius: 4 }}
                      aria-label={`Umsatz ${h.hour} Uhr`}
                    />
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* Positionen nach Produkt */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
                mb: 1,
              }}
            >
              <Typography variant="h6">
                Positionen nach Produkt ({report.products.length})
              </Typography>
              <TextField
                size="small"
                placeholder="Produkt suchen"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                inputProps={{ 'aria-label': 'Produkt suchen' }}
              />
            </Box>
            {negativeProducts.length > 0 && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {negativeProducts.length === 1
                  ? 'Ein Produkt hat eine negative Menge'
                  : `${negativeProducts.length} Produkte haben eine negative Menge`}{' '}
                - die Storno-Gegenbuchung liegt an diesem Tag, der Ursprungsbon
                an einem anderen. Die Tagessumme stimmt, die Stückzahl dieses
                Tages nicht.
              </Alert>
            )}
            {Math.abs(positionsGap) >= 0.01 && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1 }}
              >
                Positionen ergeben {formatEuro(positionsRevenue)}; die Differenz
                von {formatEuro(positionsGap)} zum Bon-Umsatz sind Rabatte oder
                Gutscheine ohne eigene Position.
              </Typography>
            )}
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Positionen nach Produkt">
                <TableHead>
                  <TableRow>
                    <TableCell>Produkt</TableCell>
                    <TableCell align="right">Menge</TableCell>
                    <TableCell align="right">Umsatz</TableCell>
                    <TableCell align="right">Anteil</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((p) => (
                    <TableRow
                      key={p.productId ?? p.productName}
                      hover
                      sx={
                        p.quantity < 0 ? { color: 'warning.main' } : undefined
                      }
                    >
                      <TableCell sx={{ color: 'inherit' }}>
                        {p.productName}
                        {p.productId && (
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ ml: 1 }}
                          >
                            #{p.productId}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'inherit' }}>
                        {formatQuantity(p.quantity)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'inherit' }}>
                        {formatEuro(p.revenue)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'inherit' }}>
                        {report.revenue > 0
                          ? formatPercent((p.revenue / report.revenue) * 100)
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                        <Typography color="text.secondary">
                          {needle
                            ? 'Kein Produkt passt zur Suche.'
                            : 'Keine Positionen.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
