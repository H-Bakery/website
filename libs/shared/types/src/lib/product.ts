/**
 * Product-related type definitions for the bakery system
 */

import { BaseEntity, Status } from './common'

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

// Product filters for searching/filtering
export interface ProductFilters {
  categories?: ProductCategory[]
  types?: ProductType[]
  status?: ProductStatus[]
  priceRange?: {
    min: number
    max: number
  }
  inStock?: boolean
  isVegan?: boolean
  isGlutenFree?: boolean
  search?: string
}

// Product creation/update types
export type CreateProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateProductInput = Partial<CreateProductInput> & { id: number }

// Type guards
export function isProductCategory(
  category: string
): category is ProductCategory {
  return Object.values(ProductCategory).includes(category as ProductCategory)
}

export function isProductType(type: string): type is ProductType {
  return Object.values(ProductType).includes(type as ProductType)
}

export function isProductStatus(status: string): status is ProductStatus {
  return Object.values(ProductStatus).includes(status as ProductStatus)
}
