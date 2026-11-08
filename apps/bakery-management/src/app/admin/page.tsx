import React from 'react'
import { headers } from 'next/headers'
import { getLatestDailyReport, reportsAvailable } from '../../lib/reports'
import { ROLE_HEADER, SESSION_KIND_HEADER } from '../../lib/sessionCookie'
import { mayLoadCashTile } from '../../lib/serverSession'
import DashboardClient, { type LatestReportTile } from './DashboardClient'

/**
 * Dashboard. Server-Komponente: die Kassen-Kacheln (Umsatz, Bons, Ø Bon)
 * kommen aus dem jüngsten Kassenbericht in `hq/data/reports` - mit sichtbarem
 * Datum, weil „jüngster Tag“ nicht „heute“ ist. Alles andere lädt die
 * Client-Komponente zur Laufzeit über die API.
 *
 * `force-dynamic`, damit die Kacheln bei jedem Aufruf neu gelesen werden und
 * nicht beim Build einfrieren.
 *
 * Rolle (F1): das Dashboard ist auch Ausweich-Startseite für Verkauf und
 * Backstube. Die Kassenzahlen werden nur gelesen, wenn die vom Proxy geprüfte
 * Rolle (`x-bakery-role`, src/proxy.ts) das Berichtsarchiv öffnen darf -
 * sonst stünden sie im RSC-Payload, auch wenn die Oberfläche sie ausblendet.
 * Fehlt der Header, gibt es keine Kassen-Kachel (fail closed).
 */
export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const requestHeaders = await headers()
  if (
    !mayLoadCashTile(
      requestHeaders.get(ROLE_HEADER),
      requestHeaders.get(SESSION_KIND_HEADER)
    )
  ) {
    return <DashboardClient latestReport={null} reportsAvailable={false} />
  }
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
