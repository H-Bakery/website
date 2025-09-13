/**
 * @fileoverview Mock order data
 * @module @bakery/shared/data-mocks/orders
 */

import {
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  OrderItem,
} from '@bakery/shared/types'
import { ALL_PRODUCTS } from '../products'
import { MOCK_CUSTOMERS } from '../users/customers'

// Helper to generate order items
const generateOrderItems = (productCount: number = 3) => {
  const availableProducts = ALL_PRODUCTS.filter(
    (p) => p.isActive && p.stock > 0
  )
  const selectedProducts = availableProducts
    .sort(() => 0.5 - Math.random())
    .slice(0, productCount)

  const qty = Math.floor(Math.random() * 3) + 1
  return selectedProducts.map(
    (product, index) =>
      ({
        id: index + 1,
        orderId: 0, // Will be set when order is created
        productId: product.id,
        quantity: qty,
        unitPrice: product.price,
        totalPrice: product.price * qty,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as OrderItem)
  )
}

// Helper to create order item
const createOrderItem = (
  orderId: number,
  itemId: number,
  productId: number,
  quantity: number,
  unitPrice: number,
  createdAt: string
): OrderItem => ({
  id: itemId,
  orderId,
  productId,
  quantity,
  unitPrice,
  totalPrice: unitPrice * quantity,
  createdAt,
  updatedAt: createdAt,
})

// Generate realistic orders
export const MOCK_ORDERS: Order[] = [
  {
    id: 1001,
    orderNumber: 'ORD-2024-001001',
    customerId: 1,
    customerName: 'Peter Klein',
    customerEmail: 'kunde@example.com',
    status: OrderStatus.Completed,
    items: [
      createOrderItem(1001, 1, 1, 2, 2.5, '2024-01-18T08:30:00'),
      createOrderItem(1001, 2, 8, 6, 0.45, '2024-01-18T08:30:00'),
      createOrderItem(1001, 3, 16, 1, 2.8, '2024-01-18T08:30:00'),
    ],
    subtotal: 10.5,
    tax: 0.74,
    total: 11.24,
    paymentMethod: PaymentMethod.Cash,
    paymentStatus: PaymentStatus.Paid,
    isPickup: true,
    deliveryAddress: undefined,
    deliveryTime: undefined,
    notes: 'Abholung erfolgt',
    createdAt: '2024-01-18T08:30:00',
    updatedAt: '2024-01-18T09:15:00',
    completedAt: '2024-01-18T09:15:00',
  },
  {
    id: 1002,
    orderNumber: 'ORD-2024-001002',
    customerId: 2,
    customerName: 'Café Sonnenschein',
    customerEmail: 'info@cafe-sonnenschein.de',
    status: OrderStatus.InProgress,
    items: [
      createOrderItem(1002, 4, 8, 30, 0.45, '2024-01-19T18:00:00'),
      createOrderItem(1002, 5, 9, 20, 0.75, '2024-01-19T18:00:00'),
      createOrderItem(1002, 6, 14, 15, 1.5, '2024-01-19T18:00:00'),
      createOrderItem(1002, 7, 16, 10, 2.8, '2024-01-19T18:00:00'),
      createOrderItem(1002, 8, 17, 5, 3.2, '2024-01-19T18:00:00'),
    ],
    subtotal: 95.0,
    tax: 6.65,
    total: 101.65,
    paymentMethod: PaymentMethod.BankTransfer,
    paymentStatus: PaymentStatus.Pending,
    isPickup: false,
    deliveryAddress: 'Hauptstraße 15, 10115 Berlin',
    deliveryTime: '2024-01-20T06:30:00',
    notes: 'Bitte vor 6:30 Uhr liefern. Hintereingang benutzen.',
    createdAt: '2024-01-19T18:00:00',
    updatedAt: '2024-01-19T18:00:00',
  },
  {
    id: 1003,
    orderNumber: 'ORD-2024-001003',
    customerId: 3,
    customerName: 'Hotel am Park',
    customerEmail: 'bestellung@hotel-am-park.de',
    status: OrderStatus.Pending,
    items: [
      createOrderItem(1003, 9, 1, 10, 2.5, '2024-01-20T15:00:00'),
      createOrderItem(1003, 10, 2, 10, 3.8, '2024-01-20T15:00:00'),
      createOrderItem(1003, 11, 8, 50, 0.45, '2024-01-20T15:00:00'),
      createOrderItem(1003, 12, 9, 30, 0.75, '2024-01-20T15:00:00'),
      createOrderItem(1003, 13, 14, 20, 1.5, '2024-01-20T15:00:00'),
    ],
    subtotal: 138.0,
    tax: 9.66,
    total: 147.66,
    paymentMethod: PaymentMethod.BankTransfer,
    paymentStatus: PaymentStatus.Pending,
    isPickup: false,
    deliveryAddress: 'Parkstraße 10, 10115 Berlin',
    deliveryTime: '2024-01-21T05:00:00',
    notes: 'Tägliche Lieferung für Frühstücksbuffet',
    createdAt: '2024-01-20T15:00:00',
    updatedAt: '2024-01-20T15:00:00',
  },
  {
    id: 1004,
    orderNumber: 'ORD-2024-001004',
    customerId: 4,
    customerName: 'Anna Schmidt',
    customerEmail: 'anna.schmidt@example.com',
    status: OrderStatus.Cancelled,
    items: [
      createOrderItem(1004, 14, 16, 1, 2.8, '2024-01-17T14:00:00'),
      createOrderItem(1004, 15, 18, 1, 3.5, '2024-01-17T14:00:00'),
      createOrderItem(1004, 16, 12, 4, 0.65, '2024-01-17T14:00:00'),
    ],
    subtotal: 8.9,
    tax: 0.62,
    total: 9.52,
    paymentMethod: PaymentMethod.PayPal,
    paymentStatus: PaymentStatus.Refunded,
    isPickup: false,
    deliveryAddress: 'Musterstraße 5, 10115 Berlin',
    deliveryTime: '2024-01-17T18:00:00',
    notes: 'Kunde hat storniert - Doppelbestellung',
    createdAt: '2024-01-17T14:00:00',
    updatedAt: '2024-01-17T14:30:00',
  },
]

// Export additional mock data
export const RECENT_ORDERS = MOCK_ORDERS.filter((order) => {
  const orderDate = new Date(order.createdAt)
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - 7)
  return orderDate >= daysAgo
})

