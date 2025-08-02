/**
 * Order and order item type definitions
 */
import { BaseEntity } from './common'
import { Product } from './product'
export declare enum OrderStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  InProgress = 'in_progress',
  Ready = 'ready',
  Completed = 'completed',
  Cancelled = 'cancelled',
}
export declare enum PaymentStatus {
  Pending = 'pending',
  Paid = 'paid',
  Failed = 'failed',
  Refunded = 'refunded',
}
export declare enum PaymentMethod {
  Cash = 'cash',
  Card = 'card',
  BankTransfer = 'bank_transfer',
  PayPal = 'paypal',
}
export interface OrderItem extends BaseEntity {
  orderId: number
  productId: number
  product?: Product
  quantity: number
  unitPrice: number
  totalPrice: number
  notes?: string
}
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
export type UpdateOrderInput = Partial<CreateOrderInput> & {
  id: number
}
export type UpdateOrderItemInput = Partial<CreateOrderItemInput> & {
  id: number
}
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
export declare function isOrderStatus(status: string): status is OrderStatus
export declare function isPaymentStatus(status: string): status is PaymentStatus
export declare function isPaymentMethod(method: string): method is PaymentMethod
