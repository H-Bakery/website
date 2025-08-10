/**
 * @fileoverview Central export for all product mock data
 * @module @bakery/shared/data-mocks/products
 */

import { Product } from '@bakery/shared/types'
import { BREAD_PRODUCTS } from './breads'
import { BUN_PRODUCTS } from './buns'
import { CAKE_PRODUCTS } from './cakes'
import { SNACK_PRODUCTS } from './snacks'

// Combine all products
export const ALL_PRODUCTS: Product[] = [
  ...BREAD_PRODUCTS,
  ...BUN_PRODUCTS,
  ...CAKE_PRODUCTS,
  ...SNACK_PRODUCTS,
]

// Export individual categories
export { BREAD_PRODUCTS } from './breads'
export { BUN_PRODUCTS } from './buns'
export { CAKE_PRODUCTS } from './cakes'
export { SNACK_PRODUCTS } from './snacks'

// Product utilities
export const getProductById = (id: number): Product | undefined => {
  return ALL_PRODUCTS.find((product) => product.id === id)
}

export const getProductsByCategory = (category: string): Product[] => {
  return ALL_PRODUCTS.filter((product) => product.category === category)
}

export const getProductsByType = (type: string): Product[] => {
  return ALL_PRODUCTS.filter((product) => product.type === type)
}

export const getActiveProducts = (): Product[] => {
  return ALL_PRODUCTS.filter((product) => product.isActive)
}

export const getProductsInStock = (): Product[] => {
  return ALL_PRODUCTS.filter((product) => product.stock > 0)
}

export const searchProducts = (query: string): Product[] => {
  const lowercaseQuery = query.toLowerCase()
  return ALL_PRODUCTS.filter(
    (product) =>
      product.name.toLowerCase().includes(lowercaseQuery) ||
      product.description.toLowerCase().includes(lowercaseQuery) ||
      product.category.toLowerCase().includes(lowercaseQuery)
  )
}

// Product categories
export const PRODUCT_CATEGORIES = Array.from(
  new Set(ALL_PRODUCTS.map((product) => product.category))
).sort()

// Product types
export const PRODUCT_TYPES = Array.from(
  new Set(ALL_PRODUCTS.map((product) => product.type))
).sort()

// Featured products (for homepage)
export const FEATURED_PRODUCTS = ALL_PRODUCTS.filter(
  (product) => product.isActive && product.stock > 0
)
  .sort(() => 0.5 - Math.random())
  .slice(0, 6)

// Best sellers (mock based on daily targets)
export const BEST_SELLERS = ALL_PRODUCTS.filter((product) => product.isActive)
  .sort((a, b) => (b.dailyTarget || 0) - (a.dailyTarget || 0))
  .slice(0, 8)

// New products (mock - last 5 products)
export const NEW_PRODUCTS = ALL_PRODUCTS.filter((product) => product.isActive)
  .slice(-5)
  .reverse()

// Seasonal products
export const SEASONAL_PRODUCTS = ALL_PRODUCTS.filter(
  (product) => product.type === 'seasonal'
)
