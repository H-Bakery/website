'use client'

import React, { Suspense } from 'react'
import { CatalogPage } from '@bakery/shop/feature-catalog'
import { PageLoading } from '../../components/page-loading'

/**
 * Produktkatalog. Der Suspense-Rahmen ist Pflicht: die Katalogseite liest
 * `q`, `category` und `sort` aus der URL, und ohne Boundary bricht das
 * Prerendering ab.
 *
 * Die Route bleibt bewusst eine Clientkomponente. Ein Serverwrapper mit
 * eigenem `metadata` (Titel „Alle Produkte") wäre für die Suchmaschine besser,
 * erzeugt hier aber einen Hydration-Fehler: die von React vergebenen `id`s der
 * Formularfelder weichen dann zwischen Server- und Client-Baum ab. Erst das
 * lösen, dann den Titel setzen.
 */
export default function ProductsPage() {
  return (
    <Suspense fallback={<PageLoading label="Produkte werden geladen …" />}>
      <CatalogPage />
    </Suspense>
  )
}
