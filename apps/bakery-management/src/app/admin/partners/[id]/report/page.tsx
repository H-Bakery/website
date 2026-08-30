import React from 'react'
import ReportClient from './ReportClient'

/**
 * Partner-Report mit Zeitraumwahl, Export und Druckansicht.
 *
 * Server-Komponente ohne Datenzugriff: alle Zahlen kommen zur Laufzeit aus
 * `/api/partners/:id/stats`, damit der gewählte Zeitraum frei änderbar bleibt.
 * Der HQ-Katalog wird hier nicht gebraucht - die Produktnamen und Preise
 * stecken als Snapshot in den Besuchsdaten.
 */
export default async function PartnerReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ReportClient partnerId={id} />
}
