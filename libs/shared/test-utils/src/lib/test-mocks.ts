import { Product, User, Order, OrderItem } from '@bakery/shared/types'

/**
 * Mock localStorage implementation for testing
 */
export const createMockLocalStorage = () => {
  let store: Record<string, string> = {}

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  }
}

/**
 * Mock sessionStorage implementation for testing
 */
export const createMockSessionStorage = () => createMockLocalStorage()

/**
 * Mock bakery API responses
 */
export const mockApiResponses = {
  products: [
    {
      id: 1,
      name: 'Classic Croissant',
      price: 2.5,
      category: 'Pastries',
      description: 'Buttery, flaky croissant',
      image: '/images/croissant.jpg',
      available: true,
      stock: 50,
    },
    {
      id: 2,
      name: 'Sourdough Bread',
      price: 4.0,
      category: 'Bread',
      description: 'Artisan sourdough bread',
      image: '/images/sourdough.jpg',
      available: true,
      stock: 25,
    },
  ] as Product[],

  orders: [
    {
      id: 1,
      customerId: 1,
      items: [
        {
          id: 1,
          productId: 1,
          quantity: 2,
          price: 2.5,
          total: 5.0,
        },
      ] as OrderItem[],
      total: 5.0,
      status: 'pending',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:00:00Z'),
    },
  ] as Order[],

  users: [
    {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'customer',
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    },
  ] as User[],
}

/**
 * Mock API service functions
 */
export const mockBakeryAPI = {
  getProducts: jest.fn().mockResolvedValue(mockApiResponses.products),
  getProduct: jest
    .fn()
    .mockImplementation((id: number) =>
      Promise.resolve(mockApiResponses.products.find((p) => p.id === id))
    ),
  getOrders: jest.fn().mockResolvedValue(mockApiResponses.orders),
  createOrder: jest.fn().mockImplementation((orderData) =>
    Promise.resolve({
      id: Date.now(),
      ...orderData,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  ),
  getUsers: jest.fn().mockResolvedValue(mockApiResponses.users),
  login: jest.fn().mockResolvedValue({
    token: 'mock-jwt-token',
    user: mockApiResponses.users[0],
  }),
}

/**
 * Mock React Router navigation
 */
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
}

/**
 * Mock Next.js navigation
 */
export const mockNextNavigation = {
  useRouter: () => mockRouter,
  useSearchParams: () => ({
    get: jest.fn(),
    has: jest.fn(),
    getAll: jest.fn(),
  }),
  usePathname: () => '/',
}

/**
 * Mock form validation helpers
 */
export const mockFormValidation = {
  validateEmail: jest.fn().mockReturnValue(true),
  validatePassword: jest.fn().mockReturnValue(true),
  validatePhone: jest.fn().mockReturnValue(true),
  validateRequired: jest.fn().mockReturnValue(true),
}

/**
 * Mock window.matchMedia for responsive testing
 */
export const mockMatchMedia = (matches: boolean = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

/**
 * Mock IntersectionObserver for component visibility testing
 */
export const mockIntersectionObserver = () => {
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }))
}

/**
 * Mock ResizeObserver for responsive component testing
 */
export const mockResizeObserver = () => {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }))
}

/**
 * Setup all common mocks for testing
 */
export const setupTestMocks = () => {
  // Setup storage mocks
  Object.defineProperty(window, 'localStorage', {
    value: createMockLocalStorage(),
  })

  Object.defineProperty(window, 'sessionStorage', {
    value: createMockSessionStorage(),
  })

  // Setup browser API mocks
  mockMatchMedia()
  mockIntersectionObserver()
  mockResizeObserver()

  // Mock scroll methods
  Element.prototype.scrollIntoView = jest.fn()
  window.scrollTo = jest.fn()

  // Mock console methods to reduce noise in tests
  global.console.warn = jest.fn()
  global.console.error = jest.fn()
}
