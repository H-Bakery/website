import React from 'react'
import { isBusinessDate } from '../../../../lib/preordersTypes'
import PreorderDayClient from './PreorderDayClient'

/**
 * P3 - Tagesübersicht der Vorbestellungen mit Summen je Produkt/Sorte und
 * A4-Druck. `?date=YYYY-MM-DD`, sonst der nächste Produktionstag.
 */
export default async function PreorderDayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const raw = query['date']
  const date = Array.isArray(raw) ? raw[0] : raw
  return (
    <PreorderDayClient initialDate={isBusinessDate(date) ? date : undefined} />
  )
}
