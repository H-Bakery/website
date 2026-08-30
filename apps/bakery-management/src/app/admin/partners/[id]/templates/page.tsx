import React from 'react'
import {
  getPartnerCatalogue,
  groupCatalogue,
} from '../../../../../lib/partners'
import TemplatesClient from './TemplatesClient'

/**
 * Standard-Bestückung je Wochentag pflegen.
 *
 * Server-Komponente: der HQ-Katalog wird hier vom Dateisystem gelesen und als
 * Props an die Client-Komponente gereicht (gleiches Muster wie
 * `admin/products/page.tsx`) - `getPartnerCatalogue()` darf niemals in einer
 * 'use client'-Datei landen.
 */
export default async function PartnerTemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const catalogue = getPartnerCatalogue()
  const groups = groupCatalogue(catalogue)

  return (
    <TemplatesClient partnerId={id} catalogue={catalogue} groups={groups} />
  )
}
