/**
 * Authentication service for the bakery management system
 *
 * This service wraps the auth-related methods from userService
 * to provide a dedicated authentication interface.
 */

import {
  LoginCredentials,
  LoginResponse,
  RegisterInput,
  ApiResponse,
  User,
} from '@bakery/shared/types'
import { userService } from './user.service'

export class AuthService {
  /**
   * Login user with credentials
   */
  async login(
    credentials: any
  ): Promise<ApiResponse<LoginResponse>> {
    // Transform auth context credentials to service format
    const loginData: LoginCredentials = {
      email: credentials.username || credentials.email,
      password: credentials.password,
    }
    return userService.login(loginData)
  }

  /**
   * Register a new user
   */
  async register(userData: any): Promise<ApiResponse<LoginResponse>> {
    // Transform auth context data to RegisterInput format
    const registerData: RegisterInput = {
      email: userData.email,
      password: userData.password,
      firstName: userData.name?.split(' ')[0] || userData.username,
      lastName: userData.name?.split(' ').slice(1).join(' ') || '',
      phoneNumber: userData.phone,
    }
    return userService.register(registerData)
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<ApiResponse<void>> {
    return userService.logout()
  }

  /**
   * Refresh the authentication token
   */
  async refreshToken(
    refreshToken: string
  ): Promise<ApiResponse<{ token: string; expiresIn: number }>> {
    return userService.refreshToken(refreshToken)
  }

  /**
   * Get the current authenticated user
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return userService.getCurrentUser()
  }

  /**
   * Update the current user's profile
   */
  async updateProfile(userData: Partial<User>): Promise<ApiResponse<User>> {
    return userService.updateProfile(userData)
  }

  /**
   * Change the current user's password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ApiResponse<void>> {
    return userService.changePassword(currentPassword, newPassword)
  }

  /**
   * Request a password reset
   */
  async requestPasswordReset(email: string): Promise<ApiResponse<void>> {
    return userService.requestPasswordReset(email)
  }

  /**
   * Reset password using a reset token
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<ApiResponse<void>> {
    return userService.resetPassword(token, newPassword)
  }
}

// Export singleton instance
export const authService = new AuthService()
