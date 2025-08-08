/**
 * @fileoverview Unsold product types for tracking waste and inventory loss
 * @module @bakery/shared/types
 */

import { Product } from './product';
import { User } from './user';

/**
 * Represents an unsold product entry
 */
export interface UnsoldProduct {
  id: string | number;
  productId: number;
  quantity: number;
  date: string;
  reason?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  Product?: {
    id: number;
    name: string;
    category: string;
    price?: number;
  };
  User?: {
    id: number;
    username: string;
    name?: string;
  };
}

/**
 * Summary of unsold products by product
 */
export interface UnsoldProductSummary {
  productId: number;
  totalUnsold: number;
  averageDaily?: number;
  Product: {
    id: number;
    name: string;
    category: string;
    price?: number;
  };
}

/**
 * Input for creating an unsold product entry
 */
export interface CreateUnsoldProductInput {
  productId: number;
  quantity: number;
  date?: string;
  reason?: string;
  notes?: string;
}

/**
 * Input for updating an unsold product entry
 */
export interface UpdateUnsoldProductInput {
  quantity?: number;
  date?: string;
  reason?: string;
  notes?: string;
}

/**
 * Filters for querying unsold products
 */
export interface UnsoldProductFilters {
  productId?: number;
  dateFrom?: string;
  dateTo?: string;
  reason?: string;
  minQuantity?: number;
  maxQuantity?: number;
}

/**
 * Daily waste report
 */
export interface DailyWasteReport {
  date: string;
  totalProducts: number;
  totalQuantity: number;
  totalValue?: number;
  products: UnsoldProductSummary[];
}

/**
 * Weekly/Monthly waste analysis
 */
export interface WasteAnalysis {
  period: {
    from: string;
    to: string;
  };
  totalWaste: number;
  totalValue?: number;
  averageDailyWaste: number;
  topWastedProducts: UnsoldProductSummary[];
  wasteByCategory: Record<string, number>;
  wasteByReason?: Record<string, number>;
  trend?: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Unsold product reasons
 */
export enum UnsoldReason {
  EXPIRED = 'expired',
  DAMAGED = 'damaged',
  QUALITY = 'quality',
  OVERPRODUCTION = 'overproduction',
  CUSTOMER_RETURN = 'customer_return',
  OTHER = 'other'
}