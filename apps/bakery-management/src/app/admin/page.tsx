import React from 'react'
import { getLatestDailyReport, reportsAvailable } from '../../lib/reports'
import DashboardClient, { type LatestReportTile } from './DashboardClient'

/**
 * Dashboard. Server-Komponente: die Kassen-Kacheln (Umsatz, Bons, Ø Bon)
 * kommen aus dem jüngsten Kassenbericht in `hq/data/reports` - mit sichtbarem
 * Datum, weil „jüngster Tag" nicht „heute" ist. Alles andere lädt die
 * Client-Komponente zur Laufzeit über die API.
 *
 * `force-dynamic`, damit die Kacheln bei jedem Aufruf neu gelesen werden und
 * nicht beim Build einfrieren.
 */
export const dynamic = 'force-dynamic'

export default function AdminDashboardPage() {
  const latest = getLatestDailyReport()
  const tile: LatestReportTile | null =
    latest && latest.status === 'ok'
      ? {
          date: latest.date,
          weekday: latest.weekday,
          revenue: latest.revenue,
          receiptCount: latest.receiptCount,
          avgReceipt: latest.avgReceipt,
          cashShare: latest.cashShare,
          cardShare: latest.cardShare,
        }
      : null
  return (
    <DashboardClient
      latestReport={tile}
      reportsAvailable={reportsAvailable()}
    />
  )
}
