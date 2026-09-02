/**
 * @fileoverview Tests for enhanced auth context
 * @module @bakery/shared/contexts/auth/tests
 */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AuthProvider, useAuth } from './auth.context'
import { User } from '@bakery/shared/types'

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock bakery API — jest.mock wird über die Imports gehoben, deshalb darf die
// Factory keine Konstante aus dieser Datei referenzieren.
jest.mock('@bakery/shared/data-access', () => ({
  bakeryAPI: {
    login: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    getCurrentUser: jest.fn(),
    updateUser: jest.fn(),
  },
}))

const mockBakeryAPI = jest.requireMock('@bakery/shared/data-access')
  .bakeryAPI as Record<string, jest.Mock>

// Mock user data
const mockUser: User = {
  id: 1,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'customer',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const mockAdminUser: User = {
  ...mockUser,
  id: 2,
  email: 'admin@example.com',
  role: 'admin',
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should initialize with no user when no token is stored', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.isLoading).toBe(false)
  })

  it('should load token from localStorage on init', async () => {
    const mockToken = 'mock-jwt-token'
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'bakery-auth-token') return mockToken
      return null
    })
    mockBakeryAPI.getCurrentUser.mockResolvedValue(mockUser)

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.token).toBe(mockToken)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('should handle login successfully', async () => {
    const credentials = { email: 'test@example.com', password: 'password' }
    const mockResponse = {
      token: 'new-jwt-token',
      refreshToken: 'refresh-token',
      user: mockUser,
    }

    mockBakeryAPI.login.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await act(async () => {
      await result.current.login(credentials)
    })

    expect(mockBakeryAPI.login).toHaveBeenCalledWith(credentials)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.token).toBe(mockResponse.token)
    expect(result.current.isAuthenticated).toBe(true)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'bakery-auth-token',
      mockResponse.token
    )
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'bakery-refresh-token',
      mockResponse.refreshToken
    )
  })

  it('should handle login failure', async () => {
    const credentials = { email: 'test@example.com', password: 'wrong' }
    const error = new Error('Invalid credentials')

    mockBakeryAPI.login.mockRejectedValue(error)

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await expect(
      act(async () => {
        await result.current.login(credentials)
      })
    ).rejects.toThrow('Invalid credentials')

    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('should handle logout', async () => {
    // Setup authenticated state first
    const mockToken = 'mock-jwt-token'
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'bakery-auth-token') return mockToken
      return null
    })
    mockBakeryAPI.getCurrentUser.mockResolvedValue(mockUser)

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
    })

    // Now logout
    await act(async () => {
      await result.current.logout()
    })

    expect(mockBakeryAPI.logout).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      'bakery-auth-token'
    )
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      'bakery-refresh-token'
    )
  })

  it('should check permissions correctly', async () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'bakery-auth-token') return 'admin-token'
      return null
    })
    mockBakeryAPI.getCurrentUser.mockResolvedValue(mockAdminUser)

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await waitFor(() => {
      expect(result.current.user).toEqual(mockAdminUser)
    })

    // Test role-based permissions
    expect(result.current.hasPermission('admin')).toBe(true)
    expect(result.current.hasPermission('customer')).toBe(true) // Admin can access customer features
    expect(result.current.hasPermission('super-admin')).toBe(false)

    // Test array permissions
    expect(result.current.hasPermission(['admin', 'manager'])).toBe(true)
    expect(result.current.hasPermission(['super-admin', 'owner'])).toBe(false)
  })

  it('should handle token refresh', async () => {
    const oldToken = 'old-token'
    const newToken = 'new-token'
    const refreshToken = 'refresh-token'

    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'bakery-auth-token') return oldToken
      if (key === 'bakery-refresh-token') return refreshToken
      return null
    })

    mockBakeryAPI.getCurrentUser.mockResolvedValue(mockUser)
    mockBakeryAPI.refreshToken.mockResolvedValue({
      token: newToken,
      refreshToken: 'new-refresh-token',
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
    })

    // Manually trigger refresh
    await act(async () => {
      await result.current.refreshAuth()
    })

    expect(mockBakeryAPI.refreshToken).toHaveBeenCalledWith(refreshToken)
    expect(result.current.token).toBe(newToken)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'bakery-auth-token',
      newToken
    )
  })

  it('should handle auto-refresh on token expiry', async () => {
    const expiredToken = 'expired-token'
    const refreshToken = 'refresh-token'
    const newToken = 'new-token'

    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'bakery-auth-token') return expiredToken
      if (key === 'bakery-refresh-token') return refreshToken
      return null
    })

    // First call fails (token expired), second call succeeds after refresh
    mockBakeryAPI.getCurrentUser
      .mockRejectedValueOnce(new Error('Token expired'))
      .mockResolvedValueOnce(mockUser)

    mockBakeryAPI.refreshToken.mockResolvedValue({
      token: newToken,
      refreshToken: 'new-refresh-token',
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider enableAutoRefresh refreshThreshold={300000}>
          {children}
        </AuthProvider>
      ),
    })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.token).toBe(newToken)
    })

    expect(mockBakeryAPI.refreshToken).toHaveBeenCalledWith(refreshToken)
  })

  it('should handle refresh timer', async () => {
    const mockToken = 'mock-token'
    const refreshToken = 'refresh-token'

    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'bakery-auth-token') return mockToken
      if (key === 'bakery-refresh-token') return refreshToken
      return null
    })

    mockBakeryAPI.getCurrentUser.mockResolvedValue(mockUser)
    mockBakeryAPI.refreshToken.mockResolvedValue({
      token: 'refreshed-token',
      refreshToken: 'new-refresh-token',
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider enableAutoRefresh refreshThreshold={60000}>
          {children}
        </AuthProvider>
      ),
    })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
    })

    // Fast-forward time to trigger refresh
    act(() => {
      jest.advanceTimersByTime(65000) // 65 seconds
    })

    await waitFor(() => {
      expect(mockBakeryAPI.refreshToken).toHaveBeenCalled()
    })
  })

  it('should update user profile', async () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'bakery-auth-token') return 'token'
      return null
    })
    mockBakeryAPI.getCurrentUser.mockResolvedValue(mockUser)

    const updatedUser = { ...mockUser, firstName: 'Updated' }
    mockBakeryAPI.updateUser.mockResolvedValue(updatedUser)

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    const updateData = { firstName: 'Updated' }
    await act(async () => {
      await result.current.updateProfile(updateData)
    })

    expect(mockBakeryAPI.updateUser).toHaveBeenCalledWith(
      mockUser.id,
      updateData
    )
    expect(result.current.user).toEqual(updatedUser)
  })

  it('should handle session timeout', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider sessionTimeout={30000}>{children}</AuthProvider>
      ),
    })

    // Setup authenticated state
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'bakery-auth-token') return 'token'
      return null
    })
    mockBakeryAPI.getCurrentUser.mockResolvedValue(mockUser)

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
    })

    // Fast-forward past session timeout
    act(() => {
      jest.advanceTimersByTime(35000) // 35 seconds
    })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })
  })

  it('should clear session on invalid token during initialization', async () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'bakery-auth-token') return 'invalid-token'
      return null
    })

    mockBakeryAPI.getCurrentUser.mockRejectedValue(new Error('Invalid token'))

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await waitFor(() => {
      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(false)
    })

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      'bakery-auth-token'
    )
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      'bakery-refresh-token'
    )
  })

  it('should throw error when useAuth is used outside provider', () => {
    const { result } = renderHook(() => useAuth())

    expect(() => result.current).toThrow(
      'useAuth must be used within an AuthProvider'
    )
  })

  describe('Role-based access', () => {
    it('should correctly identify customer role', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'bakery-auth-token') return 'customer-token'
        return null
      })
      mockBakeryAPI.getCurrentUser.mockResolvedValue(mockUser)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await waitFor(() => {
        expect(result.current.user?.role).toBe('customer')
        expect(result.current.hasPermission('customer')).toBe(true)
        expect(result.current.hasPermission('admin')).toBe(false)
      })
    })

    it('should correctly identify admin role', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'bakery-auth-token') return 'admin-token'
        return null
      })
      mockBakeryAPI.getCurrentUser.mockResolvedValue(mockAdminUser)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await waitFor(() => {
        expect(result.current.user?.role).toBe('admin')
        expect(result.current.hasPermission('admin')).toBe(true)
        expect(result.current.hasPermission('customer')).toBe(true) // Admin inherits customer permissions
      })
    })
  })
})
