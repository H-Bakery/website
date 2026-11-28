import React from 'react'
import { priceListOptionsFromQuery } from '../../../../lib/priceListApi'
import PriceListClient from './PriceListClient'

/**
 * Preisliste: Vorschau und Druck (A4). Reine Server-Hülle - die Optionen
 * stehen in der Adresse (aus dem Dialog der Produktseite), die Liste selbst
 * holt der Client über `GET /api/price-list`.
 *
 * Query: `audience=partner&partnerId=1`, `categories=brot,kuchen`,
 * `validFrom=YYYY-MM-DD`, `includeUnavailable=1`, `allergens=1`.
 */
export default async function PriceListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const options = priceListOptionsFromQuery(await searchParams)
  // `key`: andere Optionen = neue Liste, kein Zustand der alten.
  return <PriceListClient key={JSON.stringify(options)} options={options} />
}
