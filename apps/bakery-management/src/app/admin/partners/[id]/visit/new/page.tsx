import React from 'react'
import {
  getPartnerCatalogue,
  groupCatalogue,
} from '../../../../../../lib/partners'
import { isBusinessDate } from '../../../../../../lib/partnerTypes'
import VisitFormClient from './VisitFormClient'

/**
 * Erfassungsmaske für einen Besuch am Backschrank.
 *
 * Server-Komponente: der HQ-Produktkatalog wird hier vom Dateisystem gelesen
 * (`getPartnerCatalogue()` benutzt `fs`) und fertig gruppiert an die
 * Client-Komponente gereicht - dasselbe Muster wie `admin/products/page.tsx`.
 * So kommt die Maske am Handy ohne zusätzlichen Produkt-Request aus.
 *
 * Query-Parameter:
 *   `?date=YYYY-MM-DD` - Geschäftstag (Nacherfassung im Büro)
 *   `?visit=<id>`      - vorhandenen Besuch korrigieren statt neu anlegen
 *                        (`visitId` und `edit` werden ebenfalls akzeptiert)
 */
export default async function PartnerVisitNewPage({
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
  const initialDate = isBusinessDate(dateParam) ? dateParam : undefined

  const visitParam =
    first(query['visit']) ?? first(query['visitId']) ?? first(query['edit'])
  const parsedVisitId = visitParam ? Number.parseInt(visitParam, 10) : NaN
  const visitId = Number.isFinite(parsedVisitId) ? parsedVisitId : undefined

  const groups = groupCatalogue(getPartnerCatalogue())

  return (
    <VisitFormClient
      partnerId={id}
      groups={groups}
      initialDate={initialDate}
      visitId={visitId}
    />
  )
}
