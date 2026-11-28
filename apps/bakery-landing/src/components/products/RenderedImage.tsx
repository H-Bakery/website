import type { CSSProperties } from 'react'
import type { RenderedProductImage } from '../../types/product'

interface RenderedImageProps {
  image: RenderedProductImage
  /** The product name - the image shows the product and nothing else. */
  alt: string
  /** How wide the image is shown, as for `<img sizes>`. */
  sizes: string
  /** Above the fold (the product page's main image): load at once. */
  priority?: boolean
  /** Shown size, if not "fill the frame". */
  style?: CSSProperties
}

/**
 * A product image rendered from the 3D model: a square, transparent WebP in
 * two widths. Plain `<img>` with `srcset` - `next/image` runs unoptimised in
 * the static export and would always ship the large file; MUI's `Box` would
 * turn `width`/`height` into CSS. The two attributes are the intrinsic size,
 * so the browser knows the proportions before the file arrives; the frame
 * around the image sets the shown size. The image is fitted into its frame
 * (`contain`) and never cropped, and it has no background of its own: the
 * frame's surface shows through.
 */
export default function RenderedImage({
  image,
  alt,
  sizes,
  priority = false,
  style,
}: RenderedImageProps) {
  return (
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      data-rendered-image=""
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        ...style,
      }}
    />
  )
}
