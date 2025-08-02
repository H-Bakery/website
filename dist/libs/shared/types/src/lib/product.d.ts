/**
 * Product-related type definitions for the bakery system
 */
import { BaseEntity } from './common'
export declare enum ProductCategory {
  Bread = 'Brot',
  Buns = 'Br\u00F6tchen',
  Pastries = 'Teilchen',
  Cakes = 'Kuchen',
  SpecialCakes = 'Torten',
  Snacks = 'Snacks',
  Beverages = 'Getr\u00E4nke',
}
export declare enum ProductType {
  Fresh = 'fresh',
  Frozen = 'frozen',
  Packaged = 'packaged',
  Seasonal = 'seasonal',
}
export declare enum ProductStatus {
  Available = 'available',
  OutOfStock = 'out_of_stock',
  Discontinued = 'discontinued',
  Seasonal = 'seasonal',
}
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
export interface NutritionalInfo {
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  fiber?: number
  sugar?: number
  salt?: number
}
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
export type CreateProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateProductInput = Partial<CreateProductInput> & {
  id: number
}
export declare function isProductCategory(
  category: string
): category is ProductCategory
export declare function isProductType(type: string): type is ProductType
export declare function isProductStatus(status: string): status is ProductStatus
