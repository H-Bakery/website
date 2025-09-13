/**
 * @fileoverview Mock user data
 * @module @bakery/shared/data-mocks/users
 */

import { User, UserRole, Staff } from '@bakery/shared/types'
import { hashPassword } from '@bakery/shared/utils'

// Extended interface for mock users with additional testing properties
interface MockUser extends User {
  username?: string // Keep for backwards compatibility in tests
  department?: string
  shift?: string
  vehicleId?: string
  customerId?: string
  loyaltyPoints?: number
  deactivatedAt?: string
  deactivationReason?: string
}

// Helper to create Staff users with permissions
const createStaffUser = (
  user: Omit<Staff, 'permissions'>,
  permissions?: any[]
): MockUser => {
  return {
    ...user,
    permissions: permissions || [],
  } as any
}

// Mock users with different roles
export const MOCK_USERS: MockUser[] = [
  {
    id: 1,
    username: 'admin', // Keep for test compatibility
    email: 'admin@bakery.com',
    role: UserRole.Admin,
    firstName: 'Admin',
    lastName: 'User',
    isActive: true,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    lastLogin: '2024-01-20T00:00:00.000Z',
    preferences: {
      theme: 'dark',
      language: 'de',
      notifications: true,
      newsletter: false,
    },
  },
  {
    id: 2,
    username: 'manager',
    email: 'manager@bakery.com',
    role: UserRole.Manager,
    firstName: 'Max',
    lastName: 'Müller',
    isActive: true,
    createdAt: '2023-02-15T00:00:00.000Z',
    updatedAt: '2024-01-18T00:00:00.000Z',
    lastLogin: '2024-01-19T00:00:00.000Z',
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: true,
      newsletter: true,
    },
  },
  {
    id: 3,
    username: 'baker1',
    email: 'thomas.weber@bakery.com',
    role: UserRole.Staff,
    firstName: 'Thomas',
    lastName: 'Weber',
    isActive: true,
    createdAt: '2023-03-20T00:00:00.000Z',
    updatedAt: '2024-01-10T00:00:00.000Z',
    lastLogin: '2024-01-20T00:00:00.000Z',
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: true,
      newsletter: false,
    },
    department: 'Produktion',
    shift: 'Frühschicht',
  },
  {
    id: 4,
    username: 'baker2',
    email: 'anna.schmidt@bakery.com',
    role: UserRole.Staff,
    firstName: 'Anna',
    lastName: 'Schmidt',
    isActive: true,
    createdAt: '2023-04-10T00:00:00.000Z',
    updatedAt: '2024-01-12T00:00:00.000Z',
    lastLogin: '2024-01-19T00:00:00.000Z',
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: true,
      newsletter: true,
    },
    department: 'Produktion',
    shift: 'Spätschicht',
  },
  {
    id: 5,
    username: 'cashier1',
    email: 'lisa.becker@bakery.com',
    role: UserRole.Staff,
    firstName: 'Lisa',
    lastName: 'Becker',
    isActive: true,
    createdAt: '2023-05-01T00:00:00.000Z',
    updatedAt: '2024-01-16T00:00:00.000Z',
    lastLogin: '2024-01-20T00:00:00.000Z',
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: true,
      newsletter: false,
    },
    department: 'Verkauf',
  },
  {
    id: 6,
    username: 'delivery1',
    email: 'markus.wagner@bakery.com',
    role: UserRole.Staff,
    firstName: 'Markus',
    lastName: 'Wagner',
    isActive: true,
    createdAt: '2023-06-15T00:00:00.000Z',
    updatedAt: '2024-01-14T00:00:00.000Z',
    lastLogin: '2024-01-19T00:00:00.000Z',
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: true,
      newsletter: false,
    },
    department: 'Lieferung',
    vehicleId: 'BAK-001',
  },
  {
    id: 7,
    username: 'customer1',
    email: 'kunde@example.com',
    role: UserRole.Customer,
    firstName: 'Peter',
    lastName: 'Klein',
    isActive: true,
    createdAt: '2023-07-20T00:00:00.000Z',
    updatedAt: '2024-01-05T00:00:00.000Z',
    lastLogin: '2024-01-18T00:00:00.000Z',
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: true,
      newsletter: true,
    },
    customerId: 'CUST-001',
    loyaltyPoints: 150,
  },
  {
    id: 8,
    username: 'inactive_user',
    email: 'inactive@bakery.com',
    role: UserRole.Staff,
    firstName: 'Hans',
    lastName: 'Meier',
    isActive: false,
    createdAt: '2023-01-15T00:00:00.000Z',
    updatedAt: '2023-12-01T00:00:00.000Z',
    lastLogin: '2023-11-30T00:00:00.000Z',
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: false,
      newsletter: false,
    },
    deactivatedAt: '2023-12-01T00:00:00.000Z',
    deactivationReason: 'Mitarbeiter ausgeschieden',
  },
]

// Mock user credentials (for testing)
export const MOCK_CREDENTIALS = [
  { username: 'admin', password: 'admin123' },
  { username: 'manager', password: 'manager123' },
  { username: 'baker1', password: 'baker123' },
  { username: 'cashier1', password: 'cashier123' },
  { username: 'delivery1', password: 'delivery123' },
  { username: 'customer1', password: 'customer123' },
]

// Helper functions
export const getUserById = (id: number): MockUser | undefined => {
  return MOCK_USERS.find((user) => user.id === id)
}

export const getUserByUsername = (username: string): MockUser | undefined => {
  return MOCK_USERS.find((user) => user.username === username)
}

export const getUserByEmail = (email: string): MockUser | undefined => {
  return MOCK_USERS.find((user) => user.email === email)
}

export const getUsersByRole = (role: UserRole): MockUser[] => {
  return MOCK_USERS.filter((user) => user.role === role)
}

export const getActiveUsers = (): MockUser[] => {
  return MOCK_USERS.filter((user) => user.isActive)
}

export const authenticateUser = async (
  username: string,
  password: string
): Promise<MockUser | null> => {
  const credentials = MOCK_CREDENTIALS.find(
    (cred) => cred.username === username
  )
  if (!credentials) return null

  // In production, compare hashed passwords
  // For mock data, we'll do a simple comparison
  if (credentials.password === password) {
    const user = getUserByUsername(username)
    if (user && user.isActive) {
      // Update last login
      user.lastLogin = new Date().toISOString()
      return user
    }
  }

  return null
}

// Mock JWT token generation
export const generateMockToken = (user: MockUser): string => {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  }

  // In production, this would be a real JWT
  return btoa(JSON.stringify(payload))
}

// Mock refresh token
export const generateMockRefreshToken = (user: MockUser): string => {
  const payload = {
    sub: user.id,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  }

  return btoa(JSON.stringify(payload))
}
