/**
 * Product type for the landing page.
 * Matches the shape produced by loadProducts() from lib/products.ts.
 */
/**
 * A product image rendered from the product's 3D model (data repo
 * `produkte-3d`): transparent WebP in several widths. A digital illustration,
 * not a photo - the product page says so.
 */
export interface RenderedProductImage {
  /** Largest variant, e.g. `/produkte-3d/bilder/<id>/haupt-800.webp` */
  src: string
  /** All variants with width descriptors (`… 400w, … 800w`) */
  srcSet: string
  /** Intrinsic size of `src` */
  width: number
  height: number
}

export interface Product {
  id: number
  name: string
  category: string
  price: number
  image?: string | null
  imageUrl?: string | null
  /** Set only when `image` is a rendered image - see `resolveProductImage`. */
  renderedImage?: RenderedProductImage
  description?: string
  available?: boolean
  seasonal?: boolean
  isVegan?: boolean
  isGlutenFree?: boolean
  unit?: string
}
