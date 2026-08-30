/**
 * Produktkatalog für die Verkaufspartner-Erfassung.
 *
 * Server-only (liest über `products.ts` das Dateisystem). Seiten laden den
 * Katalog als Server-Komponente und reichen ihn an die Client-Komponenten
 * weiter - genauso wie `admin/products/page.tsx`.
 */

import { getHQProducts, CATEGORY_LABELS } from './products'
import { CatalogueProduct, categoryRank } from './partnerTypes'

/**
 * Alle lieferbaren HQ-Produkte, sortiert wie sie im Backschrank stehen.
 * Nicht verfügbare Produkte fliegen raus - sie können nicht geliefert werden.
 */
export function getPartnerCatalogue(): CatalogueProduct[] {
  return getHQProducts()
    .filter((p) => p.available)
    .map((p) => ({
      productId: p.numeric_id,
      productSlug: p.id,
      productName: p.name,
      unitPrice: p.price,
      category: p.category,
      categoryLabel: CATEGORY_LABELS[p.category] || p.category,
      available: p.available,
    }))
    .sort(
      (a, b) =>
        categoryRank(a.category) - categoryRank(b.category) ||
        a.productName.localeCompare(b.productName, 'de')
    )
}

/** Katalog gruppiert nach Kategorie, in Backschrank-Reihenfolge. */
export function groupCatalogue(
  catalogue: CatalogueProduct[]
): Array<{ category: string; label: string; products: CatalogueProduct[] }> {
  const groups = new Map<string, CatalogueProduct[]>()
  for (const product of catalogue) {
    if (!groups.has(product.category)) groups.set(product.category, [])
    groups.get(product.category)?.push(product)
  }
  return Array.from(groups.entries())
    .sort((a, b) => categoryRank(a[0]) - categoryRank(b[0]))
    .map(([category, products]) => ({
      category,
      label: CATEGORY_LABELS[category] || category,
      products,
    }))
}
