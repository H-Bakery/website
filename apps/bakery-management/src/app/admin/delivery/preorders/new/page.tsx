import React from 'react'
import { isBusinessDate } from '../preorderTypes'
import PreorderFormClient from '../PreorderFormClient'

/**
 * Neue Vorbestellung erfassen - die Maske, in die das Team die Telefon- und
 * Thekenbestellungen tippt.
 *
 * Query-Parameter:
 *   `?date=YYYY-MM-DD`   - Liefertag
 *   `?pickupPointId=...` - Sammelstelle
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
    <PreorderFormClient
      initialDate={isBusinessDate(date) ? date : undefined}
      initialPickupPointId={pickupPointId || undefined}
    />
  )
}
