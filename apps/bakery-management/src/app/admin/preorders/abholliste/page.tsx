import React from 'react'
import { isBusinessDate } from '../../../../lib/preordersTypes'
import AbholListeClient from './AbholListeClient'

/**
 * P2 - Abholliste eines Tages und Abholorts: abhaken bei der Übergabe,
 * bezahlt, „nicht abgeholt", A4-Druck.
 *
 * Query-Parameter:
 *   `?date=YYYY-MM-DD` - Abholtag (Vorgabe: heute bzw. nächster Liefertag)
 *   `?point=laden|<id>` - Laden oder eine Sammelstelle (Vorgabe: Laden,
 *                         für Fahrer die Sammelstelle)
 */
export default async function AbholListePage({
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
  const point = first('point')
  return (
    <AbholListeClient
      initialDate={isBusinessDate(date) ? date : undefined}
      initialPlace={
        point && /^[a-z0-9-]{1,64}$/.test(point) ? point : undefined
      }
    />
  )
}
