import React from 'react'
import { isBusinessDate } from '../preorderTypes'
import BackingListClient from './BackingListClient'

/**
 * Backliste eines Liefertags: Menge je Produkt über alle Vorbestellungen.
 * Das Blatt für die Backstube - druckfreundlich.
 *
 * Query-Parameter:
 *   `?date=YYYY-MM-DD`   - Liefertag
 *   `?pickupPointId=...` - Sammelstelle
 */
export default async function BackingListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const first = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value

  const date = first(query['date'])
  const pickupPointId = first(query['pickupPointId'])

  return (
    <BackingListClient
      initialDate={isBusinessDate(date) ? date : undefined}
      initialPickupPointId={pickupPointId || undefined}
    />
  )
}
