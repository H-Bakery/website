'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { Alert, Box, Button, Link as MuiLink, Typography } from '@mui/material'
import { analyticsService } from '@bakery/shared/data-access'
import type {
  AnalyticsSummary,
  PaymentMethodData,
  ProductAnalyticsPerformance,
  RevenueData,
} from '@bakery/shared/types'
import OwnerOnlyNotice from '../../../components/analytics/OwnerOnlyNotice'
import DateRangeFilter from '../../../components/analytics/DateRangeFilter'
import RevenueChart from '../../../components/analytics/RevenueChart'
import PaymentMix from '../../../components/analytics/PaymentMix'
import ProductRanking from '../../../components/analytics/ProductRanking'
import useLatestRequest from '../../../components/analytics/useLatestRequest'
import {
  ANALYTICS_MAX_DAYS,
  addDaysIso,
  localIsoDate,
  standardPresets,
} from '../../../components/analytics/dateRange'
import {
  EmptyState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../components/layout'
import { formatEuro } from '../../../lib/reportFormat'

interface OverviewData {
  revenue: RevenueData[]
  top: ProductAnalyticsPerformance[]
  bottom: ProductAnalyticsPerformance[]
  payments: PaymentMethodData[]
  summary: AnalyticsSummary | null
  available: boolean
  forbidden: boolean
}

export default function AnalyticsPage() {
  const today = localIsoDate()
  const [range, setRange] = useState({
    from: addDaysIso(today, -29),
    to: today,
  })

  const { data, loading, error, reload } =
    useLatestRequest<OverviewData>(async () => {
      const params = { startDate: range.from, endDate: range.to }
      const [revenue, top, bottom, payments, summary] = await Promise.all([
        analyticsService.getRevenueTrendsWithSource({
          ...params,
          granularity: 'daily',
        }),
        analyticsService.getProductPerformanceWithSource({
          ...params,
          type: 'top',
          limit: 10,
        }),
        analyticsService.getProductPerformanceWithSource({
          ...params,
          type: 'bottom',
          limit: 5,
        }),
        analyticsService.getPaymentMethodsWithSource(params),
        analyticsService.getSummaryWithSource(params),
      ])
      const all = [revenue, top, bottom, payments, summary]
      return {
        revenue: revenue.data,
        top: top.data,
        bottom: bottom.data,
        payments: payments.data,
        summary: summary.data,
        available: all.every((r) => r.available),
        forbidden: all.some((r) => Boolean(r.forbidden)),
      }
    }, [range.from, range.to])

  const summary = data?.summary ?? null
  const hasData = Boolean(data?.available && summary)

  let body: React.ReactNode
  if (!data && loading) {
    body = <LoadingState label="Analysen werden geladen …" />
  } else if (error || !data) {
    body = (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={reload}>
            Erneut versuchen
          </Button>
        }
      >
        Analysedaten konnten nicht geladen werden.
      </Alert>
    )
  } else if (data.forbidden) {
    body = <OwnerOnlyNotice />
  } else if (!data.available) {
    body = (
      <Alert severity="error">
        Die API liefert keine Analysedaten. Es werden keine Zahlen angezeigt -
        Beispieldaten gibt es hier bewusst nicht.
      </Alert>
    )
  } else if (!summary) {
    body = (
      <EmptyState
        title="Für den gewählten Zeitraum liegt kein Kassenbericht vor."
        description="Tage ohne Bericht sind Lücken, kein Umsatz von 0 €."
      />
    )
  }

  return (
    <PageLayout
      title="Analysen"
      subtitle="Umsatz und Verkäufe aus den Kassenberichten"
      actions={
        <>
          <Button
            component={Link}
            href="/admin/analytics/revenue"
            variant="outlined"
          >
            Umsatzanalyse
          </Button>
          <Button
            component={Link}
            href="/admin/analytics/products"
            variant="outlined"
          >
            Produktanalyse
          </Button>
        </>
      }
    >
      <DateRangeFilter
        from={range.from}
        to={range.to}
        onApply={(from, to) => setRange({ from, to })}
        presets={standardPresets(today)}
        max={today}
        maxDays={ANALYTICS_MAX_DAYS}
      />

      {body}

      {hasData && data && summary && (
        <>
          <KeyFigures
            aria-label="Kennzahlen des Zeitraums"
            items={[
              {
                label: 'Umsatz',
                value: formatEuro(summary.totalRevenue),
                hint: `${summary.totalTransactions.toLocaleString(
                  'de-DE'
                )} Bons`,
              },
              {
                label: 'Ø Bon',
                value: formatEuro(summary.avgTransactionValue),
              },
              {
                label: 'Bargeldanteil',
                value: `${summary.cashPercentage.toLocaleString('de-DE', {
                  maximumFractionDigits: 1,
                })} %`,
                hint: 'Rest: Karte und ohne Zahlung',
              },
              {
                label: 'Meistverkauft',
                value: summary.topSellingProduct?.productName || '–',
                hint: summary.topSellingProduct
                  ? `${summary.topSellingProduct.quantitySold.toLocaleString(
                      'de-DE'
                    )} Stück`
                  : undefined,
              },
            ]}
          />

          <PageSection
            title="Umsatz je Tag"
            description="Tage ohne Bericht (Ruhetag, Betriebsferien) fehlen, sie sind nicht 0."
            details={
              <Typography variant="body2" color="text.secondary">
                Quelle: Kassenberichte aus dem HQ-Archiv (Tagesabschlüsse).
                Karte = Zahlungsart „Unbar“ der Kasse. Einzelne Tage im{' '}
                <MuiLink component={Link} href="/admin/reports">
                  Berichtsarchiv
                </MuiLink>
                .
              </Typography>
            }
            detailsLabel="Quelle"
          >
            <RevenueChart data={data.revenue} />
          </PageSection>

          <Box
            sx={{
              display: 'grid',
              gap: { xs: 2, md: 3 },
              gridTemplateColumns: {
                xs: '1fr',
                lg: 'repeat(2, minmax(0, 1fr))',
              },
              alignItems: 'start',
            }}
          >
            <PageSection
              title="Top-Produkte"
              description="Nach Umsatz"
              disablePadding
              actions={
                <Button
                  component={Link}
                  href="/admin/analytics/products"
                  size="small"
                >
                  Alle Produkte
                </Button>
              }
            >
              <ProductRanking
                products={data.top}
                aria-label="Top-Produkte"
                initialRows={5}
                showAvgPrice={false}
              />
            </PageSection>
            <PageSection
              title="Wenig verkauft"
              description="Die wenigsten Stück im Zeitraum (nur verkaufte Produkte)"
              disablePadding
            >
              <ProductRanking
                products={data.bottom}
                aria-label="Wenig verkaufte Produkte"
                showAvgPrice={false}
                showRank={false}
              />
            </PageSection>
          </Box>

          <PageSection title="Zahlungsarten">
            <PaymentMix data={data.payments} />
          </PageSection>
        </>
      )}
    </PageLayout>
  )
}
