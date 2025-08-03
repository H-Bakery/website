/**
 * Product type definitions for the bakery landing page
 */

export interface Product {
  id: number | string
  name: string
  category: string
  price: number
  image?: string
  description?: string
  cost?: number
  stock?: number
  dailyTarget?: number
  isActive?: boolean
}