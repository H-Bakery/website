/**
 * Local Product type definitions for the landing page
 * (Copied from shared types to make landing page self-contained)
 */

// Product categories
export enum ProductCategory {
  Bread = 'Brot',
  Buns = 'Brötchen',
  Pastries = 'Teilchen',
  Cakes = 'Kuchen',
  SpecialCakes = 'Torten',
  Snacks = 'Snacks',
  Beverages = 'Getränke',
}

// Product types for better categorization
export enum ProductType {
  Fresh = 'fresh',
  Frozen = 'frozen',
  Packaged = 'packaged',
  Seasonal = 'seasonal',
}

// Product status
export enum ProductStatus {
  Available = 'available',
  OutOfStock = 'out_of_stock',
  Discontinued = 'discontinued',
  Seasonal = 'seasonal',
}

// Base entity interface
interface BaseEntity {
  id: number
  createdAt: string
  updatedAt: string
}

// Nutritional information
export interface NutritionalInfo {
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  fiber?: number
  sugar?: number
  salt?: number
}

// Core Product interface
export interface Product extends BaseEntity {
  name: string
  description?: string
  category: ProductCategory
  type: ProductType
  price: number
  unit?: string
  stock: number
  minStock?: number
  maxStock?: number
  status: ProductStatus
  imageUrl?: string
  ingredients?: string[]
  allergens?: string[]
  nutritionalInfo?: NutritionalInfo
  isVegan?: boolean
  isGlutenFree?: boolean
  weight?: number
  barcode?: string
}
