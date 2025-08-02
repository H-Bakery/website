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
export declare class OrderService {
  private readonly basePath
  /**
   * Get all orders with optional filtering
   */
  getOrders(filters?: OrderFilters): Promise<ApiResponse<Order[]>>
  /**
   * Get paginated orders
   */
  getOrdersPaginated(
    page?: number,
    limit?: number,
    filters?: OrderFilters
  ): Promise<ApiResponse<PaginatedResponse<Order>>>
  /**
   * Get a single order by ID
   */
  getOrder(id: number): Promise<ApiResponse<Order>>
  /**
   * Get order by order number
   */
  getOrderByNumber(orderNumber: string): Promise<ApiResponse<Order>>
  /**
   * Create a new order
   */
  createOrder(orderData: CreateOrderInput): Promise<ApiResponse<Order>>
  /**
   * Update an existing order
   */
  updateOrder(
    id: number,
    orderData: UpdateOrderInput
  ): Promise<ApiResponse<Order>>
  /**
   * Update order status
   */
  updateOrderStatus(
    id: number,
    status: OrderStatus
  ): Promise<ApiResponse<Order>>
  /**
   * Cancel an order
   */
  cancelOrder(id: number, reason?: string): Promise<ApiResponse<Order>>
  /**
   * Mark order as completed
   */
  completeOrder(id: number): Promise<ApiResponse<Order>>
  /**
   * Delete an order
   */
  deleteOrder(id: number): Promise<ApiResponse<void>>
  /**
   * Get orders for a specific customer
   */
  getCustomerOrders(customerId: number): Promise<ApiResponse<Order[]>>
  /**
   * Get orders for today
   */
  getTodaysOrders(): Promise<ApiResponse<Order[]>>
  /**
   * Get order summary/analytics
   */
  getOrderSummary(dateRange?: {
    startDate: string
    endDate: string
  }): Promise<ApiResponse<OrderSummary>>
  /**
   * Get baking list (orders that need to be prepared)
   */
  getBakingList(date?: string): Promise<ApiResponse<Order[]>>
  /**
   * Search orders by customer name or order number
   */
  searchOrders(query: string): Promise<ApiResponse<Order[]>>
}
export declare const orderService: OrderService
