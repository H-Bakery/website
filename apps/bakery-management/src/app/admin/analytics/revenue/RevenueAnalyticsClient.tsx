'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  Button,
  Link as MuiLink,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { analyticsService } from '@bakery/shared/data-access'
import type { Granularity } from '@bakery/shared/types'
import OwnerOnlyNotice from '../../../../components/analytics/OwnerOnlyNotice'
import DateRangeFilter from '../../../../components/analytics/DateRangeFilter'
import RevenueChart, {
  revenueLabel,
  type RevenuePoint,
} from '../../../../components/analytics/RevenueChart'
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
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../components/layout'
import { formatEuro } from '../../../../lib/reportFormat'

interface RevenueResult {
  data: RevenuePoint[]
  available: boolean
  forbidden: boolean
}

const PERIOD: Record<
  Granularity,
  { one: string; best: string; worst: string }
> = {
  daily: { one: 'Tag', best: 'Bester Tag', worst: 'Schwächster Tag' },
  weekly: { one: 'Woche', best: 'Beste Woche', worst: 'Schwächste Woche' },
  monthly: { one: 'Monat', best: 'Bester Monat', worst: 'Schwächster Monat' },
}

/** Tage mit Bericht in einem Punkt (Woche/Monat: von der API, Tag: 1). */
function daysOf(point: RevenuePoint): number {
  return typeof point.dayCount === 'number' ? point.dayCount : 1
}

export default function RevenueAnalyticsPage({
  latestReportDate = null,
  earliestReportDate = null,
}: AnalyticsRangeProps = {}) {
  const today = localIsoDate()
  // Zeiträume enden am jüngsten Tag mit Bericht - wie im Berichtsarchiv.
  const anchor = reportAnchor(latestReportDate, today)
  const [granularity, setGranularity] = useState<Granularity>('daily')
  const [range, setRange] = useState(() => defaultReportRange(anchor))

  const { data, loading, error, reload } =
    useLatestRequest<RevenueResult>(async () => {
      const result = await analyticsService.getRevenueTrendsWithSource({
        startDate: range.from,
        endDate: range.to,
        granularity,
      })
      return {
        data: result.data as RevenuePoint[],
        available: result.available,
        forbidden: Boolean(result.forbidden),
      }
    }, [range.from, range.to, granularity])

  const points = data?.data ?? []
  const hasData = Boolean(data?.available && points.length > 0)
  const period = PERIOD[granularity]

  let body: React.ReactNode = null
  if (!data && loading) {
    body = <LoadingState label="Umsätze werden geladen …" />
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
        Umsatzdaten konnten nicht geladen werden.
      </Alert>
    )
  } else if (data.forbidden) {
    body = <OwnerOnlyNotice />
  } else if (!data.available) {
    body = (
      <Alert severity="error">
        Die API liefert keine Umsatzdaten. Es werden keine Zahlen angezeigt -
        Beispieldaten gibt es hier bewusst nicht.
      </Alert>
    )
  } else if (points.length === 0) {
    body = (
      <EmptyState
        title="Für den gewählten Zeitraum liegt kein Kassenbericht vor."
        description="Tage ohne Bericht sind Lücken, kein Umsatz von 0 €."
      />
    )
  }

  let figures: React.ReactNode = null
  if (hasData) {
    const total = points.reduce((sum, p) => sum + p.revenue, 0)
    const days = points.reduce((sum, p) => sum + daysOf(p), 0)
    const best = points.reduce((a, b) => (b.revenue > a.revenue ? b : a))
    const worst = points.reduce((a, b) => (b.revenue < a.revenue ? b : a))
    // Eine angeschnittene Woche/ein angeschnittener Monat (Rand des
    // Zeitraums) ist fast immer der „schwächste“ - die Zahl der Tage sagt es.
    const pointHint = (p: RevenuePoint) =>
      granularity === 'daily'
        ? revenueLabel(p.date, granularity)
        : `${revenueLabel(p.date, granularity)} · ${daysOf(p)} ${
            daysOf(p) === 1 ? 'Tag' : 'Tage'
          } mit Bericht`
    figures = (
      <KeyFigures
        aria-label="Kennzahlen des Zeitraums"
        items={[
          {
            label: 'Gesamtumsatz',
            value: formatEuro(total),
            hint: `${days} ${days === 1 ? 'Tag' : 'Tage'} mit Bericht`,
          },
          {
            label: 'Ø je Tag mit Bericht',
            value: formatEuro(days > 0 ? total / days : 0),
          },
          {
            label: period.best,
            value: formatEuro(best.revenue),
            hint: pointHint(best),
          },
          {
            label: period.worst,
            value: formatEuro(worst.revenue),
            hint: pointHint(worst),
          },
        ]}
      />
    )
  }

  return (
    <PageLayout
      title="Umsatzanalyse"
      subtitle="Umsatzentwicklung aus den Tagesabschlüssen der Kasse"
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

      {hasData && (
        <PageSection
          title={`Umsatz je ${period.one}`}
          description="Tage ohne Bericht (Ruhetag, Betriebsferien) fehlen in der Reihe, sie sind nicht 0."
          actions={
            <ToggleButtonGroup
              value={granularity}
              exclusive
              onChange={(_, value) => value && setGranularity(value)}
              size="small"
              aria-label="Einteilung"
            >
              <ToggleButton value="daily">Tag</ToggleButton>
              <ToggleButton value="weekly">Woche</ToggleButton>
              <ToggleButton value="monthly">Monat</ToggleButton>
            </ToggleButtonGroup>
          }
          detailsLabel="Quelle"
          details={
            <Typography variant="body2" color="text.secondary">
              Quelle: Kassenberichte aus dem HQ-Archiv. Wochen sind
              Kalenderwochen (Mo–So), am Rand des Zeitraums oft nur
              angeschnitten - der Tooltip nennt die Tage mit Bericht. Details je
              Tag im{' '}
              <MuiLink component={Link} href="/admin/reports">
                Berichtsarchiv
              </MuiLink>
              .
            </Typography>
          }
        >
          <RevenueChart data={points} granularity={granularity} />
        </PageSection>
      )}
    </PageLayout>
  )
}
