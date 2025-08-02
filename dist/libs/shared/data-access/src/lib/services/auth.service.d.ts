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
export declare class AuthService {
  /**
   * Login user with credentials
   */
  login(credentials: LoginCredentials): Promise<ApiResponse<LoginResponse>>
  /**
   * Register a new user
   */
  register(userData: RegisterInput): Promise<ApiResponse<LoginResponse>>
  /**
   * Logout the current user
   */
  logout(): Promise<ApiResponse<void>>
  /**
   * Refresh the authentication token
   */
  refreshToken(refreshToken: string): Promise<
    ApiResponse<{
      token: string
      expiresIn: number
    }>
  >
  /**
   * Get the current authenticated user
   */
  getCurrentUser(): Promise<ApiResponse<User>>
  /**
   * Update the current user's profile
   */
  updateProfile(userData: Partial<User>): Promise<ApiResponse<User>>
  /**
   * Change the current user's password
   */
  changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ApiResponse<void>>
  /**
   * Request a password reset
   */
  requestPasswordReset(email: string): Promise<ApiResponse<void>>
  /**
   * Reset password using a reset token
   */
  resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>>
}
export declare const authService: AuthService
