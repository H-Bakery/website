import React from 'react'
import PreorderListClient from './PreorderListClient'
import { filtersFromQuery } from '../../../lib/preordersTypes'

/**
 * P3 - Vorbestellungen: Liste mit Suche und Filtern. Server-Hülle, Daten
 * kommen über `/api/preorders`.
 */
export default async function PreordersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <PreorderListClient initialFilters={filtersFromQuery(await searchParams)} />
  )
}
