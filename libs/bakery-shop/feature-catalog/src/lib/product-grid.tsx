'use client'

/**
 * @fileoverview Das Raster der Theke – dicht, zwei Spalten am Handy.
 *
 * Karte und Skelett laufen durch dasselbe Raster und teilen sich in
 * `product-card.tsx` alle Maße. Deshalb ist der Wechsel von „lädt" zu „da"
 * ein Farbwechsel, kein Sprung.
 */

import * as React from 'react'
import Box from '@mui/material/Box'

import { ShopProductCard, ShopProductCardSkeleton } from './product-card'
import type { ShopProduct } from '@bakery/shared/data-access'

/** Spaltenraster für Karten und Skelette – überall identisch. */
export const productGridSx = {
  display: 'grid',
  gap: { xs: 1.5, sm: 2 },
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(3, minmax(0, 1fr))',
    md: 'repeat(4, minmax(0, 1fr))',
  },
}

export interface ProductGridProps {
  products: ShopProduct[]
  testId?: string
  imageRatio?: string
  /**
   * Wie viele Bilder am Anfang sofort geladen werden dürfen. Standard 0 –
   * nur ein Raster, das wirklich über der Falz steht, sollte das hochsetzen.
   */
  eagerCount?: number
}

export function ProductGrid({
  products,
  testId,
  imageRatio,
  eagerCount = 0,
}: ProductGridProps) {
  return (
    <Box data-testid={testId} sx={productGridSx}>
      {products.map((product, index) => (
        <ShopProductCard
          key={product.id}
          product={product}
          imageRatio={imageRatio}
          eagerImage={index < eagerCount}
        />
      ))}
    </Box>
  )
}

export function ProductGridSkeleton({
  count = 8,
  imageRatio,
}: {
  count?: number
  imageRatio?: string
}) {
  return (
    <Box aria-hidden="true" sx={productGridSx}>
      {Array.from({ length: count }, (_, index) => (
        <ShopProductCardSkeleton key={index} imageRatio={imageRatio} />
      ))}
    </Box>
  )
}
