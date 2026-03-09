/**
 * @fileoverview Bakery API Service - Mock API implementation for the bakery system
 */

import {
  Product,
  Order,
  OrderItem,
  CashEntry,
  ProductCategory,
  ProductType,
  ProductStatus,
  NotificationCategory,
} from '@bakery/shared/types'
import {
  SalesData,
  ProductionData,
  FinancialData,
  StaffData,
  StaffMember,
  StaffListResponse,
  StaffListParams,
  CustomerData,
  InventoryItem,
  TimeSeriesData,
  BakingListResponse,
  NotificationPreferences,
  NotificationTemplate,
  PreferencesResponse,
  TemplateResponse,
  SummaryData,
  TimeRange,
} from './types'
import { PRODUCTS } from '../mocks/products'

// Generate dynamic data from real products
const generateMockData = () => {
  const products = PRODUCTS

  // Add sales data
  const generateSalesData = (): SalesData[] => {
    const sales: SalesData[] = []
    const today = new Date()

    // Generate 60 days of sales data
    for (let i = 0; i < 60; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      // Generate 1-15 sales per day (more sales on weekend days)
      const dayOfWeek = date.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const salesCount =
        Math.floor(Math.random() * (isWeekend ? 15 : 10)) + (isWeekend ? 5 : 1)

      for (let j = 0; j < salesCount; j++) {
        // Select random product from real products
        const product = products[Math.floor(Math.random() * products.length)]
        const quantity = Math.floor(Math.random() * 5) + 1

        sales.push({
          id: parseInt(`${i}${j}`, 10), // Generate numeric ID
          date: dateStr,
          revenue: Number((product.price * quantity).toFixed(2)),
          unitsSold: quantity,
          avgOrderValue: product.price,
          product: product.name,
        })
      }
    }

    return sales
  }

  // Add production data based on real products
  const generateProductionData = (): ProductionData[] => {
    const production: ProductionData[] = []
    const today = new Date()

    // Generate 60 days of production data
    for (let i = 0; i < 60; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      // For different days, focus on different product categories
      // This makes it more realistic (e.g., bread is baked daily, cakes more on weekends)
      const dayOfWeek = date.getDay()

      // Filter products by category depending on day of week
      const dailyProductPool = products.filter((product) => {
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          // Weekends - focus on cakes, special products
          return [
            ProductCategory.Cakes,
            ProductCategory.SpecialCakes,
            ProductCategory.Pastries,
          ].includes(product.category)
        } else if (dayOfWeek === 1 || dayOfWeek === 4) {
          // Monday & Thursday - bread day
          return [ProductCategory.Bread, ProductCategory.Buns].includes(
            product.category
          )
        } else {
          // Regular days - mix of everything
          return true
        }
      })

      // Generate production entries for 5-12 products per day
      const productsCount = Math.floor(Math.random() * 8) + 5
      const selectedProducts = [
        ...(dailyProductPool.length > 0 ? dailyProductPool : products),
      ]
        .sort(() => 0.5 - Math.random())
        .slice(
          0,
          Math.min(productsCount, dailyProductPool.length || products.length)
        )

      selectedProducts.forEach((product, index) => {
        // Calculate production quantity based on product category
        let baseQuantity = 15
        if (product.category === ProductCategory.Bread) baseQuantity = 30
        if (product.category === ProductCategory.Buns) baseQuantity = 60
        if (
          product.category === ProductCategory.Cakes ||
          product.category === ProductCategory.SpecialCakes
        )
          baseQuantity = 8

        const planned = Math.floor(Math.random() * baseQuantity) + baseQuantity
        const actual = Math.floor(planned * (0.85 + Math.random() * 0.15))
        const waste = Math.floor(actual * (Math.random() * 0.1 + 0.05))

        production.push({
          id: parseInt(`${i}${index}`, 10), // Generate numeric ID
          product: product.name,
          planned: planned,
          actual: actual,
          waste: waste,
          efficiency: Number((((actual - waste) / planned) * 100).toFixed(1)),
        })
      })
    }

    return production
  }

  // Add financial data
  const generateFinancialData = (): FinancialData[] => {
    const finances: FinancialData[] = []
    const today = new Date()

    // Generate 12 months of financial data
    for (let i = 0; i < 12; i++) {
      const date = new Date(today)
      date.setMonth(date.getMonth() - i)
      const period = date.toISOString().substring(0, 7) // YYYY-MM format

      const revenue = Math.round((Math.random() * 50000 + 30000) * 100) / 100
      const costs =
        Math.round(revenue * (0.6 + Math.random() * 0.2) * 100) / 100
      const profit = revenue - costs

      finances.push({
        id: i + 1,
        period: period,
        revenue: revenue,
        costs: costs,
        profit: profit,
        margin: Number(((profit / revenue) * 100).toFixed(1)),
      })
    }

    return finances
  }

  // Add inventory data specific to bakery ingredients
  const generateInventoryData = (): InventoryItem[] => {
    return [
      {
        id: '1',
        name: 'Mehl (Weizen)',
        quantity: 45,
        unit: 'kg',
        minQuantity: 20,
        maxQuantity: 100,
        supplier: 'Mühlenbäcker GmbH',
        lastRestocked: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: '2',
        name: 'Mehl (Roggen)',
        quantity: 32,
        unit: 'kg',
        minQuantity: 15,
        maxQuantity: 80,
        supplier: 'Mühlenbäcker GmbH',
        lastRestocked: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: '3',
        name: 'Zucker',
        quantity: 18,
        unit: 'kg',
        minQuantity: 10,
        maxQuantity: 50,
        supplier: 'Großhandel Süß GmbH',
        lastRestocked: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: '4',
        name: 'Butter',
        quantity: 9,
        unit: 'kg',
        minQuantity: 8,
        maxQuantity: 30,
        supplier: 'Molkerei Regional',
        lastRestocked: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: '5',
        name: 'Eier',
        quantity: 120,
        unit: 'Stück',
        minQuantity: 60,
        maxQuantity: 300,
        supplier: 'Bauernhof Meier',
        lastRestocked: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: '6',
        name: 'Milch',
        quantity: 15,
        unit: 'Liter',
        minQuantity: 10,
        maxQuantity: 40,
        supplier: 'Molkerei Regional',
        lastRestocked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: '7',
        name: 'Hefe',
        quantity: 3,
        unit: 'kg',
        minQuantity: 2,
        maxQuantity: 10,
        supplier: 'BäckereiZutaten AG',
        lastRestocked: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: '8',
        name: 'Schokolade',
        quantity: 5,
        unit: 'kg',
        minQuantity: 3,
        maxQuantity: 15,
        supplier: 'Schokoladerie Fein',
        lastRestocked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: '9',
        name: 'Sultaninen',
        quantity: 4,
        unit: 'kg',
        minQuantity: 2,
        maxQuantity: 10,
        supplier: 'Trockenfrüchte Import',
        lastRestocked: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: '10',
        name: 'Nüsse',
        quantity: 7,
        unit: 'kg',
        minQuantity: 5,
        maxQuantity: 20,
        supplier: 'Nuss-Zentrale',
        lastRestocked: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: '11',
        name: 'Sauerteig',
        quantity: 2,
        unit: 'kg',
        minQuantity: 1,
        maxQuantity: 5,
        supplier: 'Sauerteig-Manufaktur',
        lastRestocked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: '12',
        name: 'Salz',
        quantity: 10,
        unit: 'kg',
        minQuantity: 5,
        maxQuantity: 25,
        supplier: 'Großhandel Salz & Gewürze',
        lastRestocked: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
    ]
  }

  // Add staff data
  const generateStaffData = (): StaffData[] => {
    return [
      {
        id: '1',
        name: 'Max Müller',
        role: 'Bäckermeister',
        shift: 'Früh',
        performance: 95,
        hoursWorked: 168,
      },
      {
        id: '2',
        name: 'Anna Schmidt',
        role: 'Bäckermeister',
        shift: 'Früh',
        performance: 92,
        hoursWorked: 160,
      },
      {
        id: '3',
        name: 'Thomas Weber',
        role: 'Bäcker',
        shift: 'Früh',
        performance: 87,
        hoursWorked: 160,
      },
      {
        id: '4',
        name: 'Lisa Becker',
        role: 'Konditorin',
        shift: 'Tag',
        performance: 93,
        hoursWorked: 152,
      },
      {
        id: '5',
        name: 'Julia Klein',
        role: 'Verkauf',
        shift: 'Tag',
        performance: 90,
        hoursWorked: 140,
      },
      {
        id: '6',
        name: 'David Wagner',
        role: 'Verkauf',
        shift: 'Spät',
        performance: 85,
        hoursWorked: 142,
      },
      {
        id: '7',
        name: 'Sophie Hoffmann',
        role: 'Geschäftsführung',
        shift: 'Tag',
        performance: 98,
        hoursWorked: 170,
      },
    ]
  }

  // Add customer data
  const generateCustomerData = (): CustomerData[] => {
    return [
      {
        id: '1',
        name: 'Cafe Sonnenblick',
        email: 'info@cafe-sonnenblick.de',
        totalOrders: 35,
        totalSpent: 1250.45,
        lastOrderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        segment: 'regular',
      },
      {
        id: '2',
        name: 'Hotel Bergblick',
        email: 'bestellung@hotel-bergblick.de',
        totalOrders: 42,
        totalSpent: 3820.75,
        lastOrderDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        segment: 'vip',
      },
      {
        id: '3',
        name: 'Johanna Meyer',
        email: 'j.meyer@email.de',
        totalOrders: 28,
        totalSpent: 342.5,
        lastOrderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        segment: 'regular',
      },
      {
        id: '4',
        name: 'Peter Fischer',
        email: 'p.fischer@web.de',
        totalOrders: 15,
        totalSpent: 189.25,
        lastOrderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        segment: 'regular',
      },
      {
        id: '5',
        name: 'Restaurant Seehof',
        email: 'kueche@restaurant-seehof.de',
        totalOrders: 31,
        totalSpent: 2750.8,
        lastOrderDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        segment: 'vip',
      },
      {
        id: '6',
        name: 'Maria Schulz',
        email: 'm.schulz@gmail.com',
        totalOrders: 12,
        totalSpent: 98.0,
        lastOrderDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        segment: 'new',
      },
    ]
  }

  return {
    sales: generateSalesData(),
    production: generateProductionData(),
    finances: generateFinancialData(),
    inventory: generateInventoryData(),
    staff: generateStaffData(),
    customers: generateCustomerData(),
  }
}

