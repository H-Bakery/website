/**
 * @fileoverview Enhanced authentication context with JWT refresh, role-based access, and security features
 * @module @bakery/shared/contexts/auth
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { User, UserRole } from '@bakery/shared/types'
import { authService, apiClient } from '@bakery/shared/data-access'

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
 * Auth context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Default permission mapping by role
 */
const DEFAULT_PERMISSION_MAPPING: Record<UserRole, string[]> = {
  admin: [
    'users.read',
    'users.write',
    'users.delete',
    'products.read',
    'products.write',
    'products.delete',
    'orders.read',
    'orders.write',
    'orders.delete',
    'cash.read',
    'cash.write',
    'inventory.read',
    'inventory.write',
    'production.read',
    'production.write',
    'staff.read',
    'staff.write',
    'dashboard.read',
    'settings.read',
    'settings.write',
  ],
  manager: [
    'products.read',
    'products.write',
    'orders.read',
    'orders.write',
    'cash.read',
    'cash.write',
    'inventory.read',
    'inventory.write',
    'production.read',
    'production.write',
    'staff.read',
    'dashboard.read',
  ],
  staff: [
    'products.read',
    'orders.read',
    'orders.write',
    'cash.read',
    'cash.write',
    'inventory.read',
    'production.read',
    'production.write',
  ],
  customer: [
    'products.read',
    'orders.read',
  ],
}

