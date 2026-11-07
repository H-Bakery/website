'use client'
import React, { useState } from 'react'
import {
  Alert,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { analyticsService } from '@bakery/shared/data-access'
import type { ProductAnalyticsPerformance } from '@bakery/shared/types'
import OwnerOnlyNotice from '../../../../components/analytics/OwnerOnlyNotice'
import DateRangeFilter from '../../../../components/analytics/DateRangeFilter'
import ProductRanking from '../../../../components/analytics/ProductRanking'
import useLatestRequest from '../../../../components/analytics/useLatestRequest'
import {
  ANALYTICS_MAX_DAYS,
  type AnalyticsRangeProps,
  defaultReportRange,
  localIsoDate,
  reportAnchor,
  reportArchiveNote,
  standardPresets,
} from '../../../../components/analytics/dateRange'
import {
  EmptyState,
  ErrorState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../components/layout'
import { formatEuro } from '../../../../lib/reportFormat'

interface ProductsResult {
  all: ProductAnalyticsPerformance[]
  bottom: ProductAnalyticsPerformance[]
  available: boolean
  forbidden: boolean
}

const NET_QUANTITY_NOTE =
  'Mengen sind Nettomengen aus den Bons. Fehleingaben werden an der Kasse durch eine negative Gegenbuchung ausgeglichen, die auch an einem anderen Tag liegen kann - über kurze Zeiträume können einzelne Stückzahlen deshalb abweichen. Umsätze stimmen mit dem Kassenabschluss überein.'

export default function ProductAnalyticsPage({
  latestReportDate = null,
  earliestReportDate = null,
}: AnalyticsRangeProps = {}) {
  const today = localIsoDate()
  // Zeiträume enden am jüngsten Tag mit Bericht - wie im Berichtsarchiv.
  const anchor = reportAnchor(latestReportDate, today)
  const [range, setRange] = useState(() => defaultReportRange(anchor))
  // Eine Liste, zwei Sortierungen - früher stand „Wenig verkauft“ als
  // zweite Tabelle mit denselben Produkten darunter.
  const [order, setOrder] = useState<'revenue' | 'low'>('revenue')

  const { data, loading, error, reload } =
    useLatestRequest<ProductsResult>(async () => {
      const params = { startDate: range.from, endDate: range.to }
      const [all, bottom] = await Promise.all([
        analyticsService.getProductPerformanceWithSource({
          ...params,
          type: 'top',
          limit: 200,
        }),
        analyticsService.getProductPerformanceWithSource({
          ...params,
          type: 'bottom',
          limit: 200,
        }),
      ])
      return {
        all: all.data,
        bottom: bottom.data,
        available: all.available && bottom.available,
        forbidden: Boolean(all.forbidden || bottom.forbidden),
      }
    }, [range.from, range.to])

  const all = data?.all ?? []
  const hasData = Boolean(data?.available && all.length > 0)

  let body: React.ReactNode = null
  if (!data && loading) {
    body = <LoadingState label="Produktdaten werden geladen …" />
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
        Produktdaten konnten nicht geladen werden.
      </Alert>
    )
  } else if (data.forbidden) {
    body = <OwnerOnlyNotice />
  } else if (!data.available) {
    body = (
      // Der Dienst fängt Netz- und Serverfehler ab (`available: false`) -
      // wie auf jeder Seite der WLAN-Hinweis und „Erneut versuchen“ statt
      // eines Satzes über Beispieldaten (UI-Runde 2). Zahlen gibt es keine.
      <ErrorState
        title="Produktdaten konnten nicht geladen werden"
        message="Der Server hat keine Produktdaten geliefert – bitte WLAN prüfen und erneut versuchen."
        onRetry={reload}
        data-testid="analytics-unavailable"
      />
    )
  } else if (all.length === 0) {
    body = (
      <EmptyState
        title="Für den gewählten Zeitraum liegt kein Kassenbericht vor."
        description="Tage ohne Bericht sind Lücken, kein Umsatz von 0 €."
      />
    )
  }

  let figures: React.ReactNode = null
  if (hasData) {
    const revenue = all.reduce((sum, p) => sum + p.revenue, 0)
    const byQuantity = all.reduce((a, b) =>
      b.quantitySold > a.quantitySold ? b : a
    )
    const byRevenue = all.reduce((a, b) => (b.revenue > a.revenue ? b : a))
    figures = (
      <KeyFigures
        aria-label="Kennzahlen des Zeitraums"
        items={[
          {
            label: 'Umsatz aller Produkte',
            value: formatEuro(revenue),
          },
          {
            label: 'Verkaufte Produkte',
            value: all.length.toLocaleString('de-DE'),
            hint: 'mit mindestens einem Verkauf',
          },
          {
            label: 'Umsatzstärkstes Produkt',
            value: byRevenue.productName,
            hint: formatEuro(byRevenue.revenue),
          },
          {
            label: 'Meistverkauft',
            value: byQuantity.productName,
            hint: `${byQuantity.quantitySold.toLocaleString('de-DE')} Stück`,
          },
        ]}
      />
    )
  }

  return (
    <PageLayout
      title="Produktanalyse"
      subtitle="Verkaufte Mengen je Produkt aus den Kassenberichten"
      back={{ href: '/admin/analytics', label: 'Analysen' }}
    >
      <DateRangeFilter
        from={range.from}
        to={range.to}
        onApply={(from, to) => setRange({ from, to })}
        presets={standardPresets(anchor)}
        max={today}
        maxDays={ANALYTICS_MAX_DAYS}
        note={reportArchiveNote(earliestReportDate, latestReportDate)}
      />

      {body}
      {figures}

      {hasData && data && (
        <>
          <PageSection
            title={`Alle Produkte (${all.length})`}
            description={
              order === 'revenue'
                ? 'Nach Umsatz sortiert'
                : 'Die wenigsten Stück zuerst (nur Produkte, die überhaupt verkauft wurden)'
            }
            disablePadding
            actions={
              <ToggleButtonGroup
                value={order}
                exclusive
                size="small"
                aria-label="Sortierung"
                onChange={(_, value) => value && setOrder(value)}
              >
                <ToggleButton value="revenue">Nach Umsatz</ToggleButton>
                <ToggleButton value="low">Wenig verkauft</ToggleButton>
              </ToggleButtonGroup>
            }
            detailsLabel="Hinweis zu den Mengen"
            details={
              <Typography variant="body2" color="text.secondary">
                {NET_QUANTITY_NOTE}
              </Typography>
            }
          >
            {order === 'revenue' ? (
              <ProductRanking
                key="revenue"
                products={all}
                aria-label="Produkte nach Umsatz"
                initialRows={20}
                searchable
              />
            ) : (
              <ProductRanking
                key="low"
                products={data.bottom}
                aria-label="Wenig verkaufte Produkte"
                initialRows={20}
                searchable
                showRank={false}
              />
            )}
          </PageSection>
        </>
      )}
    </PageLayout>
  )
}
