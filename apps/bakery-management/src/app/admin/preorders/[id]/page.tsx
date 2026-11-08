import React from 'react'
import { notFound } from 'next/navigation'
import PreorderDetailClient from './PreorderDetailClient'

/** P3 - eine Vorbestellung: ansehen, ändern, Status, stornieren. */
export default async function PreorderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^\d{1,9}$/.test(id)) notFound()
  return <PreorderDetailClient id={Number(id)} />
}
