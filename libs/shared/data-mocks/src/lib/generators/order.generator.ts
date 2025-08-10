/**
 * @fileoverview Order data generator for testing and development
 * @module @bakery/shared/data-mocks/generators
 */

import {
  Order,
  OrderStatus,
  PaymentMethod,
  DeliveryMethod,
  OrderItem,
} from '@bakery/shared/types'
import { ALL_PRODUCTS } from '../products'
import { MOCK_CUSTOMERS } from '../users/customers'

interface OrderGeneratorOptions {
  customerId?: number
  status?: OrderStatus
  paymentMethod?: PaymentMethod
  deliveryMethod?: DeliveryMethod
  itemCount?: number
  dateRange?: { start: Date; end: Date }
}

/**
 * Generate random order data
 */
export class OrderGenerator {
  private static orderCounter = 5000

  /**
   * Generate a single order
   */
  static generateOrder(options?: OrderGeneratorOptions): Order {
    const orderId = this.orderCounter++
    const customer = options?.customerId
      ? MOCK_CUSTOMERS.find((c) => c.id === options.customerId) ||
        MOCK_CUSTOMERS[0]
      : MOCK_CUSTOMERS[Math.floor(Math.random() * MOCK_CUSTOMERS.length)]

    const status = options?.status || this.randomStatus()
    const paymentMethod = options?.paymentMethod || this.randomPaymentMethod()
    const deliveryMethod =
      options?.deliveryMethod || this.randomDeliveryMethod()

    const items = this.generateOrderItems(
      options?.itemCount || Math.floor(Math.random() * 5) + 1
    )
    const subtotal = items.reduce((sum, item) => sum + item.total, 0)
    const tax = subtotal * 0.07 // 7% German VAT for food
    const discount = customer.type === 'business' ? subtotal * 0.1 : 0
    const total = subtotal + tax - discount

    const createdAt = options?.dateRange
      ? this.randomDate(options.dateRange.start, options.dateRange.end)
      : new Date()

    const order: Order = {
      id: orderId,
      orderNumber: `ORD-${createdAt.getFullYear()}-${String(orderId).padStart(
        6,
        '0'
      )}`,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      status,
      items,
      subtotal,
      tax,
      discount,
      total,
      paymentMethod,
      paymentStatus: this.getPaymentStatus(status, paymentMethod),
      deliveryMethod,
      deliveryAddress: deliveryMethod === 'delivery' ? customer.address : null,
      deliveryTime:
        deliveryMethod === 'delivery'
          ? new Date(createdAt.getTime() + 2 * 60 * 60 * 1000) // 2 hours later
          : null,
      notes: this.generateNotes(customer, deliveryMethod),
      createdAt,
      updatedAt: createdAt,
    }

    // Add additional fields based on status
    if (status === 'completed') {
      order.completedAt = new Date(createdAt.getTime() + 60 * 60 * 1000) // 1 hour later
    } else if (status === 'cancelled') {
      order.cancelledAt = new Date(createdAt.getTime() + 30 * 60 * 1000) // 30 min later
      order.cancellationReason = this.randomCancellationReason()
    }

    // Add invoice number for business customers
    if (customer.type === 'business' && paymentMethod === 'invoice') {
      order.invoiceNumber = `INV-${createdAt.getFullYear()}-${String(
        orderId
      ).padStart(4, '0')}`
    }

    return order
  }

  /**
   * Generate multiple orders
   */
  static generateOrders(
    count: number,
    options?: OrderGeneratorOptions
  ): Order[] {
    const orders: Order[] = []

    for (let i = 0; i < count; i++) {
      orders.push(this.generateOrder(options))
    }

    return orders
  }

  /**
   * Generate orders for a specific date range
   */
  static generateOrdersForDateRange(
    startDate: Date,
    endDate: Date,
    ordersPerDay: number = 10
  ): Order[] {
    const orders: Order[] = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dayOrders = Math.floor(Math.random() * ordersPerDay) + 5 // 5-15 orders per day

      for (let i = 0; i < dayOrders; i++) {
        const orderDate = new Date(currentDate)
        orderDate.setHours(
          Math.floor(Math.random() * 14) + 6, // 6 AM to 8 PM
          Math.floor(Math.random() * 60),
          0,
          0
        )

        orders.push(
          this.generateOrder({
            dateRange: { start: orderDate, end: orderDate },
          })
        )
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return orders
  }

  /**
   * Generate recurring order for a customer
   */
  static generateRecurringOrder(
    customerId: number,
    frequency: 'daily' | 'weekly' | 'monthly'
  ): Order[] {
    const orders: Order[] = []
    const customer = MOCK_CUSTOMERS.find((c) => c.id === customerId)
    if (!customer) return orders

    const endDate = new Date()
    const startDate = new Date()

    switch (frequency) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 30)
        break
      case 'weekly':
        startDate.setMonth(startDate.getMonth() - 3)
        break
      case 'monthly':
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
    }

    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      // Similar items for recurring orders
      const baseItems = customer.preferences?.favoriteProducts?.slice(0, 3) || [
        1, 8, 16,
      ]

