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
export declare class ProductService {
  private readonly basePath
  /**
   * Get all products with optional filtering
   */
  getProducts(filters?: ProductFilters): Promise<ApiResponse<Product[]>>
  /**
   * Get paginated products
   */
  getProductsPaginated(
    page?: number,
    limit?: number,
    filters?: ProductFilters
  ): Promise<ApiResponse<PaginatedResponse<Product>>>
  /**
   * Get a single product by ID
   */
  getProduct(id: number): Promise<ApiResponse<Product>>
  /**
   * Create a new product
   */
  createProduct(productData: CreateProductInput): Promise<ApiResponse<Product>>
  /**
   * Update an existing product
   */
  updateProduct(
    id: number,
    productData: UpdateProductInput
  ): Promise<ApiResponse<Product>>
  /**
   * Delete a product
   */
  deleteProduct(id: number): Promise<ApiResponse<void>>
  /**
   * Search products by name or description
   */
  searchProducts(query: string): Promise<ApiResponse<Product[]>>
  /**
   * Get products by category
   */
  getProductsByCategory(category: string): Promise<ApiResponse<Product[]>>
  /**
   * Update product stock
   */
  updateProductStock(id: number, stock: number): Promise<ApiResponse<Product>>
  /**
   * Upload product image
   */
  uploadProductImage(
    id: number,
    image: File
  ): Promise<
    ApiResponse<{
      imageUrl: string
    }>
  >
  /**
   * Get low stock products
   */
  getLowStockProducts(threshold?: number): Promise<ApiResponse<Product[]>>
}
export declare const productService: ProductService
