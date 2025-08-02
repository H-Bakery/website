import { default as React } from 'react'
import { User, UserRole } from '@bakery/shared/types'
/**
 * Authentication state
 */
export interface AuthState {
  /** Current authenticated user */
  user: User | null
  /** Whether user is authenticated */
  isAuthenticated: boolean
  /** Whether authentication is being checked */
  isLoading: boolean
  /** Authentication error */
  error: string | null
  /** User permissions based on role */
  permissions: Set<string>
}
/**
 * Login credentials
 */
export interface LoginCredentials {
  /** Username or email */
  username: string
  /** Password */
  password: string
  /** Remember user for extended session */
  rememberMe?: boolean
}
/**
 * Registration data
 */
export interface RegistrationData {
  /** Username */
  username: string
  /** Email address */
  email: string
  /** Password */
  password: string
  /** Confirm password */
  confirmPassword: string
  /** Full name */
  name: string
  /** Phone number (optional) */
  phone?: string
}
/**
 * Password change data
 */
export interface PasswordChangeData {
  /** Current password */
  currentPassword: string
  /** New password */
  newPassword: string
  /** Confirm new password */
  confirmPassword: string
}
/**
 * Authentication context type
 */
export interface AuthContextType extends AuthState {
  /** Login with credentials */
  login: (credentials: LoginCredentials) => Promise<void>
  /** Register new user */
  register: (data: RegistrationData) => Promise<void>
  /** Logout current user */
  logout: () => Promise<void>
  /** Refresh authentication state */
  refreshAuth: () => Promise<void>
  /** Change password */
  changePassword: (data: PasswordChangeData) => Promise<void>
  /** Request password reset */
  requestPasswordReset: (email: string) => Promise<void>
  /** Reset password with token */
  resetPassword: (token: string, newPassword: string) => Promise<void>
  /** Check if user has permission */
  hasPermission: (permission: string) => boolean
  /** Check if user has any of the roles */
  hasRole: (...roles: UserRole[]) => boolean
  /** Update user profile */
  updateProfile: (data: Partial<User>) => Promise<void>
  /** Clear authentication error */
  clearError: () => void
}
/**
 * Auth provider props
 */
export interface AuthProviderProps {
  /** Child components */
  children: React.ReactNode
  /** Auto refresh interval in ms (default: 5 minutes) */
  refreshInterval?: number
  /** Whether to check auth on mount */
  checkAuthOnMount?: boolean
  /** Callback on authentication state change */
  onAuthStateChange?: (isAuthenticated: boolean, user: User | null) => void
  /** Custom permission mapping */
  permissionMapping?: Record<UserRole, string[]>
}
/**
 * Enhanced auth provider component
 */
export declare const AuthProvider: React.FC<AuthProviderProps>
/**
 * Hook to use auth context
 * @throws {Error} If used outside of AuthProvider
 */
export declare const useAuth: () => AuthContextType
/**
 * Hook to get current user
 */
export declare const useCurrentUser: () => User | null
/**
 * Hook to check authentication status
 */
export declare const useIsAuthenticated: () => boolean
/**
 * Hook to require authentication
 * Throws if not authenticated
 */
export declare const useRequireAuth: () => AuthContextType
/**
 * Hook to require specific permission
 * Throws if permission not granted
 */
export declare const useRequirePermission: (
  permission: string
) => AuthContextType
/**
 * Hook to require specific role
 * Throws if role not matched
 */
export declare const useRequireRole: (...roles: UserRole[]) => AuthContextType
