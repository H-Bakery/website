import React from 'react'
import PickupPointFormClient from './PickupPointFormClient'

/**
 * Stammdaten der Sammelstelle - hier trägt das Team die noch fehlende Adresse
 * des Kindergartens nach.
 *
 * Query-Parameter:
 *   `?pickupPointId=...` - Sammelstelle (Vorgabe: die erste aktive)
 */
export default async function PickupPointPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const raw = query['pickupPointId']
  const pickupPointId = Array.isArray(raw) ? raw[0] : raw

  return (
    <PickupPointFormClient initialPickupPointId={pickupPointId || undefined} />
  )
}
