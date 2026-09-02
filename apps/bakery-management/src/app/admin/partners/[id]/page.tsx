import React from 'react'
import PartnerDetailClient from './PartnerDetailClient'

/**
 * Partner-Detail: Tagesstatus, Besuchs-Timeline und Kennzahlen.
 *
 * Server-Komponente ohne Datenzugriff - alle Zahlen kommen zur Laufzeit aus
 * `/api/partners/:id/...`, weil sie sich mehrmals täglich ändern. Der
 * Produktkatalog aus `hq/` wird hier nicht gebraucht (nur in der
 * Erfassungsmaske), deshalb bleibt die Seite frei von Dateisystem-Zugriffen.
 *
 * Query-Parameter:
 *   `?date=YYYY-MM-DD` - Geschäftstag statt heute; die Erfassungsmaske führt
 *                        nach dem Speichern hierher zurück, damit ein
 *                        nacherfasster Tag auch angezeigt wird
 *   `?saved=1`         - ein Besuch wurde gerade gespeichert; die Seite
 *                        bestätigt das und nimmt den Parameter wieder aus der URL
 */
export default async function PartnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const query = await searchParams

  const first = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value

  const dateParam = first(query['date'])
  const initialDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined
  const justSaved = first(query['saved']) === '1'

  return (
    <PartnerDetailClient
      partnerId={id}
      initialDate={initialDate}
      justSaved={justSaved}
    />
  )
}
