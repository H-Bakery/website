import React from 'react'
import { notFound } from 'next/navigation'
import ReceiptDetailClient from './ReceiptDetailClient'

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const number = Number(id)
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(number) || number < 1)
    notFound()
  return <ReceiptDetailClient id={number} />
}
