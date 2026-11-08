import React from 'react'
import { notFound } from 'next/navigation'
import { MoersbachPreorderDetailClient } from '../MoersbachPreorderClients'

/**
 * Eine Vorbestellung der Sammelstelle: ansehen, bearbeiten, Status,
 * stornieren - seit P2 die Ansicht aus P3 auf `/api/preorders`.
 */
export default async function EditPreorderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^\d{1,9}$/.test(id)) notFound()

  return <MoersbachPreorderDetailClient id={Number(id)} />
}
