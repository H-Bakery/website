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
export declare class UserService {
  private readonly basePath
  private readonly authPath
  /**
   * Login user
   */
  login(credentials: LoginCredentials): Promise<ApiResponse<LoginResponse>>
  /**
   * Register new user
   */
  register(userData: RegisterInput): Promise<ApiResponse<LoginResponse>>
  /**
   * Logout user
   */
  logout(): Promise<ApiResponse<void>>
  /**
   * Refresh authentication token
   */
  refreshToken(refreshToken: string): Promise<
    ApiResponse<{
      token: string
      expiresIn: number
    }>
  >
  /**
   * Get current user profile
   */
  getCurrentUser(): Promise<ApiResponse<User>>
  /**
   * Update current user profile
   */
  updateProfile(userData: Partial<UpdateUserInput>): Promise<ApiResponse<User>>
  /**
   * Change password
   */
  changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ApiResponse<void>>
  /**
   * Request password reset
   */
  requestPasswordReset(email: string): Promise<ApiResponse<void>>
  /**
   * Reset password with token
   */
  resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>>
  /**
   * Get all users (admin only)
   */
  getUsers(): Promise<ApiResponse<User[]>>
  /**
   * Get user by ID (admin only)
   */
  getUser(id: number): Promise<ApiResponse<User>>
  /**
   * Create new user (admin only)
   */
  createUser(userData: CreateUserInput): Promise<ApiResponse<User>>
  /**
   * Update user (admin only)
   */
  updateUser(id: number, userData: UpdateUserInput): Promise<ApiResponse<User>>
  /**
   * Delete user (admin only)
   */
  deleteUser(id: number): Promise<ApiResponse<void>>
  /**
   * Get customers only
   */
  getCustomers(): Promise<ApiResponse<User[]>>
  /**
   * Get staff only
   */
  getStaff(): Promise<ApiResponse<User[]>>
}
export declare const userService: UserService
