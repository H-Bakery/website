/**
 * Product type for the landing page.
 * Matches the shape produced by loadProducts() from lib/products.ts.
 */
export interface Product {
  id: number
  name: string
  category: string
  price: number
  image?: string | null
  imageUrl?: string | null
  description?: string
  available?: boolean
  seasonal?: boolean
  isVegan?: boolean
  isGlutenFree?: boolean
  unit?: string
}
