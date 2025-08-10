/**
 * Product service for managing bakery products
 */

import {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilters,
  PaginatedResponse,
  ApiResponse,
} from '@bakery/shared/types'
import { apiClient } from '../api-client'

export class ProductService {
  private readonly basePath = '/api/products'

  /**
   * Get all products with optional filtering
   */
  async getProducts(filters?: ProductFilters): Promise<ApiResponse<Product[]>> {
    return apiClient.get<Product[]>(this.basePath, filters)
  }

  /**
   * Get paginated products
   */
  async getProductsPaginated(
    page: number = 1,
    limit: number = 20,
    filters?: ProductFilters
  ): Promise<ApiResponse<PaginatedResponse<Product>>> {
    const params = {
      page,
      limit,
      ...filters,
    }
    return apiClient.get<PaginatedResponse<Product>>(
      `${this.basePath}/paginated`,
      params
    )
  }

  /**
   * Get a single product by ID
   */
  async getProduct(id: number): Promise<ApiResponse<Product>> {
    return apiClient.get<Product>(`${this.basePath}/${id}`)
  }

  /**
   * Create a new product
   */
  async createProduct(
    productData: CreateProductInput
  ): Promise<ApiResponse<Product>> {
    return apiClient.post<Product>(this.basePath, productData)
  }

  /**
   * Update an existing product
   */
  async updateProduct(
    id: number,
    productData: UpdateProductInput
  ): Promise<ApiResponse<Product>> {
    return apiClient.put<Product>(`${this.basePath}/${id}`, productData)
  }

  /**
   * Delete a product
   */
  async deleteProduct(id: number): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`${this.basePath}/${id}`)
  }

  /**
   * Search products by name or description
   */
  async searchProducts(query: string): Promise<ApiResponse<Product[]>> {
    return apiClient.get<Product[]>(`${this.basePath}/search`, { q: query })
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(
    category: string
  ): Promise<ApiResponse<Product[]>> {
    return apiClient.get<Product[]>(`${this.basePath}/category/${category}`)
  }

  /**
   * Update product stock
   */
  async updateProductStock(
    id: number,
    stock: number
  ): Promise<ApiResponse<Product>> {
    return apiClient.patch<Product>(`${this.basePath}/${id}/stock`, { stock })
  }

  /**
   * Upload product image
   */
  async uploadProductImage(
    id: number,
    image: File
  ): Promise<ApiResponse<{ imageUrl: string }>> {
    return apiClient.upload<{ imageUrl: string }>(
      `${this.basePath}/${id}/image`,
      image
    )
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(
    threshold?: number
  ): Promise<ApiResponse<Product[]>> {
    const params = threshold ? { threshold } : undefined
    return apiClient.get<Product[]>(`${this.basePath}/low-stock`, params)
  }
}

// Export singleton instance
export const productService = new ProductService()

// Add React Query hook for convenience (temporary)
// @ts-ignore - Adding hook to service temporarily
productService.useProducts = () => {
  // This is a placeholder - normally would use React Query
  // For now, return a basic structure that the component expects
  return { data: [] };
};
