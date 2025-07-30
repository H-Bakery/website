'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// Types for the authentication context
interface User {
  id: string
  username: string
  role?: string
  email?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
  error: string | null
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// AuthProvider props
interface AuthProviderProps {
  children: ReactNode
}

// AuthProvider component
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Check if user is authenticated
  const isAuthenticated = Boolean(user && token)

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const storedToken = localStorage.getItem('token')
        if (storedToken) {
          setToken(storedToken)
          // TODO: Optionally validate token with backend and get user info
          // For now, we'll consider any stored token as valid
          // In a full implementation, you'd want to verify the token
          setUser({ id: 'user', username: 'admin' }) // Placeholder user data
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        // Clear any invalid data
        localStorage.removeItem('token')
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()
  }, [])

  // Login function
  const login = async (username: string, password: string): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:5000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Login failed')
      }

      // Store token and user data
      const authToken = result.token
      const userData = result.user || { id: 'user', username }

      localStorage.setItem('token', authToken)
      setToken(authToken)
      setUser(userData)
    } catch (error: any) {
      setError(error.message || 'Failed to login. Please try again.')
      throw error // Re-throw to allow the login component to handle it
    } finally {
      setLoading(false)
    }
  }

  // Logout function
  const logout = (): void => {
    try {
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
      setError(null)
    } catch (error) {
      console.error('Error during logout:', error)
    }
  }

  // Context value
  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    login,
    logout,
    loading,
    error,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Custom hook to use the auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext