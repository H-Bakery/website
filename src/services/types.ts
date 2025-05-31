// src/services/types.ts
export type TimeRange = 'day' | 'week' | 'month' | 'year'
export interface Ingredient {
  name: string
  quantity: string
}

export interface SalesData {
  id: string
  date: string
  product_id: number
  product_name: string
  quantity: number
  total: number
  payment_method: string
}

export interface ProductionData {
  id: string
  date: string
  product_id: number
  product_name: string
  quantity_produced: number
  waste: number
  staff_name: string
}

export interface FinancialData {
  id: string
  date: string
  category: string
  amount: number
  description: string
}

export interface InventoryItem {
  id: number
  name: string
  quantity: number
  unit: string
  min_stock_level: number
  last_restocked: string
}

export interface StaffData {
  id: number
  name: string
  role: string
  productivity: number
  hours_worked: number
  salary: number
}

export interface CustomerData {
  id: number
  name: string
  type: string
  total_spent: number
  visits: number
  last_visit: string
}

export interface TimeSeriesData {
  date: string
  value: number
}

export interface OrderItem {
  productId: string | number
  productName: string
  quantity: number
  unitPrice: number
}

export interface Order {
  id: string | number
  createdAt: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  pickupDate: string | Date
  status: string
  notes?: string
  totalPrice: number
  items: OrderItem[]
}

export interface BakingItem {
  productId: number | string
  name: string
  shopQuantity: number
  orderQuantity: number
  totalQuantity: number
}

export interface ShopItem {
  productId: number | string
  name: string
  dailyTarget: number
  currentStock: number
  shopQuantity: number
}

export interface OrderForBakingList {
  orderId: number | string
  customerName: string
  pickupDate: string | Date
  status: string
  notes?: string
  items: {
    productId: number | string
    productName: string
    quantity: number
  }[]
}

export interface BakingListResponse {
  date: string
  allItems: BakingItem[]
  shopItems: ShopItem[]
  orderItems: OrderForBakingList[]
}

export interface SummaryData {
  totalSales: number
  totalItems: number
  totalProduced: number
  totalWaste: number
  transactions: number
  uniqueTransactions: number
  expenses: number
  revenue: number
  profit: number
  averageOrderValue: number
  wastageRate: number
  profitMargin: number
}

/**
 * Represents a customer review for a recipe.
 */
export interface Review {
  id: string
  recipeId: string // Links to the Recipe
  author: string // Name of the reviewer
  rating: number // e.g., 1-5 stars
  comment?: string // Optional review text
  date: string // ISO date string
}

/**
 * Represents a bakery recipe, including ingredients, instructions, and reviews.
 */
export interface Recipe {
  id: string
  name: string
  description?: string
  ingredients: Array<{ name: string; quantity: string }> // Array of ingredient objects
  instructions: Array<string> // Array of instruction steps
  category: string // e.g., "Cakes", "Breads", "Pastries"
  prepTime?: string // e.g., "30 minutes"
  cookTime?: string // e.g., "1 hour"
  servings?: number
  image?: string // URL or path to an image
  reviews?: Review[] // Array of Review objects
}
