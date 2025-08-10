/**
 * @fileoverview Mock user data
 * @module @bakery/shared/data-mocks/users
 */

import { User, UserRole } from '@bakery/shared/types'
import { hashPassword } from '@bakery/shared/utils'

// Mock users with different roles
export const MOCK_USERS: User[] = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@bakery.com',
    role: 'admin' as UserRole,
    name: 'Administrator',
    isActive: true,
    permissions: ['all'], // Admin has all permissions
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2024-01-15'),
    lastLogin: new Date('2024-01-20'),
    preferences: {
      theme: 'dark',
      language: 'de',
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
    },
  },
  {
    id: 2,
    username: 'manager',
    email: 'manager@bakery.com',
    role: 'manager' as UserRole,
    name: 'Max Müller',
    isActive: true,
    permissions: [
      'products.read',
      'products.write',
      'orders.read',
      'orders.write',
      'cash.read',
      'inventory.read',
      'inventory.write',
      'reports.read',
    ],
    createdAt: new Date('2023-02-15'),
    updatedAt: new Date('2024-01-18'),
    lastLogin: new Date('2024-01-19'),
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: {
        email: true,
        push: true,
        sms: true,
      },
    },
  },
  {
    id: 3,
    username: 'baker1',
    email: 'thomas.weber@bakery.com',
    role: 'baker' as UserRole,
    name: 'Thomas Weber',
    isActive: true,
    permissions: [
      'products.read',
      'orders.read',
      'inventory.read',
      'production.read',
      'production.write',
    ],
    createdAt: new Date('2023-03-20'),
    updatedAt: new Date('2024-01-10'),
    lastLogin: new Date('2024-01-20'),
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: {
        email: false,
        push: true,
        sms: false,
      },
    },
    department: 'Produktion',
    shift: 'Frühschicht',
  },
  {
    id: 4,
    username: 'baker2',
    email: 'anna.schmidt@bakery.com',
    role: 'baker' as UserRole,
    name: 'Anna Schmidt',
    isActive: true,
    permissions: [
      'products.read',
      'orders.read',
      'inventory.read',
      'production.read',
      'production.write',
    ],
    createdAt: new Date('2023-04-10'),
    updatedAt: new Date('2024-01-12'),
    lastLogin: new Date('2024-01-19'),
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
    },
    department: 'Produktion',
    shift: 'Spätschicht',
  },
  {
    id: 5,
    username: 'cashier1',
    email: 'lisa.becker@bakery.com',
    role: 'cashier' as UserRole,
    name: 'Lisa Becker',
    isActive: true,
    permissions: [
      'products.read',
      'orders.read',
      'orders.create',
      'cash.read',
      'cash.write',
      'customer.read',
    ],
    createdAt: new Date('2023-05-01'),
    updatedAt: new Date('2024-01-16'),
    lastLogin: new Date('2024-01-20'),
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: {
        email: true,
        push: false,
        sms: false,
      },
    },
    department: 'Verkauf',
  },
  {
    id: 6,
    username: 'delivery1',
    email: 'markus.wagner@bakery.com',
    role: 'delivery' as UserRole,
    name: 'Markus Wagner',
    isActive: true,
    permissions: [
      'orders.read',
      'orders.update',
      'delivery.read',
      'delivery.write',
      'customer.read',
    ],
    createdAt: new Date('2023-06-15'),
    updatedAt: new Date('2024-01-14'),
    lastLogin: new Date('2024-01-19'),
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: {
        email: false,
        push: true,
        sms: true,
      },
    },
    department: 'Lieferung',
    vehicleId: 'BAK-001',
  },
  {
    id: 7,
    username: 'customer1',
    email: 'kunde@example.com',
    role: 'customer' as UserRole,
    name: 'Peter Klein',
    isActive: true,
    permissions: [
      'products.read',
      'orders.read.own',
      'orders.create',
      'profile.read.own',
      'profile.write.own',
    ],
    createdAt: new Date('2023-07-20'),
    updatedAt: new Date('2024-01-05'),
    lastLogin: new Date('2024-01-18'),
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: {
        email: true,
        push: false,
        sms: false,
      },
    },
    customerId: 'CUST-001',
    loyaltyPoints: 150,
  },
  {
    id: 8,
    username: 'inactive_user',
    email: 'inactive@bakery.com',
    role: 'baker' as UserRole,
    name: 'Hans Meier',
    isActive: false,
    permissions: [],
    createdAt: new Date('2023-01-15'),
    updatedAt: new Date('2023-12-01'),
    lastLogin: new Date('2023-11-30'),
    preferences: {
      theme: 'light',
      language: 'de',
      notifications: {
        email: false,
        push: false,
        sms: false,
      },
    },
    deactivatedAt: new Date('2023-12-01'),
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
export const getUserById = (id: number): User | undefined => {
  return MOCK_USERS.find((user) => user.id === id)
}

export const getUserByUsername = (username: string): User | undefined => {
  return MOCK_USERS.find((user) => user.username === username)
}

export const getUserByEmail = (email: string): User | undefined => {
  return MOCK_USERS.find((user) => user.email === email)
}

export const getUsersByRole = (role: UserRole): User[] => {
  return MOCK_USERS.filter((user) => user.role === role)
}

export const getActiveUsers = (): User[] => {
  return MOCK_USERS.filter((user) => user.isActive)
}

export const authenticateUser = async (
  username: string,
  password: string
): Promise<User | null> => {
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
      user.lastLogin = new Date()
      return user
    }
  }

  return null
}

// Mock JWT token generation
export const generateMockToken = (user: User): string => {
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    permissions: user.permissions,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  }

  // In production, this would be a real JWT
  return btoa(JSON.stringify(payload))
}

// Mock refresh token
export const generateMockRefreshToken = (user: User): string => {
  const payload = {
    sub: user.id,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  }

  return btoa(JSON.stringify(payload))
}
