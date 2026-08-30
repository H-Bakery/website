import PartnerOverviewClient from './PartnerOverviewClient'

/**
 * Übersicht aller Verkaufspartner (aktuell: CAP-Markt Homburg-Kirrberg).
 *
 * Reine Server-Hülle - die Daten kommen über die API, nicht aus dem Dateisystem,
 * deshalb braucht der Client keine Props.
 */
export default function AdminPartnersPage() {
  return <PartnerOverviewClient />
}