      orders.push(
        this.generateOrder({
          customerId,
          status: 'completed',
          paymentMethod:
            (customer.preferences?.preferredPaymentMethod as PaymentMethod) ||
            'invoice',
          deliveryMethod: 'delivery',
          dateRange: { start: currentDate, end: currentDate },
        })
      )

      // Increment date based on frequency
      switch (frequency) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1)
          break
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7)
          break
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1)
          break
      }
    }

    return orders
  }

  // Helper methods
  private static generateOrderItems(count: number): OrderItem[] {
    const availableProducts = ALL_PRODUCTS.filter(
      (p) => p.isActive && p.stock > 0
    )
    const items: OrderItem[] = []
    const selectedProducts = new Set<number>()

    for (let i = 0; i < count; i++) {
      let product
      do {
        product =
          availableProducts[
            Math.floor(Math.random() * availableProducts.length)
          ]
      } while (
        selectedProducts.has(product.id) &&
        selectedProducts.size < availableProducts.length
      )

      selectedProducts.add(product.id)

      const quantity = Math.floor(Math.random() * 5) + 1
      items.push({
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        total: product.price * quantity,
      })
    }

    return items
  }

  private static randomStatus(): OrderStatus {
    const statuses: OrderStatus[] = [
      'pending',
      'processing',
      'completed',
      'cancelled',
    ]
    const weights = [0.1, 0.2, 0.65, 0.05] // Most orders are completed

    const random = Math.random()
    let sum = 0

    for (let i = 0; i < statuses.length; i++) {
      sum += weights[i]
      if (random < sum) return statuses[i]
    }

    return 'completed'
  }

  private static randomPaymentMethod(): PaymentMethod {
    const methods: PaymentMethod[] = [
      'cash',
      'card',
      'invoice',
      'paypal',
      'direct_debit',
    ]
    const weights = [0.25, 0.35, 0.2, 0.15, 0.05]

    const random = Math.random()
    let sum = 0

    for (let i = 0; i < methods.length; i++) {
      sum += weights[i]
      if (random < sum) return methods[i]
    }

    return 'cash'
  }

  private static randomDeliveryMethod(): DeliveryMethod {
    return Math.random() > 0.4 ? 'pickup' : 'delivery'
  }

  private static getPaymentStatus(
    status: OrderStatus,
    method: PaymentMethod
  ): Order['paymentStatus'] {
    if (status === 'cancelled') return 'refunded'
    if (status === 'completed') return 'paid'
    if (method === 'invoice') return 'pending'
    return 'pending'
  }

  private static generateNotes(
    customer: any,
    deliveryMethod: DeliveryMethod
  ): string {
    const notes: string[] = []

    if (customer.preferences?.dietaryRestrictions?.length > 0) {
      notes.push(
        `Achtung: ${customer.preferences.dietaryRestrictions.join(', ')}`
      )
    }

    if (
      deliveryMethod === 'delivery' &&
      customer.preferences?.deliveryInstructions
    ) {
      notes.push(customer.preferences.deliveryInstructions)
    }

    if (Math.random() > 0.8) {
      const randomNotes = [
        'Bitte extra Servietten',
        'Geburtstagstorte',
        'Firmenfeier',
        'Eilauftrag',
        'Stammkunde',
      ]
      notes.push(randomNotes[Math.floor(Math.random() * randomNotes.length)])
    }

    return notes.join('. ')
  }

  private static randomCancellationReason(): string {
    const reasons = [
      'Kunde hat storniert',
      'Produkt nicht verfügbar',
      'Lieferung nicht möglich',
      'Zahlungsproblem',
      'Bestellung doppelt aufgegeben',
    ]
    return reasons[Math.floor(Math.random() * reasons.length)]
  }

  private static randomDate(start: Date, end: Date): Date {
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime())
    )
  }
}
