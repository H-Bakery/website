/**
 * Order service for managing customer orders
 */

import {
  Order,
  CreateOrderInput,
  UpdateOrderInput,
  OrderFilters,
  OrderSummary,
  OrderStatus,
  PaginatedResponse,
  ApiResponse,
} from '@bakery/shared/types'
import { apiClient } from '../api-client'

export class OrderService {
  private readonly basePath = '/api/orders'

  /**
   * Get all orders with optional filtering
   */
  async getOrders(filters?: OrderFilters): Promise<ApiResponse<Order[]>> {
    return apiClient.get<Order[]>(this.basePath, filters)
  }

  /**
   * Get paginated orders
   */
  async getOrdersPaginated(
    page: number = 1,
    limit: number = 20,
    filters?: OrderFilters
  ): Promise<ApiResponse<PaginatedResponse<Order>>> {
    const params = {
      page,
      limit,
      ...filters,
    }
    return apiClient.get<PaginatedResponse<Order>>(
      `${this.basePath}/paginated`,
      params
    )
  }

  /**
   * Get a single order by ID
   */
  async getOrder(id: number): Promise<ApiResponse<Order>> {
    return apiClient.get<Order>(`${this.basePath}/${id}`)
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(orderNumber: string): Promise<ApiResponse<Order>> {
    return apiClient.get<Order>(`${this.basePath}/number/${orderNumber}`)
  }

  /**
   * Create a new order
   */
  async createOrder(orderData: CreateOrderInput): Promise<ApiResponse<Order>> {
    return apiClient.post<Order>(this.basePath, orderData)
  }

  /**
   * Update an existing order
   */
  async updateOrder(
    id: number,
    orderData: UpdateOrderInput
  ): Promise<ApiResponse<Order>> {
    return apiClient.put<Order>(`${this.basePath}/${id}`, orderData)
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    id: number,
    status: OrderStatus
  ): Promise<ApiResponse<Order>> {
    return apiClient.patch<Order>(`${this.basePath}/${id}/status`, { status })
  }

  /**
   * Cancel an order
   */
  async cancelOrder(id: number, reason?: string): Promise<ApiResponse<Order>> {
    return apiClient.patch<Order>(`${this.basePath}/${id}/cancel`, { reason })
  }

  /**
   * Mark order as completed
   */
  async completeOrder(id: number): Promise<ApiResponse<Order>> {
    return apiClient.patch<Order>(`${this.basePath}/${id}/complete`, {})
  }

  /**
   * Delete an order
   */
  async deleteOrder(id: number): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`${this.basePath}/${id}`)
  }

  /**
   * Get orders for a specific customer
   */
  async getCustomerOrders(customerId: number): Promise<ApiResponse<Order[]>> {
    return apiClient.get<Order[]>(`${this.basePath}/customer/${customerId}`)
  }

  /**
   * Get orders for today
   */
  async getTodaysOrders(): Promise<ApiResponse<Order[]>> {
    return apiClient.get<Order[]>(`${this.basePath}/today`)
  }

  /**
   * Get order summary/analytics
   */
  async getOrderSummary(dateRange?: {
    startDate: string
    endDate: string
  }): Promise<ApiResponse<OrderSummary>> {
    return apiClient.get<OrderSummary>(`${this.basePath}/summary`, dateRange)
  }

  /**
   * Get baking list (orders that need to be prepared)
   */
  async getBakingList(date?: string): Promise<ApiResponse<Order[]>> {
    const params = date ? { date } : undefined
    return apiClient.get<Order[]>(`${this.basePath}/baking-list`, params)
  }

  /**
   * Search orders by customer name or order number
   */
  async searchOrders(query: string): Promise<ApiResponse<Order[]>> {
    return apiClient.get<Order[]>(`${this.basePath}/search`, { q: query })
  }
}

// Export singleton instance
export const orderService = new OrderService()
