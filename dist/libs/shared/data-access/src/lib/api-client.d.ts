/**
 * Core API client for all HTTP communications
 */
import { ApiResponse } from '@bakery/shared/types'
export interface ApiClientOptions {
  baseUrl: string
  timeout?: number
  headers?: Record<string, string>
}
export declare class ApiClient {
  private baseUrl
  private timeout
  private defaultHeaders
  constructor(options: ApiClientOptions)
  /**
   * Set authorization token
   */
  setAuthToken(token: string): void
  /**
   * Remove authorization token
   */
  clearAuthToken(): void
  /**
   * Generic request method
   */
  private request
  /**
   * GET request
   */
  get<T>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>>
  /**
   * POST request
   */
  post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>>
  /**
   * PUT request
   */
  put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>>
  /**
   * PATCH request
   */
  patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>>
  /**
   * DELETE request
   */
  delete<T>(endpoint: string): Promise<ApiResponse<T>>
  /**
   * Upload file
   */
  upload<T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, any>
  ): Promise<ApiResponse<T>>
}
export declare const apiClient: ApiClient
