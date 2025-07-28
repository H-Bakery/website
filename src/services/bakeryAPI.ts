// src/services/bakeryAPI.ts
'use client'
import { Product } from '../types/product'
import {
  SalesData,
  ProductionData,
  FinancialData,
  StaffData,
  CustomerData,
  InventoryItem,
  TimeSeriesData,
  TimeRange,
  Order,
  BakingListResponse,
  SummaryData,
  CashEntry,
} from './types'

// Import real product data
import { PRODUCTS } from '../mocks/products'

const API_BASE_URL = 'http://localhost:5000'

// Generate mock data for development and testing
const generateMockData = () => {
  // Use real product data and enhance it with additional fields needed for dashboards
  const products: Product[] = PRODUCTS.map((product) => ({
    ...product,
    // Ensure image and description are present, falling back to defaults if necessary
    image: product.image || 'default_image_path.jpg', // Add a default image path
    description:
      product.description || `Frische ${product.name} aus unserer Bäckerei.`,
    // Add stock field (random amount)
    stock: Math.floor(Math.random() * 50) + 5,
    // Add dailyTarget field (random number between 10 and 50)
    dailyTarget: Math.floor(Math.random() * 41) + 10,
    // Add isActive field (randomly true or false)
    isActive: Math.random() < 0.5,
  }))

  // Add sales data based on real products
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
          id: `sale-${dateStr}-${j}`,
          date: dateStr,
          product_id: product.id,
          product_name: product.name,
          quantity: quantity,
          total: Number((product.price * quantity).toFixed(2)),
          payment_method: ['Bargeld', 'EC-Karte', 'Kreditkarte', 'PayPal'][
            Math.floor(Math.random() * 4)
          ],
        })
      }
    }

    return sales
  }

  // Add production data based on real products
  const generateProductionData = (): ProductionData[] => {
    const production: ProductionData[] = []
    const today = new Date()
    const staffNames = [
      'Max Müller',
      'Anna Schmidt',
      'Thomas Weber',
      'Lisa Becker',
    ]

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
          return ['Kuchen', 'Torte', 'Gebäck'].includes(product.category)
        } else if (dayOfWeek === 1 || dayOfWeek === 4) {
          // Monday & Thursday - bread day
          return ['Brot', 'Brötchen'].includes(product.category)
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
        if (product.category === 'Brot') baseQuantity = 30
        if (product.category === 'Brötchen') baseQuantity = 60
        if (product.category === 'Kuchen' || product.category === 'Torte')
          baseQuantity = 8

        const quantityProduced =
          Math.floor(Math.random() * baseQuantity) + baseQuantity

        // Waste is typically 5-15% of production
        const wasteRate = Math.random() * 0.1 + 0.05
        const waste = Math.floor(quantityProduced * wasteRate)

        production.push({
          id: `prod-${dateStr}-${index}`,
          date: dateStr,
          product_id: product.id,
          product_name: product.name,
          quantity_produced: quantityProduced,
          waste: waste,
          staff_name: staffNames[Math.floor(Math.random() * staffNames.length)],
        })
      })
    }

    return production
  }

  // Add financial data
  const generateFinancialData = (): FinancialData[] => {
    const finances: FinancialData[] = []
    const today = new Date()
    const categories = [
      'Einnahmen: Verkauf',
      'Einnahmen: Sonstiges',
      'Ausgaben: Zutaten',
      'Ausgaben: Personal',
      'Ausgaben: Miete',
      'Ausgaben: Energie',
      'Ausgaben: Sonstiges',
    ]

    // Generate 60 days of financial data
    for (let i = 0; i < 60; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      // Generate 2-5 financial entries per day
      const entriesCount = Math.floor(Math.random() * 4) + 2

      for (let j = 0; j < entriesCount; j++) {
        const category =
          categories[Math.floor(Math.random() * categories.length)]
        const isIncome = category.startsWith('Einnahmen')

        finances.push({
          id: `fin-${dateStr}-${j}`,
          date: dateStr,
          category: category,
          amount: isIncome
            ? Math.round((Math.random() * 500 + 50) * 100) / 100
            : (-1 * Math.round((Math.random() * 300 + 20) * 100)) / 100,
          description: isIncome ? 'Tagesumsatz' : 'Regelmäßige Ausgabe',
        })
      }
    }

    return finances
  }

  // Add inventory data specific to bakery ingredients
  const generateInventoryData = (): InventoryItem[] => {
    return [
      {
        id: 1,
        name: 'Mehl (Weizen)',
        quantity: 45,
        unit: 'kg',
        min_stock_level: 20,
        last_restocked: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 2,
        name: 'Mehl (Roggen)',
        quantity: 32,
        unit: 'kg',
        min_stock_level: 15,
        last_restocked: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 3,
        name: 'Zucker',
        quantity: 18,
        unit: 'kg',
        min_stock_level: 10,
        last_restocked: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 4,
        name: 'Butter',
        quantity: 9,
        unit: 'kg',
        min_stock_level: 8,
        last_restocked: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 5,
        name: 'Eier',
        quantity: 120,
        unit: 'Stück',
        min_stock_level: 60,
        last_restocked: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 6,
        name: 'Milch',
        quantity: 15,
        unit: 'Liter',
        min_stock_level: 10,
        last_restocked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 7,
        name: 'Hefe',
        quantity: 3,
        unit: 'kg',
        min_stock_level: 2,
        last_restocked: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 8,
        name: 'Schokolade',
        quantity: 5,
        unit: 'kg',
        min_stock_level: 3,
        last_restocked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 9,
        name: 'Sultaninen',
        quantity: 4,
        unit: 'kg',
        min_stock_level: 2,
        last_restocked: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 10,
        name: 'Nüsse',
        quantity: 7,
        unit: 'kg',
        min_stock_level: 5,
        last_restocked: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 11,
        name: 'Sauerteig',
        quantity: 2,
        unit: 'kg',
        min_stock_level: 1,
        last_restocked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 12,
        name: 'Salz',
        quantity: 10,
        unit: 'kg',
        min_stock_level: 5,
        last_restocked: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
    ]
  }

  // Add staff data
  const generateStaffData = (): StaffData[] => {
    return [
      {
        id: 1,
        name: 'Max Müller',
        role: 'Bäckermeister',
        productivity: 95,
        hours_worked: 168,
        salary: 4200,
      },
      {
        id: 2,
        name: 'Anna Schmidt',
        role: 'Bäckermeister',
        productivity: 92,
        hours_worked: 160,
        salary: 3900,
      },
      {
        id: 3,
        name: 'Thomas Weber',
        role: 'Bäcker',
        productivity: 87,
        hours_worked: 160,
        salary: 3400,
      },
      {
        id: 4,
        name: 'Lisa Becker',
        role: 'Konditorin',
        productivity: 93,
        hours_worked: 152,
        salary: 3600,
      },
      {
        id: 5,
        name: 'Julia Klein',
        role: 'Verkauf',
        productivity: 90,
        hours_worked: 140,
        salary: 2800,
      },
      {
        id: 6,
        name: 'David Wagner',
        role: 'Verkauf',
        productivity: 85,
        hours_worked: 142,
        salary: 2750,
      },
      {
        id: 7,
        name: 'Sophie Hoffmann',
        role: 'Geschäftsführung',
        productivity: 98,
        hours_worked: 170,
        salary: 5200,
      },
    ]
  }

  // Add customer data
  const generateCustomerData = (): CustomerData[] => {
    return [
      {
        id: 1,
        name: 'Cafe Sonnenblick',
        type: 'Business',
        total_spent: 1250.45,
        visits: 35,
        last_visit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 2,
        name: 'Hotel Bergblick',
        type: 'Business',
        total_spent: 3820.75,
        visits: 42,
        last_visit: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 3,
        name: 'Johanna Meyer',
        type: 'Individual',
        total_spent: 342.5,
        visits: 28,
        last_visit: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 4,
        name: 'Peter Fischer',
        type: 'Individual',
        total_spent: 189.25,
        visits: 15,
        last_visit: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 5,
        name: 'Restaurant Seehof',
        type: 'Business',
        total_spent: 2750.8,
        visits: 31,
        last_visit: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 6,
        name: 'Maria Schulz',
        type: 'Individual',
        total_spent: 415.3,
        visits: 32,
        last_visit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 7,
        name: 'Kindergarten Sonnenschein',
        type: 'Business',
        total_spent: 1875.2,
        visits: 25,
        last_visit: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 8,
        name: 'Klaus Becker',
        type: 'Individual',
        total_spent: 275.9,
        visits: 21,
        last_visit: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 9,
        name: 'Seniorenheim Waldblick',
        type: 'Business',
        total_spent: 3250.45,
        visits: 48,
        last_visit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 10,
        name: 'Sandra Müller',
        type: 'Individual',
        total_spent: 198.75,
        visits: 18,
        last_visit: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
    ]
  }

  const salesData = generateSalesData()
  const productionData = generateProductionData()
  const financialData = generateFinancialData()
  const inventoryData = generateInventoryData()
  const staffData = generateStaffData()
  const customerData = generateCustomerData()

  return {
    products,
    salesData,
    productionData,
    financialData,
    inventoryData,
    staffData,
    customerData,
  }
}

// Initialize mock data
const mockData = generateMockData()

// Helper function to filter data by date range
const filterByDateRange = (data: any[], range: TimeRange): any[] => {
  const today = new Date()
  let startDate = new Date(today)

  switch (range) {
    case 'day':
      startDate = new Date(today)
      break
    case 'week':
      startDate.setDate(today.getDate() - 7)
      break
    case 'month':
      startDate.setMonth(today.getMonth() - 1)
      break
    case 'year':
      startDate.setFullYear(today.getFullYear() - 1)
      break
  }

  const startDateStr = startDate.toISOString().split('T')[0]

  return data.filter((item) => item.date >= startDateStr)
}

// Generate time series data
const generateTimeSeriesData = (
  type: 'sales' | 'customers' | 'production' | 'waste',
  range: TimeRange
): TimeSeriesData[] => {
  const result: TimeSeriesData[] = []
  const today = new Date()
  let days: number

  switch (range) {
    case 'day':
      days = 1
      break
    case 'week':
      days = 7
      break
    case 'month':
      days = 30
      break
    case 'year':
      days = 365
      break
  }

  // For a day, we use hours instead of days
  if (range === 'day') {
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0')
      result.push({
        date: `${today.toISOString().split('T')[0]} ${hour}:00`,
        value: Math.floor(Math.random() * 50) + (type === 'waste' ? 0 : 10),
      })
    }
  } else {
    for (let i = 0; i < days; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      result.push({
        date: dateStr,
        value: Math.floor(Math.random() * 100) + (type === 'waste' ? 0 : 50),
      })
    }
  }

  // Sort by date ascending
  return result.sort((a, b) => a.date.localeCompare(b.date))
}

