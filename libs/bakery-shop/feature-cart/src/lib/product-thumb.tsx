'use client'

/**
 * @fileoverview Small product thumbnail used in cart lines and order summaries.
 * @module @bakery/shop/feature-cart/product-thumb
 */

import React from 'react'
import Box from '@mui/material/Box'

export interface ProductThumbProps {
  /** Public image path, e.g. `/assets/images/products/kornbrot.svg`. */
  src?: string | null
  /** Product name — used as the alt text. */
  alt: string
  /** Edge length in px. */
  size?: number
}

/**
 * A plain `<img>` on a warm tile, not `next/image`: the product art is a mix of
 * SVG and JPG served straight from `public/`, and the SVGs do not survive the
 * Next image optimiser without `dangerouslyAllowSVG`. There is nothing to
 * optimise at 72 px anyway.
 *
 * Falls back to a decorative glyph when a product has no image on file.
 */
export const ProductThumb: React.FC<ProductThumbProps> = ({
  src,
  alt,
  size = 72,
}) => {
  const [failed, setFailed] = React.useState(false)
  const hasImage = typeof src === 'string' && src.trim().length > 0 && !failed

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 1.5,
        bgcolor: 'grey.100',
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        fontSize: size * 0.45,
        lineHeight: 1,
      }}
    >
      {hasImage ? (
        <Box
          component="img"
          src={src as string}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            p: 0.75,
          }}
        />
      ) : (
        <Box component="span" aria-hidden="true">
          🥐
        </Box>
      )}
    </Box>
  )
}

export default ProductThumb
