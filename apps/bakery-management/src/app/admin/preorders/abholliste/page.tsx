import React from 'react'
import { abhollisteParamsFromQuery } from '../../../../lib/abholliste'
import AbholListeClient from './AbholListeClient'

/**
 * P2 - Abholliste eines Tages und Abholorts: abhaken bei der Übergabe,
 * bezahlt, „nicht abgeholt“, A4-Druck.
 *
 * Query-Parameter:
 *   `?date=YYYY-MM-DD` - Abholtag (Vorgabe: heute bzw. nächster Liefertag)
 *   `?point=laden|<id>` - Laden oder eine Sammelstelle (Vorgabe: Laden,
 *                         für Fahrer die Sammelstelle)
 *   `?q=…`              - Suche (Name, Code, Telefon); bleibt beim Rückweg
 *                         aus einer Bestellung erhalten
 */
export default async function AbholListePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { date, place, q } = abhollisteParamsFromQuery(await searchParams)
  return (
    <AbholListeClient
      initialDate={date}
      initialPlace={place}
      initialQuery={q}
    />
  )
}
