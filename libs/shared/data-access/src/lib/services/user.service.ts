/**
 * User service for authentication and user management
 */

import {
  User,
  LoginCredentials,
  LoginResponse,
  RegisterInput,
  CreateUserInput,
  UpdateUserInput,
  ApiResponse,
} from '@bakery/shared/types'
import { apiClient } from '../api-client'

export class UserService {
  private readonly basePath = '/api/users'
  private readonly authPath = '/api/auth'

  /**
   * Login user
   */
  async login(
    credentials: LoginCredentials
  ): Promise<ApiResponse<LoginResponse>> {
    const response = await apiClient.post<LoginResponse>(
      `${this.authPath}/login`,
      credentials
    )

    // Set auth token for future requests
    if (response.success && response.data?.token) {
      apiClient.setAuthToken(response.data.token)
    }

    return response
  }

  /**
   * Register new user
   */
  async register(userData: RegisterInput): Promise<ApiResponse<LoginResponse>> {
    const response = await apiClient.post<LoginResponse>(
      `${this.authPath}/register`,
      userData
    )

    // Set auth token for future requests
    if (response.success && response.data?.token) {
      apiClient.setAuthToken(response.data.token)
    }

    return response
  }

  /**
   * Logout user
   */
  async logout(): Promise<ApiResponse<void>> {
    const response = await apiClient.post<void>(`${this.authPath}/logout`)

    // Clear auth token
    apiClient.clearAuthToken()

    return response
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(
    refreshToken: string
  ): Promise<ApiResponse<{ token: string; expiresIn: number }>> {
    const response = await apiClient.post<{ token: string; expiresIn: number }>(
      `${this.authPath}/refresh`,
      { refreshToken }
    )

    // Update auth token
    if (response.success && response.data?.token) {
      apiClient.setAuthToken(response.data.token)
    }

    return response
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return apiClient.get<User>(`${this.authPath}/me`)
  }

  /**
   * Update current user profile
   */
  async updateProfile(
    userData: Partial<UpdateUserInput>
  ): Promise<ApiResponse<User>> {
    return apiClient.put<User>(`${this.authPath}/me`, userData)
  }

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`${this.authPath}/change-password`, {
      currentPassword,
      newPassword,
    })
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`${this.authPath}/forgot-password`, { email })
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`${this.authPath}/reset-password`, {
      token,
      newPassword,
    })
  }

  /**
   * Get all users (admin only)
   */
  async getUsers(): Promise<ApiResponse<User[]>> {
    return apiClient.get<User[]>(this.basePath)
  }

  /**
   * Get user by ID (admin only)
   */
  async getUser(id: number): Promise<ApiResponse<User>> {
    return apiClient.get<User>(`${this.basePath}/${id}`)
  }

  /**
   * Create new user (admin only)
   */
  async createUser(userData: CreateUserInput): Promise<ApiResponse<User>> {
    return apiClient.post<User>(this.basePath, userData)
  }

  /**
   * Update user (admin only)
   */
  async updateUser(
    id: number,
    userData: UpdateUserInput
  ): Promise<ApiResponse<User>> {
    return apiClient.put<User>(`${this.basePath}/${id}`, userData)
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(id: number): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`${this.basePath}/${id}`)
  }

  /**
   * Get customers only
   */
  async getCustomers(): Promise<ApiResponse<User[]>> {
    return apiClient.get<User[]>(`${this.basePath}/customers`)
  }

  /**
   * Get staff only
   */
  async getStaff(): Promise<ApiResponse<User[]>> {
    return apiClient.get<User[]>(`${this.basePath}/staff`)
  }
}

// Export singleton instance
export const userService = new UserService()