// Calculate summary metrics
const calculateSummary = (range: TimeRange): SummaryData => {
  // Filter data by time range
  const sales = filterByDateRange(mockData.salesData, range)
  const production = filterByDateRange(mockData.productionData, range)
  const finances = filterByDateRange(mockData.financialData, range)

  // Calculate totals
  const totalSales = sales.reduce((sum, item) => sum + item.total, 0)
  const totalItems = sales.reduce((sum, item) => sum + item.quantity, 0)
  const totalProduced = production.reduce(
    (sum, item) => sum + item.quantity_produced,
    0
  )
  const totalWaste = production.reduce((sum, item) => sum + item.waste, 0)

  const expenses = finances
    .filter((item) => item.amount < 0)
    .reduce((sum, item) => sum + Math.abs(item.amount), 0)

  const revenue = finances
    .filter((item) => item.amount > 0)
    .reduce((sum, item) => sum + item.amount, 0)

  // Calculate derived metrics
  const transactions = new Set(sales.map((item) => item.id.split('-')[1])).size
  const uniqueTransactions = new Set(
    sales.map((item) => item.id.split('-')[1] + '-' + item.id.split('-')[2])
  ).size
  const averageOrderValue = transactions > 0 ? totalSales / transactions : 0
  const wastageRate = totalProduced > 0 ? (totalWaste / totalProduced) * 100 : 0
  const profitMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0

  return {
    totalSales,
    totalItems,
    totalProduced,
    totalWaste,
    transactions,
    uniqueTransactions,
    expenses,
    revenue,
    profit: revenue - expenses,
    averageOrderValue,
    wastageRate,
    profitMargin,
  }
}

