import ProductsPageClient from './ProductsPageClient'

/**
 * Produktliste. Die Daten lädt der Client zur Laufzeit über
 * `GET /api/hq-products` (F4); die Server-Komponente trägt keine Produktdaten.
 */
export default function AdminProductsPage() {
  return <ProductsPageClient />
}
