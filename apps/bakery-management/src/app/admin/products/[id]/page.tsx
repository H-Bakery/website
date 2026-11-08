import React from 'react'
import ProductEditLoader from './ProductEditLoader'

/**
 * Produkt bearbeiten. Seit F4 dynamisch: das Produkt kommt zur Laufzeit aus
 * `GET /api/hq-products/:id`, nicht mehr aus `generateStaticParams` beim
 * Build - sonst hätte ein in der App neu angelegtes Produkt bis zum nächsten
 * Deploy keine Seite.
 */
export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: productId } = await params
  return <ProductEditLoader productId={productId} />
}