/**
 * Enhanced auth provider component
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  refreshInterval = 5 * 60 * 1000, // 5 minutes
  checkAuthOnMount = true,
  onAuthStateChange,
  permissionMapping = DEFAULT_PERMISSION_MAPPING,
}) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRefreshingRef = useRef(false)

  // Calculate permissions based on user role
  const permissions = useMemo(() => {
    if (!user || !user.role) return new Set<string>()
    const rolePermissions = permissionMapping[user.role as UserRole] || []
    return new Set(rolePermissions)
  }, [user, permissionMapping])

  // Authentication state
  const isAuthenticated = Boolean(user && apiClient.isAuthenticated())

  // Notify auth state changes
  useEffect(() => {
    onAuthStateChange?.(isAuthenticated, user)
  }, [isAuthenticated, user, onAuthStateChange])

  // Clear refresh timeout
  const clearRefreshTimeout = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }
  }, [])

  // Schedule token refresh
  const scheduleRefresh = useCallback(() => {
    clearRefreshTimeout()
    
    if (isAuthenticated && refreshInterval > 0) {
      refreshTimeoutRef.current = setTimeout(async () => {
        if (!isRefreshingRef.current) {
          isRefreshingRef.current = true
          try {
            await authService.refreshToken()
          } catch (error) {
            console.error('Token refresh failed:', error)
            // If refresh fails, logout user
            await logout()
          } finally {
            isRefreshingRef.current = false
          }
        }
      }, refreshInterval)
    }
  }, [isAuthenticated, refreshInterval, clearRefreshTimeout])

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      if (!checkAuthOnMount) {
        setIsLoading(false)
        return
      }

      try {
        // Check if we have stored tokens
        if (apiClient.isAuthenticated()) {
          // Try to get current user
          const currentUser = await authService.getCurrentUser()
          setUser(currentUser)
          scheduleRefresh()
        }
      } catch (error) {
        console.error('Auth initialization failed:', error)
        // Clear invalid tokens
        apiClient.clearTokens()
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [checkAuthOnMount, scheduleRefresh])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRefreshTimeout()
    }
  }, [clearRefreshTimeout])

  // Login handler
  const login = useCallback(async (credentials: LoginCredentials) => {
    setError(null)
    setIsLoading(true)

    try {
      const response = await authService.login(credentials)
      setUser(response.user)
      scheduleRefresh()
    } catch (error: any) {
      const message = error.message || 'Login failed. Please try again.'
      setError(message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [scheduleRefresh])

  // Register handler
  const register = useCallback(async (data: RegistrationData) => {
    setError(null)
    setIsLoading(true)

    try {
      const response = await authService.register(data)
      setUser(response.user)
      scheduleRefresh()
    } catch (error: any) {
      const message = error.message || 'Registration failed. Please try again.'
      setError(message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [scheduleRefresh])

  // Logout handler
  const logout = useCallback(async () => {
    setError(null)
    setIsLoading(true)

    try {
      await authService.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      clearRefreshTimeout()
      setIsLoading(false)
    }
  }, [clearRefreshTimeout])

  // Refresh auth handler
  const refreshAuth = useCallback(async () => {
    if (isRefreshingRef.current) return

    setError(null)
    isRefreshingRef.current = true

    try {
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
      scheduleRefresh()
    } catch (error: any) {
      const message = error.message || 'Failed to refresh authentication.'
      setError(message)
      throw error
    } finally {
      isRefreshingRef.current = false
    }
  }, [scheduleRefresh])

  // Change password handler
  const changePassword = useCallback(async (data: PasswordChangeData) => {
    setError(null)

    try {
      await authService.changePassword(data)
    } catch (error: any) {
      const message = error.message || 'Failed to change password.'
      setError(message)
      throw error
    }
  }, [])

  // Request password reset handler
  const requestPasswordReset = useCallback(async (email: string) => {
    setError(null)

    try {
      await authService.requestPasswordReset(email)
    } catch (error: any) {
      const message = error.message || 'Failed to request password reset.'
      setError(message)
      throw error
    }
  }, [])

  // Reset password handler
  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    setError(null)

    try {
      await authService.resetPassword(token, newPassword)
    } catch (error: any) {
      const message = error.message || 'Failed to reset password.'
      setError(message)
      throw error
    }
  }, [])

  // Update profile handler
  const updateProfile = useCallback(async (data: Partial<User>) => {
    setError(null)

    try {
      const updatedUser = await authService.updateProfile(data)
      setUser(updatedUser)
    } catch (error: any) {
      const message = error.message || 'Failed to update profile.'
      setError(message)
      throw error
    }
  }, [])

  // Check permission handler
  const hasPermission = useCallback((permission: string): boolean => {
    return permissions.has(permission)
  }, [permissions])

  // Check role handler
  const hasRole = useCallback((...roles: UserRole[]): boolean => {
    if (!user || !user.role) return false
    return roles.includes(user.role as UserRole)
  }, [user])

  // Clear error handler
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Context value
  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      error,
      permissions,
      login,
      register,
      logout,
      refreshAuth,
      changePassword,
      requestPasswordReset,
      resetPassword,
      hasPermission,
      hasRole,
      updateProfile,
      clearError,
    }),
    [
      user,
      isAuthenticated,
      isLoading,
      error,
      permissions,
      login,
      register,
      logout,
      refreshAuth,
      changePassword,
      requestPasswordReset,
      resetPassword,
      hasPermission,
      hasRole,
      updateProfile,
      clearError,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to use auth context
 * @throws {Error} If used outside of AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Hook to get current user
 */
export const useCurrentUser = (): User | null => {
  const { user } = useAuth()
  return user
}

/**
 * Hook to check authentication status
 */
export const useIsAuthenticated = (): boolean => {
  const { isAuthenticated } = useAuth()
  return isAuthenticated
}

/**
 * Hook to require authentication
 * Throws if not authenticated
 */
export const useRequireAuth = (): AuthContextType => {
  const auth = useAuth()
  
  if (!auth.isAuthenticated && !auth.isLoading) {
    throw new Error('Authentication required')
  }
  
  return auth
}

/**
 * Hook to require specific permission
 * Throws if permission not granted
 */
export const useRequirePermission = (permission: string): AuthContextType => {
  const auth = useRequireAuth()
  
  if (!auth.hasPermission(permission)) {
    throw new Error(`Permission denied: ${permission}`)
  }
  
  return auth
}

/**
 * Hook to require specific role
 * Throws if role not matched
 */
export const useRequireRole = (...roles: UserRole[]): AuthContextType => {
  const auth = useRequireAuth()
  
  if (!auth.hasRole(...roles)) {
    throw new Error(`Role required: ${roles.join(' or ')}`)
  }
  
  return auth
}