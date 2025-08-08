/**
 * @fileoverview Service-specific types for bakeryAPI
 */

import type { Product, Order, OrderItem, CashEntry } from '@bakery/shared/types'

export interface SalesData {
  id?: number
  date: string
  revenue: number
  unitsSold: number
  avgOrderValue: number
  product?: string
}

export interface ProductionData {
  id?: number
  product: string
  planned: number
  actual: number
  waste: number
  efficiency: number
}

export interface FinancialData {
  id?: number
  period: string
  revenue: number
  costs: number
  profit: number
  margin: number
}

export interface StaffData {
  id: string
  name: string
  role: string
  shift: string
  performance: number
  hoursWorked: number
}

export interface CustomerData {
  id: string
  name: string
  email: string
  totalOrders: number
  totalSpent: number
  lastOrderDate: string
  segment: 'new' | 'regular' | 'vip'
}

export interface InventoryItem {
  id: string
  name: string
  quantity: number
  unit: string
  minQuantity: number
  maxQuantity: number
  supplier: string
  lastRestocked: string
  expiryDate?: string
}

export interface TimeSeriesData {
  timestamp: string
  value: number
  label?: string
}

export type TimeRange = 'today' | 'week' | 'month' | 'quarter' | 'year'

export interface BakingListResponse {
  date: string
  items: Array<{
    product: Product
    quantity: number
    status: 'pending' | 'in_progress' | 'completed'
  }>
  totalItems: number
  completedItems: number
}

export interface SummaryData {
  revenue: {
    current: number
    previous: number
    change: number
  }
  orders: {
    current: number
    previous: number
    change: number
  }
  customers: {
    current: number
    previous: number
    change: number
  }
  averageOrderValue: {
    current: number
    previous: number
    change: number
  }
}

export interface PreferencesResponse {
  success: boolean
  data?: any // Temporary fix - proper type from NotificationPreferences
  error?: string
}

export interface NotificationTemplate {
  id: string
  name: string
  description: string
  subject: string
  body: string
  category: string
  priority: string
  variables: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface TemplateResponse {
  success: boolean
  data?: NotificationTemplate | NotificationTemplate[]
  error?: string
}

// Re-export from shared types for convenience
export type { Product, Order, OrderItem, CashEntry, NotificationPreferences } from '@bakery/shared/types'