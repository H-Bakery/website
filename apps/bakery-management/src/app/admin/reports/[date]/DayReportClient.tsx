'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  LinearProgress,
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
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material'
import type { DailyReportResult } from '../../../../lib/reports'
import {
  formatEuro,
  formatPercent,
  formatQuantity,
  formatReportDate,
  formatReportDateLong,
} from '../../../../lib/reportFormat'
import {
  EmptyState,
  KeyFigures,
  PageLayout,
  PageSection,
} from '../../../../components/layout'

interface Props {
  report: DailyReportResult
  previousDate: string | null
  nextDate: string | null
  invalidDate?: boolean
}

/** `1 Bon`, `2 Bons` */
function bons(count: number): string {
  return `${count} Bon${count === 1 ? '' : 's'}`
}

const BACK = { href: '/admin/reports', label: 'Kassenberichte' }

/** Vor/Zurück zum nächsten Tag *mit Bericht* - im Kopf der Seite. */
function DayNav({
  previousDate,
  nextDate,
}: {
  previousDate: string | null
  nextDate: string | null
}) {
  return (
    <>
      <Button
        component={Link}
        href={previousDate ? `/admin/reports/${previousDate}` : '#'}
        disabled={!previousDate}
        variant="outlined"
        startIcon={<ChevronLeftIcon />}
      >
        {previousDate ? formatReportDate(previousDate) : 'kein früherer'}
      </Button>
      <Button
        component={Link}
        href={nextDate ? `/admin/reports/${nextDate}` : '#'}
        disabled={!nextDate}
        variant="outlined"
        endIcon={<ChevronRightIcon />}
      >
        {nextDate ? formatReportDate(nextDate) : 'kein späterer'}
      </Button>
    </>
  )
}

