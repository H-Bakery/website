import React from 'react'
import PartnerDetailClient from './PartnerDetailClient'

/**
 * Partner-Detail: Tagesstatus, Besuchs-Timeline und Kennzahlen.
 *
 * Server-Komponente ohne Datenzugriff - alle Zahlen kommen zur Laufzeit aus
 * `/api/partners/:id/...`, weil sie sich mehrmals täglich ändern. Der
 * Produktkatalog aus `hq/` wird hier nicht gebraucht (nur in der
 * Erfassungsmaske), deshalb bleibt die Seite frei von Dateisystem-Zugriffen.
 */
export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PartnerDetailClient partnerId={id} />
}
