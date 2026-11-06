/**
 * Core API client for all HTTP communications
 */

import { ApiResponse, PaginatedResponse } from '@bakery/shared/types'

export interface ApiClientOptions {
  baseUrl: string
  timeout?: number
  headers?: Record<string, string>
}

/**
 * Error thrown for non-2xx responses. Carries the HTTP status so callers can
 * tell "not logged in" (401) and "wrong role" (403) apart from a broken
 * server – the message alone (taken from the body's `message`) cannot.
 */
export class ApiError extends Error {
  readonly status: number
  /** Machine-readable code from the body's `error` field, if any. */
  readonly code?: string
  /** Whether the failed request carried a bearer token. */
  withAuth = false
  /** The JSON error body, for fields beyond `error`/`message`. */
  details?: Record<string, unknown>

  constructor(message: string, status: number, code?: string) {
    super(message)
    // Keeps `instanceof ApiError` working where `extends Error` is compiled
    // to ES5 (jest in some libs).
    Object.setPrototypeOf(this, ApiError.prototype)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** Per-request options of the public request methods. */
export interface RequestOptions {
  /** Extra headers for this request only (e.g. `X-Station-Token`). */
  headers?: Record<string, string>
  /**
   * On a 401 for a request that carried a bearer token, ask the
   * unauthorized handler (usually: refresh the session) once and repeat the
   * request. Default `true`; auth endpoints (login, refresh, PIN, logout)
   * pass `false`, so a refresh can never recurse into itself.
   */
  retryOnUnauthorized?: boolean
}

/**
 * Called once when an authenticated request answers 401. Resolve `true`
 * when a new access token is set on the client (the request is repeated
 * once), `false` when the session is gone (the 401 is thrown).
 */
export type UnauthorizedHandler = () => Promise<boolean>

/** Result of `ApiClient.getBlob()`. */
export interface BlobDownload {
  blob: Blob
  contentType: string | null
  /** File name from `Content-Disposition`, if the server sent one. */
  filename: string | null
}

/** `filename` (or RFC 5987 `filename*`) from a `Content-Disposition` header. */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header)
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^"|"$/g, ''))
    } catch {
      // fall through to the plain parameter
    }
  }
  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/.exec(header)
  if (!plain) return null
  const value = (plain[2] ?? plain[1]).trim()
  return value || null
}

export class ApiClient {
  private baseUrl: string
  private timeout: number
  private defaultHeaders: Record<string, string>
  private unauthorizedHandler: UnauthorizedHandler | null = null

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.timeout = options.timeout || 10000 // 10 seconds default
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
  }

  /**
   * Change the base URL, e.g. to `''` for same-origin requests in a browser
   * app that proxies `/api` itself (bakery-management, F4).
   */
  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /** The base URL requests are sent to (`''` = same origin). */
  getBaseUrl(): string {
    return this.baseUrl
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
      ? { Authorization: this.defaultHeaders['Authorization'] }
      : {}
  }

  /**
   * Clear all tokens (alias for clearAuthToken for consistency)
   */
  clearTokens() {
    this.clearAuthToken()
  }

  /**
   * Install (or remove with `null`) the handler that is asked once when an
   * authenticated request answers 401 - see `UnauthorizedHandler`.
   */
  setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
    this.unauthorizedHandler = handler
  }

  /**
   * Generic request method. A 401 on a request that carried a bearer token
   * asks the unauthorized handler once and, if it set a new token, repeats
   * the request with the new header.
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requestOptions: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.withUnauthorizedRetry(
      () => this.send<T>(endpoint, options, requestOptions),
      requestOptions
    )
  }

  /**
   * Runs `attempt`; on a 401 for a request that carried a bearer token, asks
   * the unauthorized handler once and, if it set a new token, runs `attempt`
   * again (which reads the new header at send time).
   */
  private async withUnauthorizedRetry<R>(
    attempt: () => Promise<R>,
    requestOptions: RequestOptions
  ): Promise<R> {
    try {
      return await attempt()
    } catch (error) {
      const handler = this.unauthorizedHandler
      const failed = error as Partial<ApiError> | null
      if (
        failed?.status === 401 &&
        failed.withAuth === true &&
        requestOptions.retryOnUnauthorized !== false &&
        handler
      ) {
        const renewed = await handler().catch(() => false)
        if (renewed) {
          return attempt()
        }
      }
      throw error
    }
  }

  private async send<T>(
    endpoint: string,
    options: RequestInit,
    requestOptions: RequestOptions
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`

    // Read at send time: a retry after a refresh must carry the new token.
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(options.headers as Record<string, string> | undefined),
      ...requestOptions.headers,
    }
    const withAuth = Boolean(headers['Authorization'])
    const config: RequestInit = { ...options, headers }

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
        const apiError = new ApiError(
          data?.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          typeof data?.error === 'string' ? data.error : undefined
        )
        apiError.withAuth = withAuth
        if (data && typeof data === 'object') apiError.details = data
        throw apiError
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
    params?: Record<string, any>,
    options?: RequestOptions
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

    return this.request<T>(url, { method: 'GET' }, options)
  }

  /**
   * GET a file (CSV, PDF …) with the same headers, error handling and
   * 401-refresh as the JSON methods. A plain `<a href>` cannot carry the
   * bearer token, so downloads from a guarded API must go through this.
   * Errors arrive as `ApiError` with the body's German `message`.
   */
  async getBlob(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<BlobDownload> {
    return this.withUnauthorizedRetry(
      () => this.sendForBlob(endpoint, options),
      options
    )
  }

  private async sendForBlob(
    endpoint: string,
    requestOptions: RequestOptions
  ): Promise<BlobDownload> {
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...requestOptions.headers,
    }
    delete headers['Content-Type']
    const withAuth = Boolean(headers['Authorization'])
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })
      const contentType = response.headers.get('content-type')
      if (!response.ok) {
        let data: any = null
        try {
          data = contentType?.includes('application/json')
            ? await response.json()
            : null
        } catch {
          data = null
        }
        const apiError = new ApiError(
          data?.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          typeof data?.error === 'string' ? data.error : undefined
        )
        apiError.withAuth = withAuth
        if (data && typeof data === 'object') apiError.details = data
        throw apiError
      }
      const blob = await response.blob()
      return {
        blob,
        contentType,
        filename: filenameFromDisposition(
          response.headers.get('content-disposition')
        ),
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout')
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      },
      options
    )
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      },
      options
    )
  }

  /**
   * PATCH request
   */
  async patch<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
      },
      options
    )
  }

  /**
   * DELETE request
   */
  async delete<T>(
    endpoint: string,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' }, options)
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