export const PENDING_ORDERS = MOCK_ORDERS.filter(
  (order) => order.status === OrderStatus.Pending
)

export const COMPLETED_ORDERS = MOCK_ORDERS.filter(
  (order) => order.status === OrderStatus.Completed
)

// Generate dynamic order based on customer
export const generateOrder = (customerId: number): Order => {
  const customer = MOCK_CUSTOMERS.find((c) => c.id === customerId)
  if (!customer) throw new Error('Customer not found')

  const orderId = Math.floor(Math.random() * 10000) + 2000
  const items = generateOrderItems(Math.floor(Math.random() * 5) + 1)
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
  const tax = subtotal * 0.07
  const total = subtotal + tax

  return {
    id: orderId,
    orderNumber: `ORD-2024-${String(orderId).padStart(6, '0')}`,
    customerId: customer.id,
    customerName: `${(customer as any).firstName} ${
      (customer as any).lastName
    }`,
    customerEmail: customer.email,
    status: OrderStatus.Pending,
    items: items.map((item, index) => ({
      ...item,
      id: index + 1,
      orderId,
    })),
    subtotal,
    tax,
    total,
    paymentMethod: PaymentMethod.Cash,
    paymentStatus: PaymentStatus.Pending,
    isPickup: Math.random() > 0.5,
    deliveryAddress: Math.random() > 0.5 ? 'Sample Address 123' : undefined,
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// Export all orders for compatibility
export const ALL_ORDERS = MOCK_ORDERS