// Initialize mock data
const mockData = generateMockData()

// Staff management mock data (user-management schema, separate from analytics StaffData)
let staffManagementData: StaffMember[] = [
  {
    id: 1,
    username: 'mmueller',
    email: 'max.mueller@baeckerei.de',
    firstName: 'Max',
    lastName: 'Müller',
    role: 'admin',
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    username: 'aschmidt',
    email: 'anna.schmidt@baeckerei.de',
    firstName: 'Anna',
    lastName: 'Schmidt',
    role: 'staff',
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: '2024-02-15T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    username: 'tweber',
    email: 'thomas.weber@baeckerei.de',
    firstName: 'Thomas',
    lastName: 'Weber',
    role: 'staff',
    isActive: true,
    lastLogin: null,
    createdAt: '2024-03-10T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    username: 'lbecker',
    email: 'lisa.becker@baeckerei.de',
    firstName: 'Lisa',
    lastName: 'Becker',
    role: 'staff',
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: '2024-04-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 5,
    username: 'jklein',
    email: 'julia.klein@baeckerei.de',
    firstName: 'Julia',
    lastName: 'Klein',
    role: 'user',
    isActive: false,
    lastLogin: null,
    createdAt: '2024-05-20T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
]

/**
 * Bakery API Service
 * Provides a mock API implementation for the bakery system
 */
export const bakeryAPI = {
  /**
   * Product Operations
   */
  products: {
    async getAll(): Promise<Product[]> {
      return Promise.resolve(PRODUCTS)
    },

    async getById(id: number): Promise<Product | null> {
      const product = PRODUCTS.find((p) => p.id === id)
      return Promise.resolve(product || null)
    },

    async create(
      product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<Product> {
      const newProduct: Product = {
        ...product,
        id: Math.max(...PRODUCTS.map((p) => p.id)) + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      PRODUCTS.push(newProduct)
      return Promise.resolve(newProduct)
    },

    async update(
      id: number,
      updates: Partial<Product>
    ): Promise<Product | null> {
      const index = PRODUCTS.findIndex((p) => p.id === id)
      if (index === -1) return null

      PRODUCTS[index] = {
        ...PRODUCTS[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      return Promise.resolve(PRODUCTS[index])
    },

    async delete(id: number): Promise<boolean> {
      const index = PRODUCTS.findIndex((p) => p.id === id)
      if (index === -1) return false

      PRODUCTS.splice(index, 1)
      return Promise.resolve(true)
    },
  },

  /**
   * Order Operations
   */
  orders: {
    async getAll(): Promise<Order[]> {
      // Generate mock orders
      const orders: Order[] = []
      const customerNames = ['Max Müller', 'Anna Schmidt', 'Peter Weber']

      for (let i = 1; i <= 10; i++) {
        const items: OrderItem[] = []
        const itemCount = Math.floor(Math.random() * 4) + 1

        for (let j = 0; j < itemCount; j++) {
          const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)]
          const quantity = Math.floor(Math.random() * 3) + 1
          items.push({
            id: parseInt(`${i}${j}`),
            orderId: i,
            productId: product.id,
            quantity: quantity,
            unitPrice: product.price,
            totalPrice: product.price * quantity,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as OrderItem)
        }

        orders.push({
          id: i,
          customerName:
            customerNames[Math.floor(Math.random() * customerNames.length)],
          items: items,
          total: items.reduce((sum, item) => sum + item.totalPrice, 0),
          status: ['pending', 'processing', 'completed'][
            Math.floor(Math.random() * 3)
          ] as Order['status'],
          createdAt: new Date(
            Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
          updatedAt: new Date().toISOString(),
        } as Order)
      }

      return Promise.resolve(orders)
    },

    async getById(id: number): Promise<Order | null> {
      const orders = await this.getAll()
      return orders.find((o) => o.id === id) || null
    },

    async create(
      order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<Order> {
      const newOrder: Order = {
        ...order,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Order
      return Promise.resolve(newOrder)
    },

    async update(id: number, updates: Partial<Order>): Promise<Order | null> {
      const order = await this.getById(id)
      if (!order) return null

      return Promise.resolve({
        ...order,
        ...updates,
        updatedAt: new Date().toISOString(),
      })
    },
  },

  /**
   * Analytics Operations
   */
  analytics: {
    async getSalesData(range: TimeRange = 'month'): Promise<SalesData[]> {
      const days =
        range === 'today'
          ? 1
          : range === 'week'
          ? 7
          : range === 'month'
          ? 30
          : 365
      return Promise.resolve(mockData.sales.slice(0, days))
    },

    async getProductionData(
      range: TimeRange = 'month'
    ): Promise<ProductionData[]> {
      const days =
        range === 'today'
          ? 1
          : range === 'week'
          ? 7
          : range === 'month'
          ? 30
          : 365
      return Promise.resolve(mockData.production.slice(0, days))
    },

    async getFinancialData(
      range: TimeRange = 'year'
    ): Promise<FinancialData[]> {
      const months = range === 'month' ? 1 : range === 'quarter' ? 3 : 12
      return Promise.resolve(mockData.finances.slice(0, months))
    },

    async getSummaryData(): Promise<SummaryData> {
      const currentRevenue = mockData.sales
        .slice(0, 30)
        .reduce((sum, s) => sum + s.revenue, 0)
      const previousRevenue = mockData.sales
        .slice(30, 60)
        .reduce((sum, s) => sum + s.revenue, 0)

      return Promise.resolve({
        revenue: {
          current: currentRevenue,
          previous: previousRevenue,
          change: ((currentRevenue - previousRevenue) / previousRevenue) * 100,
        },
        orders: {
          current: mockData.sales.slice(0, 30).length,
          previous: mockData.sales.slice(30, 60).length,
          change:
            ((mockData.sales.slice(0, 30).length -
              mockData.sales.slice(30, 60).length) /
              mockData.sales.slice(30, 60).length) *
            100,
        },
        customers: {
          current: mockData.customers.length,
          previous: mockData.customers.length - 1,
          change: (1 / (mockData.customers.length - 1)) * 100,
        },
        averageOrderValue: {
          current: currentRevenue / mockData.sales.slice(0, 30).length,
          previous: previousRevenue / mockData.sales.slice(30, 60).length,
          change: 0,
        },
      })
    },
  },

  /**
   * Inventory Operations
   */
  inventory: {
    async getAll(): Promise<InventoryItem[]> {
      return Promise.resolve(mockData.inventory)
    },

    async getById(id: string): Promise<InventoryItem | null> {
      const item = mockData.inventory.find((i) => i.id === id)
      return Promise.resolve(item || null)
    },

    async update(
      id: string,
      updates: Partial<InventoryItem>
    ): Promise<InventoryItem | null> {
      const index = mockData.inventory.findIndex((i) => i.id === id)
      if (index === -1) return null

      mockData.inventory[index] = {
        ...mockData.inventory[index],
        ...updates,
      }
      return Promise.resolve(mockData.inventory[index])
    },
  },

  /**
   * Staff Operations
   */
  staff: {
    async getAll(): Promise<StaffData[]> {
      return Promise.resolve(mockData.staff)
    },

    async getById(id: string): Promise<StaffData | null> {
      const staff = mockData.staff.find((s) => s.id === id)
      return Promise.resolve(staff || null)
    },
  },

  /**
   * Customer Operations
   */
  customers: {
    async getAll(): Promise<CustomerData[]> {
      return Promise.resolve(mockData.customers)
    },

    async getById(id: string): Promise<CustomerData | null> {
      const customer = mockData.customers.find((c) => c.id === id)
      return Promise.resolve(customer || null)
    },
  },

  /**
   * Baking List Operations
   */
  bakingList: {
    async getForDate(date: string): Promise<BakingListResponse> {
      const items = PRODUCTS.filter(
        (p) => p.status === ProductStatus.Available
      ).map((product) => ({
        product,
        quantity: Math.floor(Math.random() * 20) + 5,
        status: ['pending', 'in_progress', 'completed'][
          Math.floor(Math.random() * 3)
        ] as 'pending' | 'in_progress' | 'completed',
      }))

      return Promise.resolve({
        date,
        items,
        totalItems: items.length,
        completedItems: items.filter((i) => i.status === 'completed').length,
      })
    },
  },

  /**
   * Notification Operations
   */
  notifications: {
    async getPreferences(userId: string): Promise<PreferencesResponse> {
      return Promise.resolve({
        success: true,
        data: {
          userId,
          channels: {
            push: {
              enabled: false,
              categories: ['order', 'inventory'],
              minPriority: 'medium' as const,
            },
            email: {
              enabled: true,
              categories: ['order', 'inventory'],
              minPriority: 'low' as const,
            },
            inApp: {
              enabled: true,
              categories: ['order', 'inventory', 'system'],
              minPriority: 'low' as const,
            },
            sms: {
              enabled: false,
              categories: ['order', 'system'] as NotificationCategory[],
              minPriority: 'urgent' as const,
            },
          },
          sound: {
            enabled: true,
            volume: 75,
          },
          digest: {
            enabled: true,
            frequency: 'daily',
            time: '09:00',
            categories: ['order', 'inventory'],
          },
          language: 'de',
          updatedAt: new Date(),
        } as NotificationPreferences,
      })
    },

    async updatePreferences(
      userId: string,
      preferences: Partial<NotificationPreferences>
    ): Promise<PreferencesResponse> {
      return Promise.resolve({
        success: true,
        data: {
          userId,
          channels: {
            push: {
              enabled: false,
              categories: ['order', 'inventory'],
              minPriority: 'medium' as const,
            },
            email: {
              enabled: true,
              categories: ['order', 'inventory'],
              minPriority: 'low' as const,
            },
            inApp: {
              enabled: true,
              categories: ['order', 'inventory', 'system'],
              minPriority: 'low' as const,
            },
            sms: {
              enabled: false,
              categories: ['order', 'system'] as NotificationCategory[],
              minPriority: 'urgent' as const,
            },
          },
          sound: {
            enabled: true,
            volume: 75,
          },
          digest: {
            enabled: true,
            frequency: 'daily',
            time: '09:00',
            categories: ['order', 'inventory'],
          },
          language: 'de',
          ...preferences,
          updatedAt: new Date(),
        } as NotificationPreferences,
      })
    },

    async getTemplates(): Promise<TemplateResponse> {
      return Promise.resolve({
        success: true,
        data: [
          {
            id: '1',
            name: 'Order Confirmation',
            description: 'Sent when an order is confirmed',
            subject: 'Your order has been confirmed',
            body: 'Thank you for your order!',
            category: 'order',
            priority: 'high',
            variables: ['orderNumber', 'customerName'],
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ] as NotificationTemplate[],
      })
    },
  },

  /**
   * Staff Management Operations (user-management CRUD)
   */
  async getStaff(params?: StaffListParams): Promise<StaffListResponse> {
    const { page = 1, limit = 10, search, role, isActive } = params || {}
    let filtered = [...staffManagementData]

    if (search) {
      const s = search.toLowerCase()
      filtered = filtered.filter(
        (u) =>
          u.firstName.toLowerCase().includes(s) ||
          u.lastName.toLowerCase().includes(s) ||
          u.email.toLowerCase().includes(s) ||
          u.username.toLowerCase().includes(s)
      )
    }

    if (role) filtered = filtered.filter((u) => u.role === role)
    if (isActive !== undefined)
      filtered = filtered.filter((u) => u.isActive === isActive)

    const start = (page - 1) * limit

    return Promise.resolve({
      users: filtered.slice(start, start + limit),
      pagination: {
        totalItems: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
        currentPage: page,
        itemsPerPage: limit,
      },
    })
  },

  async createStaff(
    data: Omit<
      StaffMember,
      'id' | 'isActive' | 'lastLogin' | 'createdAt' | 'updatedAt'
    >
  ): Promise<StaffMember> {
    const newMember: StaffMember = {
      id:
        staffManagementData.length > 0
          ? Math.max(...staffManagementData.map((s) => s.id)) + 1
          : 1,
      username: data.username,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || 'staff',
      isActive: true,
      lastLogin: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    staffManagementData.push(newMember)
    return Promise.resolve(newMember)
  },

  async updateStaff(
    id: number,
    data: Partial<Omit<StaffMember, 'id' | 'createdAt'>>
  ): Promise<StaffMember> {
    const index = staffManagementData.findIndex((s) => s.id === id)
    if (index === -1) throw new Error('Mitarbeiter nicht gefunden')

    const { ...updateFields } = data
    staffManagementData[index] = {
      ...staffManagementData[index],
      ...updateFields,
      updatedAt: new Date().toISOString(),
    }
    return Promise.resolve(staffManagementData[index])
  },

  async deleteStaff(id: number): Promise<{ message: string }> {
    const index = staffManagementData.findIndex((s) => s.id === id)
    if (index === -1) throw new Error('Mitarbeiter nicht gefunden')

    staffManagementData[index].isActive = false
    staffManagementData[index].updatedAt = new Date().toISOString()
    return Promise.resolve({ message: 'Mitarbeiter deaktiviert' })
  },

  /**
   * Cash Management Operations
   */
  async getCashHistory(): Promise<CashEntry[]> {
    const today = new Date()
    const entries: CashEntry[] = []
    for (let i = 0; i < 30; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      entries.push({
        id: i + 1,
        UserId: 1,
        amount: Math.round((Math.random() * 800 + 200) * 100) / 100,
        date: date.toISOString().split('T')[0],
        createdAt: date.toISOString(),
        updatedAt: date.toISOString(),
      })
    }
    return Promise.resolve(entries)
  },

  async addCashEntry(amount: number): Promise<CashEntry> {
    const now = new Date()
    return Promise.resolve({
      id: Date.now(),
      UserId: 1,
      amount,
      date: now.toISOString().split('T')[0],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
  },

  async updateCashEntry(
    id: number,
    amount: number,
    date: string
  ): Promise<CashEntry> {
    const now = new Date()
    return Promise.resolve({
      id,
      UserId: 1,
      amount,
      date,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
  },

  async deleteCashEntry(id: number): Promise<boolean> {
    return Promise.resolve(true)
  },
}

// Export default for backward compatibility
export default bakeryAPI
