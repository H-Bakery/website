import React from 'react'
import { listReportDates } from '../../../../lib/reports'
import RevenueAnalyticsClient from './RevenueAnalyticsClient'

export const dynamic = 'force-dynamic'

/**
 * Server-Hülle: liest nur, welche Tage einen Kassenbericht haben. Der
 * Zeitraum endet am jüngsten davon (`reportAnchor`) - dieselbe Regel wie
 * das Berichtsarchiv, damit „30 Tage“ überall dieselbe Summe ergibt.
 */

export default function RevenueAnalyticsPage() {
  const dates = listReportDates()
  return (
    <RevenueAnalyticsClient
      latestReportDate={dates.length > 0 ? dates[dates.length - 1] : null}
      earliestReportDate={dates.length > 0 ? dates[0] : null}
    />
  )
}
