import React from 'react'
import { isBusinessDate } from '../preorderTypes'
import { MoersbachNewPreorderClient } from '../MoersbachPreorderClients'

/**
 * Neue Vorbestellung für die Sammelstelle erfassen - seit P2 mit der
 * allgemeinen Maske (Sorten, Ziffernblock) auf `/api/preorders`.
 *
 * Query-Parameter:
 *   `?date=YYYY-MM-DD`   - Liefertag
 *   `?pickupPointId=...` - Sammelstelle (Vorgabe: die erste aktive)
 */
export default async function NewPreorderPage({
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
    <MoersbachNewPreorderClient
      initialDate={isBusinessDate(date) ? date : undefined}
      initialPickupPointId={
        pickupPointId && /^[a-z0-9-]{1,64}$/.test(pickupPointId)
          ? pickupPointId
          : undefined
      }
    />
  )
}
