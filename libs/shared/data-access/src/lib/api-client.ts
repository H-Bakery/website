/**
 * Core API client for all HTTP communications
 */

import { ApiResponse, PaginatedResponse } from '@bakery/shared/types'

export interface ApiClientOptions {
  baseUrl: string
  timeout?: number
  headers?: Record<string, string>
}

export class ApiClient {
  private baseUrl: string
  private timeout: number
  private defaultHeaders: Record<string, string>

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.timeout = options.timeout || 10000 // 10 seconds default
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
  }

  /**
   * Set authorization token
   */
  setAuthToken(token: string) {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  /**
   * Remove authorization token
   */
  clearAuthToken() {
    delete this.defaultHeaders['Authorization']
  }

  /**
   * Check if user is authenticated (has valid token)
   */
  isAuthenticated(): boolean {
    return !!this.defaultHeaders['Authorization']
  }

  /**
   * Get authorization header
   */
  getAuthHeader(): Record<string, string> {
    return this.defaultHeaders['Authorization'] 
      ? { 'Authorization': this.defaultHeaders['Authorization'] }
      : {}
  }

  /**
   * Clear all tokens (alias for clearAuthToken for consistency)
   */
  clearTokens() {
    this.clearAuthToken()
  }

  /**
   * Generic request method
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`

    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    }

    // Add timeout using AbortController
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)
    config.signal = controller.signal

    try {
      const response = await fetch(url, config)
      clearTimeout(timeoutId)

      let data: any
      const contentType = response.headers.get('content-type')

      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      if (!response.ok) {
        throw new Error(
          data?.message || `HTTP ${response.status}: ${response.statusText}`
        )
      }

      // If the response is already in ApiResponse format, return it
      if (data && typeof data === 'object' && 'success' in data) {
        return data as ApiResponse<T>
      }

      // Otherwise, wrap the data in ApiResponse format
      return {
        success: true,
        data: data as T,
        message: 'Request successful',
      }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout')
        }
        throw error
      }

      throw new Error('Unknown error occurred')
    }
  }

  /**
   * GET request
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    let url = endpoint

    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })

      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`
      }
    }

    return this.request<T>(url, { method: 'GET' })
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  /**
   * Upload file
   */
  async upload<T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const formData = new FormData()
    formData.append('file', file)

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value))
      })
    }

    // Remove Content-Type header to let browser set it with boundary
    const headers = { ...this.defaultHeaders }
    delete headers['Content-Type']

    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers,
    })
  }
}

// Default API client instance
export const apiClient = new ApiClient({
  baseUrl:
    (typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_API_URL']) ||
    'http://localhost:5000',
})
