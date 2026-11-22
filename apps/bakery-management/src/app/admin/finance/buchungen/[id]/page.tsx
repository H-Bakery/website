import React from 'react'
import BuchungDetailClient from './BuchungDetailClient'

/** Eine Buchung des Geschäftskontos mit weiteren Buchungen derselben Gegenseite. */
export default async function BuchungDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <BuchungDetailClient id={id} />
}