export default function DayReportClient({
  report,
  previousDate,
  nextDate,
  invalidDate,
}: Props) {
  const [filter, setFilter] = useState('')
  const nav = <DayNav previousDate={previousDate} nextDate={nextDate} />

  if (report.status !== 'ok') {
    return (
      <PageLayout
        title={
          invalidDate
            ? 'Kassenbericht'
            : formatReportDateLong(report.date, report.weekday)
        }
        back={BACK}
        actions={invalidDate ? undefined : nav}
      >
        {invalidDate ? (
          <Alert severity="warning">
            {`„${report.date}“ ist kein gültiges Datum (erwartet: JJJJ-MM-TT).`}
          </Alert>
        ) : (
          <EmptyState
            title="Für diesen Tag liegt kein Kassenbericht vor."
            description="Ruhetag, Betriebsferien oder fehlender Export. Das ist eine Lücke, kein Umsatz von 0 €."
          />
        )}
      </PageLayout>
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

  const subtitleParts: React.ReactNode[] = report.closings.map((c, i) => (
    <span key={c.filename ?? i}>
      {`Kasse ${c.registerId ?? '?'} · Abschluss ${
        c.reportNumber ?? i + 1
      } · ${bons(c.receiptCount)}`}
    </span>
  ))
  if (report.firstReceipt && report.lastReceipt) {
    subtitleParts.push(
      <span key="time">{`${report.firstReceipt} – ${report.lastReceipt} Uhr`}</span>
    )
  }

  return (
    <PageLayout
      title={formatReportDateLong(report.date, report.weekday)}
      back={BACK}
      actions={nav}
      subtitle={
        <>
          {subtitleParts.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && ' · '}
              {part}
            </React.Fragment>
          ))}
          {report.closingCount > 1 && ' · zusammengerechnet'}
        </>
      }
    >
      <KeyFigures
        aria-label="Kennzahlen des Tages"
        items={[
          { label: 'Umsatz', value: formatEuro(report.revenue) },
          {
            label: 'Bons',
            value: report.receiptCount,
            hint: `${
              report.stornoCount > 0
                ? `${report.stornoCount} Storno${
                    report.stornoCount === 1 ? '' : 's'
                  } (${formatEuro(report.stornoAmount)})`
                : 'keine Stornos'
            }${
              report.cancelledCount > 0
                ? ` · ${report.cancelledCount} abgebrochen`
                : ''
            }`,
          },
          { label: 'Ø Bon', value: formatEuro(report.avgReceipt) },
          {
            label: 'Bar / Karte',
            value: `${formatPercent(report.cashShare)} bar`,
            hint: `Bar ${formatEuro(report.payments.cash.amount)} (${bons(
              report.payments.cash.count
            )}) · Karte ${formatEuro(report.payments.card.amount)} (${bons(
              report.payments.card.count
            )})${
              report.payments.other.count > 0
                ? ` · ohne Zahlung ${formatEuro(
                    report.payments.other.amount
                  )} (${bons(report.payments.other.count)})`
                : ''
            }`,
          },
        ]}
      />

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(0, 1fr) minmax(0, 2fr)',
          },
          alignItems: 'start',
        }}
      >
        <PageSection title="Stundenverlauf">
          {report.hours.length === 0 ? (
            <Typography color="text.secondary">Keine Bons.</Typography>
          ) : (
            <Stack spacing={1.25}>
              {report.hours.map((h) => (
                <Box key={h.hour}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 1,
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="body2">{h.hour} Uhr</Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatEuro(h.revenue)}
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                      >
                        {` · ${bons(h.receiptCount)}`}
                      </Typography>
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={
                      maxHourRevenue > 0
                        ? Math.max(0, (h.revenue / maxHourRevenue) * 100)
                        : 0
                    }
                    sx={{ height: 6, borderRadius: 3 }}
                    aria-label={`Umsatz ${h.hour} Uhr`}
                  />
                </Box>
              ))}
            </Stack>
          )}
        </PageSection>

        <PageSection
          title={`Positionen nach Produkt (${report.products.length})`}
          disablePadding
          actions={
            <TextField
              size="small"
              placeholder="Produkt suchen"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              inputProps={{ 'aria-label': 'Produkt suchen' }}
              sx={{ width: { xs: '100%', sm: 200 } }}
            />
          }
        >
          {(negativeProducts.length > 0 || Math.abs(positionsGap) >= 0.01) && (
            <Box sx={{ px: { xs: 2, md: 3 }, pb: 1.5 }}>
              {negativeProducts.length > 0 && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  {negativeProducts.length === 1
                    ? 'Ein Produkt hat eine negative Menge'
                    : `${negativeProducts.length} Produkte haben eine negative Menge`}{' '}
                  - die Storno-Gegenbuchung liegt an diesem Tag, der
                  Ursprungsbon an einem anderen. Die Tagessumme stimmt, die
                  Stückzahl dieses Tages nicht.
                </Alert>
              )}
              {Math.abs(positionsGap) >= 0.01 && (
                <Typography variant="body2" color="text.secondary">
                  Positionen ergeben {formatEuro(positionsRevenue)}; die
                  Differenz von {formatEuro(positionsGap)} zum Bon-Umsatz sind
                  Rabatte oder Gutscheine ohne eigene Position.
                </Typography>
              )}
            </Box>
          )}
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Positionen nach Produkt">
              <TableHead>
                <TableRow>
                  <TableCell>Produkt</TableCell>
                  <TableCell align="right">Menge</TableCell>
                  <TableCell align="right">Umsatz</TableCell>
                  <TableCell
                    align="right"
                    sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                  >
                    Anteil
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {products.map((p) => (
                  <TableRow
                    key={p.productId ?? p.productName}
                    hover
                    data-negative={p.quantity < 0 || undefined}
                    sx={
                      p.quantity < 0
                        ? {
                            '& td': { color: 'warning.main', fontWeight: 600 },
                          }
                        : undefined
                    }
                  >
                    <TableCell>
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
                    <TableCell align="right">
                      {formatQuantity(p.quantity)}
                    </TableCell>
                    <TableCell align="right">{formatEuro(p.revenue)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                    >
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
        </PageSection>
      </Box>
    </PageLayout>
  )
}
