import React from 'react'
import { notFound } from 'next/navigation'
import PreorderFormClient from '../PreorderFormClient'

/**
 * Bestehende Vorbestellung bearbeiten. Dieselbe Maske wie beim Erfassen -
 * sie lädt die Bestellung anhand der ID nach.
 */
export default async function EditPreorderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const preorderId = Number.parseInt(id, 10)
  if (!Number.isFinite(preorderId)) notFound()

  return <PreorderFormClient preorderId={preorderId} />
}
