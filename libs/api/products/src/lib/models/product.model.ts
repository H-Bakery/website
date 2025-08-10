/**
 * Product model
 */

export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product extends BaseEntity {
  name: string;
  price: number;
  stock: number;
  dailyTarget: number;
  description?: string;
  isActive: boolean;
  image?: string;
  category?: string;
}

export interface CreateProductInput {
  name: string;
  price: number;
  stock?: number;
  dailyTarget?: number;
  description?: string;
  image?: string;
  category?: string;
}

export interface UpdateProductInput {
  name?: string;
  price?: number;
  stock?: number;
  dailyTarget?: number;
  description?: string;
  isActive?: boolean;
  image?: string;
  category?: string;
}

export interface ProductFilter {
  category?: string;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

export interface StockAdjustment {
  productId: number;
  quantity: number;
  type: 'add' | 'subtract' | 'set';
  reason?: string;
}

export interface ProductWithStats extends Product {
  totalSold?: number;
  totalRevenue?: number;
  averageDailySales?: number;
}