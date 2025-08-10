/**
 * Order and order item type definitions
 */

import { BaseEntity } from './common'
import { Product } from './product'

// Order status enum
export enum OrderStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  InProgress = 'in_progress',
  Ready = 'ready',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

// Payment status enum
export enum PaymentStatus {
  Pending = 'pending',
  Paid = 'paid',
  Failed = 'failed',
  Refunded = 'refunded',
}

// Payment method enum
export enum PaymentMethod {
  Cash = 'cash',
  Card = 'card',
  BankTransfer = 'bank_transfer',
  PayPal = 'paypal',
}

// Order item interface
export interface OrderItem extends BaseEntity {
  orderId: number
  productId: number
  product?: Product
  quantity: number
  unitPrice: number
  totalPrice: number
  notes?: string
}

// Main Order interface
export interface Order extends BaseEntity {
  orderNumber: string
  customerId?: number
  customerName: string
  customerEmail?: string
  customerPhone?: string
  items: OrderItem[]
  subtotal: number
  tax: number
  total: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod?: PaymentMethod
  notes?: string
  deliveryDate?: string
  deliveryTime?: string
  deliveryAddress?: string
  isPickup: boolean
  estimatedReady?: string
  completedAt?: string
}

// Order filters
export interface OrderFilters {
  status?: OrderStatus[]
  paymentStatus?: PaymentStatus[]
  dateRange?: {
    startDate: string
    endDate: string
  }
  customerId?: number
  customerName?: string
  orderNumber?: string
  isPickup?: boolean
}

// Order creation types
export interface CreateOrderInput {
  customerName: string
  customerEmail?: string
  customerPhone?: string
  items: CreateOrderItemInput[]
  notes?: string
  deliveryDate?: string
  deliveryTime?: string
  deliveryAddress?: string
  isPickup: boolean
  paymentMethod?: PaymentMethod
}

export interface CreateOrderItemInput {
  productId: number
  quantity: number
  notes?: string
}

// Order update types
export type UpdateOrderInput = Partial<CreateOrderInput> & { id: number }
export type UpdateOrderItemInput = Partial<CreateOrderItemInput> & {
  id: number
}

// Order summary for analytics
export interface OrderSummary {
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
  ordersByStatus: Record<OrderStatus, number>
  ordersByPaymentMethod: Record<PaymentMethod, number>
  topProducts: Array<{
    productId: number
    productName: string
    quantity: number
    revenue: number
  }>
}

// Type guards
export function isOrderStatus(status: string): status is OrderStatus {
  return Object.values(OrderStatus).includes(status as OrderStatus)
}

export function isPaymentStatus(status: string): status is PaymentStatus {
  return Object.values(PaymentStatus).includes(status as PaymentStatus)
}

export function isPaymentMethod(method: string): method is PaymentMethod {
  return Object.values(PaymentMethod).includes(method as PaymentMethod)
}
