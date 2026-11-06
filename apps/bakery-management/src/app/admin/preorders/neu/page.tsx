import React from 'react'
import { isBusinessDate } from '../../../../lib/preordersTypes'
import PreorderEntryClient from './PreorderEntryClient'

/**
 * P1 - Vorbestellung erfassen. Server-Hülle: Daten kommen über die API.
 *
 * Query-Parameter:
 *   `?date=YYYY-MM-DD`     - vorbelegter Abholtag
 *   `?pickupPointId=<id>`  - vorbelegte Sammelstelle
 */
export default async function NewPreorderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const first = (key: string) => {
    const raw = query[key]
    return Array.isArray(raw) ? raw[0] : raw
  }
  const date = first('date')
  const pickupPointId = first('pickupPointId')
  return (
    <PreorderEntryClient
      initialDate={isBusinessDate(date) ? date : undefined}
      initialPickupPointId={
        pickupPointId && /^[a-z0-9-]{1,64}$/.test(pickupPointId)
          ? pickupPointId
          : undefined
      }
    />
  )
}
