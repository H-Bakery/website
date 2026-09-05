import React from 'react'
import { isBusinessDate } from './preorderTypes'
import PreorderListClient from './PreorderListClient'

/**
 * Vorbestellungen eines Liefertags an der Sammelstelle.
 *
 * Reine Server-Hülle: die Daten kommen über die Liefer-API, nicht aus dem
 * Dateisystem - dasselbe Muster wie `admin/partners/page.tsx`. Die
 * Query-Parameter werden hier gelesen, damit die Client-Komponente ohne
 * `useSearchParams()` und die dazugehörige Suspense-Grenze auskommt.
 *
 * Query-Parameter:
 *   `?date=YYYY-MM-DD` - Liefertag (Vorgabe: nächster Liefertag der Stelle)
 *   `?saved=1`         - Bestätigung nach dem Speichern
 */
export default async function PreordersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const raw = query['date']
  const date = Array.isArray(raw) ? raw[0] : raw
  const saved =
    (Array.isArray(query['saved']) ? query['saved'][0] : query['saved']) === '1'

  return (
    <PreorderListClient
      initialDate={isBusinessDate(date) ? date : undefined}
      saved={saved}
    />
  )
}
