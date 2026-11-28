import React from 'react'
import { notFound } from 'next/navigation'
import InvoiceDetailClient from './InvoiceDetailClient'

/** Eine Rechnung: Entwurf bearbeiten und ausstellen, ausgestellte ansehen. */
export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^\d{1,9}$/.test(id)) notFound()
  return <InvoiceDetailClient id={Number(id)} />
}
