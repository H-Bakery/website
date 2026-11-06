import React from 'react'
import { isIsoDate } from '../../../lib/restApi'
import RestClient from './RestClient'

export const metadata = {
  title: 'Rest am Abend - Bäckerei Heusser',
}

/**
 * M4 - Rest am Abend: der Verkauf zählt bei Ladenschluss am Laden-Tablet, was
 * übrig ist (Zählliste aus dem freigegebenen Backzettel). Gelesen und
 * gespeichert wird über `/api/rest` (nur mit Sitzung, auch PIN-Station).
 *
 * `?date=YYYY-MM-DD` - Tag (Vorgabe: heute; korrigierbar bis 7 Tage zurück).
 */
export default async function RestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const raw = Array.isArray(query.date) ? query.date[0] : query.date
  return <RestClient initialDate={isIsoDate(raw) ? raw : undefined} />
}