// API Service
const bakeryAPI = {
  // Get products
  getProducts: async (): Promise<Product[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/products`)
      if (!response.ok) {
        throw new Error('Failed to fetch products')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching products, using mock data:', error)
      // Fall back to mock data if API fails
      return mockData.products
    }
  },

  getProductById: async (id: number): Promise<Product> => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch product with id ${id}`)
      }
      return await response.json()
    } catch (error) {
      console.error(
        `Error fetching product with id ${id}, using mock data:`,
        error
      )
      // Fallback to mock data: find product by id
      const product = mockData.products.find((p) => p.id === id)
      if (product) {
        return product
      } else {
        throw new Error(`Mock product with id ${id} not found`)
      }
    }
  },

  createProduct: async (productData: Omit<Product, 'id'>): Promise<Product> => {
    try {
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      })
      if (!response.ok) {
        throw new Error('Failed to create product')
      }
      return await response.json()
    } catch (error) {
      console.error('Error creating product, using mock implementation:', error)
      // Mock implementation: add to mockData.products
      const newId =
        mockData.products.length > 0
          ? Math.max(...mockData.products.map((p) => p.id)) + 1
          : 1
      const newProduct: Product = { id: newId, ...productData }
      mockData.products.push(newProduct)
      return newProduct
    }
  },

  updateProduct: async (
    id: number,
    productData: Partial<Omit<Product, 'id'>>
  ): Promise<Product> => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      })
      if (!response.ok) {
        throw new Error(`Failed to update product with id ${id}`)
      }
      return await response.json()
    } catch (error) {
      console.error(
        `Error updating product with id ${id}, using mock implementation:`,
        error
      )
      // Mock implementation: update in mockData.products
      const productIndex = mockData.products.findIndex((p) => p.id === id)
      if (productIndex > -1) {
        mockData.products[productIndex] = {
          ...mockData.products[productIndex],
          ...productData,
        }
        return mockData.products[productIndex]
      } else {
        throw new Error(`Mock product with id ${id} not found for update`)
      }
    }
  },

  deleteProduct: async (id: number): Promise<{ message: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error(`Failed to delete product with id ${id}`)
      }
      return await response.json()
    } catch (error) {
      console.error(
        `Error deleting product with id ${id}, using mock implementation:`,
        error
      )
      // Mock implementation: remove from mockData.products
      const productIndex = mockData.products.findIndex((p) => p.id === id)
      if (productIndex > -1) {
        mockData.products.splice(productIndex, 1)
        return { message: `Product with id ${id} deleted successfully (mock)` }
      } else {
        throw new Error(`Mock product with id ${id} not found for deletion`)
      }
    }
  },

  // Orders
  getOrders: async (): Promise<Order[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders`)
      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching orders, using mock data:', error)
      // For now, until we have mock orders
      return []
    }
  },

  getOrder: async (orderId: string | number): Promise<Order> => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch order ${orderId}`)
      }
      return await response.json()
    } catch (error) {
      console.error(`Error fetching order ${orderId}:`, error)
      throw error
    }
  },

  createOrder: async (orderData: Partial<Order>): Promise<Order> => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Failed to create order: ${errorData.details || response.statusText}`
        )
      }
      return await response.json()
    } catch (error) {
      console.error('Error creating order:', error)
      throw error
    }
  },

  updateOrder: async (
    orderId: string | number,
    orderData: Partial<Order>
  ): Promise<Order> => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Failed to update order ${orderId}: ${
            errorData.details || response.statusText
          }`
        )
      }
      return await response.json()
    } catch (error) {
      console.error(`Error updating order ${orderId}:`, error)
      throw error
    }
  },

  deleteOrder: async (
    orderId: string | number
  ): Promise<{ message: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Failed to delete order ${orderId}`)
      }
      return await response.json()
    } catch (error) {
      console.error(`Error deleting order ${orderId}:`, error)
      throw error
    }
  },

  // Baking List
  getBakingList: async (date: Date): Promise<BakingListResponse> => {
    try {
      // Format date as YYYY-MM-DD
      const formattedDate =
        date instanceof Date
          ? date.toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]

      const response = await fetch(
        `${API_BASE_URL}/baking-list?date=${formattedDate}`
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch baking list: ${response.statusText}`)
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching baking list:', error)
      throw error
    }
  },

  // Dashboard data methods
  getSummaryData: async (range: TimeRange): Promise<SummaryData> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/dashboard/summary?range=${range}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch summary data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching summary data, using mock data:', error)
      // Fall back to mock data
      return calculateSummary(range)
    }
  },

  getTimeSeriesData: async (
    type: 'sales' | 'customers' | 'production' | 'waste',
    range: TimeRange
  ): Promise<TimeSeriesData[]> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/dashboard/timeseries?type=${type}&range=${range}`
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch ${type} time series data`)
      }
      return await response.json()
    } catch (error) {
      console.error(
        `Error fetching ${type} time series data, using mock data:`,
        error
      )
      // Fall back to mock data
      return generateTimeSeriesData(type, range)
    }
  },

  getSalesData: async (range: TimeRange): Promise<SalesData[]> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/dashboard/sales?range=${range}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch sales data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching sales data, using mock data:', error)
      // Fall back to mock data
      return filterByDateRange(mockData.salesData, range)
    }
  },

  getProductionData: async (range: TimeRange): Promise<ProductionData[]> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/dashboard/production?range=${range}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch production data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching production data, using mock data:', error)
      // Fall back to mock data
      return filterByDateRange(mockData.productionData, range)
    }
  },

  getFinancialData: async (range: TimeRange): Promise<FinancialData[]> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/dashboard/finances?range=${range}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch financial data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching financial data, using mock data:', error)
      // Fall back to mock data
      return filterByDateRange(mockData.financialData, range)
    }
  },

  getInventoryData: async (): Promise<InventoryItem[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/inventory`)
      if (!response.ok) {
        throw new Error('Failed to fetch inventory data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching inventory data, using mock data:', error)
      // Fall back to mock data
      return mockData.inventoryData
    }
  },

  getStaffData: async (): Promise<StaffData[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/staff`)
      if (!response.ok) {
        throw new Error('Failed to fetch staff data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching staff data, using mock data:', error)
      // Fall back to mock data
      return mockData.staffData
    }
  },

  getCustomerData: async (): Promise<CustomerData[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/customers`)
      if (!response.ok) {
        throw new Error('Failed to fetch customer data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching customer data, using mock data:', error)
      // Fall back to mock data
      return mockData.customerData
    }
  },
  // Get available workflows, including our new hefeteig workflows
  getWorkflows: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/workflows`)
      if (!response.ok) {
        throw new Error('Failed to fetch workflows')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching workflows, using mock data:', error)
      // You'll need to create mock workflow data
      return [
        {
          id: 'croissant_production',
          name: 'Croissant Produktion',
          version: '1.2',
          status: 'active',
          steps: 7,
        },
        {
          id: 'sourdough_bread',
          name: 'Sauerteigbrot',
          version: '1.0',
          status: 'active',
          steps: 10,
        },
        {
          id: 'hefeteig_production',
          name: 'Hefeteig Produktion',
          version: '1.0',
          status: 'active',
          steps: 5,
        },
        {
          id: 'filling_production',
          name: 'Füllungen Produktion',
          version: '1.0',
          status: 'active',
          steps: 4,
        },
      ]
    }
  },

  // Get workflow details
  getWorkflowDetails: async (workflowId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch workflow ${workflowId}`)
      }
      return await response.json()
    } catch (error) {
      console.error(`Error fetching workflow ${workflowId}:`, error)
      throw error
    }
  },

  // Get hefezopf orders - typically for Saturday production
  getHefezopfOrders: async (date: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/production/hefezopf-orders?date=${date}`
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch hefezopf orders for ${date}`)
      }
      return await response.json()
    } catch (error) {
      console.error(`Error fetching hefezopf orders:`, error)
      // Return mock data for testing
      return {
        'Hefezopf Plain': 15,
        'Hefekranz Nuss': 8,
        'Hefekranz Schoko': 12,
        'Hefekranz Pudding': 5,
        'Hefekranz Marzipan': 4,
        'Mini Hefezopf': 20,
        'Hefeschnecken Nuss': 30,
        'Hefeschnecken Schoko': 25,
      }
    }
  },

  // Save production plan
  saveProductionPlan: async (date: string, plan: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/production/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date, plan }),
      })

      if (!response.ok) {
        throw new Error('Failed to save production plan')
      }

      return await response.json()
    } catch (error) {
      console.error('Error saving production plan:', error)
      // Mock successful response
      return { success: true, id: 'mock-plan-id' }
    }
  },

  // Cash Management
  getCashHistory: async (): Promise<CashEntry[]> => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`${API_BASE_URL}/cash`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        }
        throw new Error('Failed to fetch cash history')
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching cash history:', error)
      
      // Only fall back to mock data if it's a network error, not auth error
      if (error instanceof Error && error.message.includes('Authentication')) {
        throw error
      }
      
      // Generate mock cash data for development when backend is unavailable
      console.warn('Backend unavailable, using mock data for development')
      const mockCashEntries: CashEntry[] = []
      const today = new Date()
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        
        // Skip some days randomly to simulate missing entries
        if (Math.random() > 0.8) continue
        
        // Generate realistic cash amounts (€200-€800 range with some outliers)
        let baseAmount = 300 + Math.random() * 300 // €300-€600 base
        const isWeekend = date.getDay() === 0 || date.getDay() === 6
        if (isWeekend) {
          baseAmount *= 1.2 // 20% more on weekends
        }
        
        // Add some random variation
        const amount = Math.round((baseAmount + (Math.random() - 0.5) * 100) * 100) / 100
        
        mockCashEntries.push({
          id: i + 1,
          UserId: 1,
          amount,
          date: dateStr,
          createdAt: new Date(date.getTime() + 20 * 60 * 60 * 1000).toISOString(), // 8 PM
          updatedAt: new Date(date.getTime() + 20 * 60 * 60 * 1000).toISOString(),
        })
      }
      
      return mockCashEntries.reverse() // Return in chronological order
    }
  },

  addCashEntry: async (amount: number): Promise<{ message: string }> => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`${API_BASE_URL}/cash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        }
        
        const errorData = await response.json().catch(() => ({}))
        
        if (response.status === 400 && errorData.error === 'Invalid user') {
          throw new Error('Your user session is invalid. Please log in again.')
        }
        
        throw new Error(errorData.error || 'Failed to save cash entry')
      }

      return await response.json()
    } catch (error) {
      console.error('Error saving cash entry:', error)
      
      // Only fall back to mock for network errors, not auth errors
      if (error instanceof Error && error.message.includes('Authentication')) {
        throw error
      }
      
      // Mock successful response for development when backend is unavailable
      console.warn('Backend unavailable, using mock response for development')
      return { message: 'Cash entry saved (mock)' }
    }
  },

  updateCashEntry: async (id: number, amount: number, date?: string): Promise<{ message: string; entry: CashEntry }> => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const updateData: { amount: number; date?: string } = { amount }
      if (date) {
        updateData.date = date
      }

      const response = await fetch(`${API_BASE_URL}/cash/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        }
        
        if (response.status === 404) {
          throw new Error('Cash entry not found.')
        }
        
        const errorData = await response.json().catch(() => ({}))
        
        if (response.status === 400 && errorData.error === 'Invalid user') {
          throw new Error('Your user session is invalid. Please log in again.')
        }
        
        throw new Error(errorData.error || 'Failed to update cash entry')
      }

      return await response.json()
    } catch (error) {
      console.error('Error updating cash entry:', error)
      
      // Only fall back to mock for network errors, not auth errors
      if (error instanceof Error && (
          error.message.includes('Authentication') || 
          error.message.includes('not found')
        )) {
        throw error
      }
      
      // Mock successful response for development when backend is unavailable
      console.warn('Backend unavailable, using mock response for development')
      return { 
        message: 'Cash entry updated (mock)',
        entry: { id, UserId: 1, amount, date: date || new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      }
    }
  },

  deleteCashEntry: async (id: number): Promise<{ message: string }> => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`${API_BASE_URL}/cash/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        }
        
        if (response.status === 404) {
          throw new Error('Cash entry not found.')
        }
        
        const errorData = await response.json().catch(() => ({}))
        
        if (response.status === 400 && errorData.error === 'Invalid user') {
          throw new Error('Your user session is invalid. Please log in again.')
        }
        
        throw new Error(errorData.error || 'Failed to delete cash entry')
      }

      return await response.json()
    } catch (error) {
      console.error('Error deleting cash entry:', error)
      
      // Only fall back to mock for network errors, not auth errors
      if (error instanceof Error && (
          error.message.includes('Authentication') || 
          error.message.includes('not found')
        )) {
        throw error
      }
      
      // Mock successful response for development when backend is unavailable
      console.warn('Backend unavailable, using mock response for development')
      return { message: 'Cash entry deleted (mock)' }
    }
  },

  // Unsold Products Management
  addUnsoldProduct: async (productId: number, quantity: number): Promise<{ message: string }> => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`${API_BASE_URL}/unsold-products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, quantity }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        }
        
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save unsold product entry')
      }

      return await response.json()
    } catch (error) {
      console.error('Error saving unsold product entry:', error)
      
      // Only fall back to mock for network errors, not auth errors
      if (error instanceof Error && error.message.includes('Authentication')) {
        throw error
      }
      
      // Mock successful response for development when backend is unavailable
      console.warn('Backend unavailable, using mock response for development')
      return { message: 'Unsold product entry saved (mock)' }
    }
  },

  getUnsoldProducts: async (): Promise<any[]> => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`${API_BASE_URL}/unsold-products`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        }
        throw new Error('Failed to fetch unsold products')
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching unsold products:', error)
      
      // Only fall back to mock for network errors, not auth errors
      if (error instanceof Error && error.message.includes('Authentication')) {
        throw error
      }
      
      // Generate mock unsold products data for development when backend is unavailable
      console.warn('Backend unavailable, using mock data for development')
      const mockUnsoldProducts = []
      const today = new Date()
      
      for (let i = 0; i < 15; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        
        // Generate 1-3 unsold product entries per day
        const entriesCount = Math.floor(Math.random() * 3) + 1
        
        for (let j = 0; j < entriesCount; j++) {
          const productNames = ['Vollkornbrot', 'Baguette', 'Croissant', 'Apfelkuchen', 'Brötchen', 'Pretzel']
          const productName = productNames[Math.floor(Math.random() * productNames.length)]
          const quantity = Math.floor(Math.random() * 10) + 1
          
          mockUnsoldProducts.push({
            id: i * 10 + j + 1,
            productId: j + 1,
            quantity,
            date: dateStr,
            createdAt: new Date(date.getTime() + 20 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(date.getTime() + 20 * 60 * 60 * 1000).toISOString(),
            Product: {
              name: productName,
              category: ['Brot', 'Gebäck', 'Kuchen'][Math.floor(Math.random() * 3)]
            },
            User: {
              username: 'MockUser'
            }
          })
        }
      }
      
      return mockUnsoldProducts.reverse() // Return in chronological order
    }
  },

  getUnsoldProductsSummary: async (): Promise<any[]> => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`${API_BASE_URL}/unsold-products/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        }
        throw new Error('Failed to fetch unsold products summary')
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching unsold products summary:', error)
      
      // Only fall back to mock for network errors, not auth errors
      if (error instanceof Error && error.message.includes('Authentication')) {
        throw error
      }
      
      // Generate mock summary data for development when backend is unavailable
      console.warn('Backend unavailable, using mock summary data for development')
      const mockSummary = [
        {
          productId: 1,
          totalUnsold: 25,
          Product: { name: 'Vollkornbrot', category: 'Brot' }
        },
        {
          productId: 2,
          totalUnsold: 18,
          Product: { name: 'Baguette', category: 'Brot' }
        },
        {
          productId: 3,
          totalUnsold: 12,
          Product: { name: 'Croissant', category: 'Gebäck' }
        },
        {
          productId: 4,
          totalUnsold: 8,
          Product: { name: 'Apfelkuchen', category: 'Kuchen' }
        }
      ]
      
      return mockSummary
    }
  },
}

export default bakeryAPI
