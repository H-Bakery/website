import React from 'react'
import { notFound } from 'next/navigation'
import { abhollisteBackFromQuery } from '../../../../lib/abholliste'
import PreorderDetailClient from './PreorderDetailClient'

/**
 * P3 - eine Vorbestellung: ansehen, ändern, Status, stornieren.
 *
 * Aus der Abholliste geöffnet (`?von=abholliste&date=…&point=…&q=…`) führt
 * „Zurück zur Abholliste“ auf denselben Tag, Ort und dieselbe Suche; ohne
 * oder mit ungültiger Herkunft auf alle Vorbestellungen.
 */
export default async function PreorderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  if (!/^\d{1,9}$/.test(id)) notFound()
  const back = abhollisteBackFromQuery(await searchParams)
  return (
    <PreorderDetailClient
      id={Number(id)}
      backTo={back?.href}
      backLabel={back?.label}
    />
  )
}
