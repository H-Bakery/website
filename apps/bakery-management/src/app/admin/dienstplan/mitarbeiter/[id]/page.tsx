import React from 'react'
import { notFound } from 'next/navigation'
import MitarbeiterProfilClient from './MitarbeiterProfilClient'

export const metadata = {
  title: 'Mitarbeiter - Bäckerei Heusser',
}

/** Dienstplan: Profil eines Mitarbeiters mit Urlaubskonto (TASK-042). */
export default async function MitarbeiterProfilPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^\d{1,9}$/.test(id)) notFound()
  return <MitarbeiterProfilClient id={Number(id)} />
}
