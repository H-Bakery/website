# @bakery/shared/data-mocks

Comprehensive mock data library for the bakery management system. Provides realistic test data for development, testing, and demos.

## Overview

This library contains structured mock data and generators for all entities in the bakery system:

- 🍞 **Products** - Breads, buns, cakes, pastries, and snacks with full details
- 👥 **Users & Customers** - Staff members and customer profiles with permissions
- 📦 **Orders** - Complete order history with items, payments, and delivery
- 📊 **Analytics** - Dashboard data, sales metrics, and performance indicators
- 🏭 **Generators** - Dynamic data creation for testing scenarios

## Installation

This library is part of the Nx monorepo and is automatically available:

```typescript
import {
  PRODUCTS,
  CUSTOMERS,
  ORDERS,
  ProductGenerator,
  OrderGenerator,
} from '@bakery/shared/data-mocks'
```

## Quick Start

### Using Static Mock Data

```typescript
import {
  ALL_PRODUCTS,
  MOCK_USERS,
  MOCK_CUSTOMERS,
  ALL_ORDERS,
} from '@bakery/shared/data-mocks'

// Get all products
const products = ALL_PRODUCTS

// Filter active products
const activeProducts = ALL_PRODUCTS.filter((p) => p.isActive)

// Get products by category
import { getProductsByCategory } from '@bakery/shared/data-mocks'
const breads = getProductsByCategory('Brot')
```

### Using Data Generators

```typescript
import {
  ProductGenerator,
  OrderGenerator,
  UserGenerator,
} from '@bakery/shared/data-mocks'

// Generate a single product
const product = ProductGenerator.generateProduct({
  category: 'Brot',
  isActive: true,
})

// Generate multiple orders
const orders = OrderGenerator.generateOrders(50, {
  status: 'completed',
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31'),
  },
})

// Generate a team of users
const team = UserGenerator.generateTeam()
```

## Mock Data Structure

### Products

Each product includes comprehensive information:

```typescript
interface Product {
  id: number
  name: string
  description: string
  category: 'Brot' | 'Brötchen' | 'Kuchen' | 'Torte' | 'Gebäck' | 'Snacks'
  type: 'bread' | 'bun' | 'cake' | 'pastry' | 'snack' | 'seasonal'
  image: string
  price: number
  isActive: boolean
  stock: number
  allergens: string[]
  ingredients: string[]
  nutritionalInfo: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sugar: number
  }
  weight: number
  unit: 'g' | 'kg' | 'Stück'
  dailyTarget: number
  bakingTime: string
  shelfLife: number // days
}
```

**Available Collections:**

- `BREAD_PRODUCTS` - 7 different bread types
- `BUN_PRODUCTS` - 8 types including croissants
- `CAKE_PRODUCTS` - 8 cakes and tortes
- `SNACK_PRODUCTS` - 10 snacks and seasonal items
- `ALL_PRODUCTS` - All 33 products combined

### Users & Customers

Staff members with role-based permissions:

```typescript
interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'manager' | 'baker' | 'cashier' | 'delivery' | 'customer'
  name: string
  isActive: boolean
  permissions: string[]
  department?: string
  shift?: string
  lastLogin: Date
  preferences: UserPreferences
}
```

Customer profiles with business logic:

```typescript
interface Customer {
  id: number
  customerId: string
  name: string
  email: string
  type: 'individual' | 'business'
  businessName?: string
  taxId?: string
  totalOrders: number
  totalSpent: number
  loyaltyPoints?: number
  creditLimit?: number
  preferences: CustomerPreferences
  tags: string[]
}
```

**Mock Users:**

- 1 Admin
- 1 Manager
- 2 Bakers
- 1 Cashier
- 1 Delivery driver
- 1 Customer
- 1 Inactive user

**Mock Customers:**

- 3 Individual customers
- 4 Business customers (café, hotel, office, kindergarten)
- 1 Inactive business customer

### Orders

Complete order information with history:

```typescript
interface Order {
  id: number
  orderNumber: string
  customerId: number
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  items: OrderItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod: PaymentMethod
  paymentStatus: 'pending' | 'paid' | 'refunded'
  deliveryMethod: 'pickup' | 'delivery'
  deliveryAddress?: Address
  createdAt: Date
  completedAt?: Date
  cancelledAt?: Date
}
```

**Order Data:**

- 5 manually created example orders
- ~300 generated historical orders (last 30 days)
- Various statuses and payment methods
- Business discounts applied automatically

### Analytics & Dashboard

Pre-calculated analytics data:

```typescript
// Sales Analytics
const sales = generateSalesAnalytics(30)
// Returns: totalRevenue, dailySales, topProducts, growthRate

// Production Analytics
const production = generateProductionAnalytics(7)
// Returns: totalProduced, totalSold, totalWaste, efficiency

// Inventory Status
const inventory = generateInventoryStatus()
// Returns: lowStockItems, excessStockItems, totalValue

// Customer Analytics
const customers = generateCustomerAnalytics()
// Returns: segmentation, satisfaction scores, top customers
```

## Data Generators

### ProductGenerator

Create products dynamically:

```typescript
// Generate seasonal product
const stollen = ProductGenerator.generateSeasonalProduct()

// Generate healthy product line
const healthyProducts = Array(5)
  .fill(null)
  .map(() => ProductGenerator.generateHealthyProduct())

// Generate products with constraints
const premiumCakes = ProductGenerator.generateProducts({
  category: 'Torte',
  priceRange: { min: 15, max: 30 },
  count: 10,
})
```

### OrderGenerator

Create realistic order patterns:

```typescript
// Generate orders for specific date range
const januaryOrders = OrderGenerator.generateOrdersForDateRange(
  new Date('2024-01-01'),
  new Date('2024-01-31'),
  15 // orders per day
)

// Generate recurring customer orders
const hotelOrders = OrderGenerator.generateRecurringOrder(
  3, // Hotel customer ID
  'daily'
)

// Generate orders with specific parameters
const pendingDeliveries = OrderGenerator.generateOrders(20, {
  status: 'pending',
  deliveryMethod: 'delivery',
  paymentMethod: 'invoice',
})
```

### UserGenerator

Create users and customers:

```typescript
// Generate complete bakery team
const team = UserGenerator.generateTeam()
// Returns: 1 manager, 2 bakers, 2 cashiers, 1 delivery

// Generate business customers
const businesses = UserGenerator.generateCustomers(10, {
  type: 'business',
  isActive: true,
})

// Generate users with specific roles
const bakers = UserGenerator.generateUsers(5, {
  role: 'baker',
  department: 'Produktion',
})
```

## Utility Functions

### Product Utilities

```typescript
import {
  getProductById,
  getProductsByCategory,
  getProductsByType,
  getActiveProducts,
  searchProducts,
  FEATURED_PRODUCTS,
  BEST_SELLERS,
  SEASONAL_PRODUCTS,
} from '@bakery/shared/data-mocks'

// Search products
const results = searchProducts('Brot')

// Get featured products for homepage
const featured = FEATURED_PRODUCTS // Random 6 active products

// Get best sellers
const topProducts = BEST_SELLERS // Top 8 by daily target
```

### Customer Utilities

```typescript
import {
  getCustomerById,
  getActiveCustomers,
  getBusinessCustomers,
  getTopCustomers,
  searchCustomers,
} from '@bakery/shared/data-mocks'

// Get VIP customers
const vips = getTopCustomers(5) // Top 5 by total spent

// Search customers
const results = searchCustomers('Hotel')
```

### Order Utilities

```typescript
import {
  getOrdersByCustomer,
  getOrdersByStatus,
  getTodaysOrders,
  getPendingOrders,
  getDeliveryOrders,
} from '@bakery/shared/data-mocks'

// Get today's orders
const today = getTodaysOrders()

// Get orders needing delivery
const deliveries = getDeliveryOrders()
```

## Testing Examples

### Component Testing

```typescript
import { render } from '@testing-library/react'
import { ProductCard } from './ProductCard'
import { BREAD_PRODUCTS } from '@bakery/shared/data-mocks'

test('renders product information', () => {
  const product = BREAD_PRODUCTS[0]
  const { getByText } = render(<ProductCard product={product} />)

  expect(getByText(product.name)).toBeInTheDocument()
  expect(getByText(`€${product.price}`)).toBeInTheDocument()
})
```

### Service Testing

```typescript
import { OrderService } from './order.service'
import { OrderGenerator, MOCK_CUSTOMERS } from '@bakery/shared/data-mocks'

describe('OrderService', () => {
  it('processes bulk orders', async () => {
    const orders = OrderGenerator.generateOrders(10, {
      status: 'pending',
    })

    const results = await OrderService.processBulk(orders)
    expect(results).toHaveLength(10)
  })
})
```

### Integration Testing

```typescript
import { mockServer } from './test-utils'
import { ALL_PRODUCTS, ALL_ORDERS } from '@bakery/shared/data-mocks'

beforeAll(() => {
  mockServer.use(
    rest.get('/api/products', (req, res, ctx) => {
      return res(ctx.json(ALL_PRODUCTS))
    }),
    rest.get('/api/orders', (req, res, ctx) => {
      return res(ctx.json(ALL_ORDERS.slice(0, 20)))
    })
  )
})
```

## Performance Considerations

### Large Data Sets

When working with large amounts of generated data:

```typescript
// ❌ Avoid - generates all data at once
const allOrders = OrderGenerator.generateOrdersForDateRange(
  new Date('2020-01-01'),
  new Date('2024-12-31'),
  50
)

// ✅ Better - generate in chunks
function* generateOrdersLazy(startDate: Date, endDate: Date) {
  const current = new Date(startDate)
  while (current <= endDate) {
    yield OrderGenerator.generateOrdersForDateRange(
      current,
      new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week
      50
    )
    current.setDate(current.getDate() + 7)
  }
}
```

### Memoization

Cache expensive calculations:

```typescript
import { useMemo } from 'react'
import { ALL_PRODUCTS } from '@bakery/shared/data-mocks'

function ProductStats() {
  const stats = useMemo(() => {
    return {
      total: ALL_PRODUCTS.length,
      active: ALL_PRODUCTS.filter((p) => p.isActive).length,
      categories: [...new Set(ALL_PRODUCTS.map((p) => p.category))].length,
      avgPrice:
        ALL_PRODUCTS.reduce((sum, p) => sum + p.price, 0) / ALL_PRODUCTS.length,
    }
  }, [])

  return <div>{/* Display stats */}</div>
}
```

## Extending Mock Data

### Adding New Products

```typescript
// In your app code
import { ALL_PRODUCTS, ProductGenerator } from '@bakery/shared/data-mocks'

const customProducts = [
  ...ALL_PRODUCTS,
  ProductGenerator.generateProduct({
    name: 'Spezial Osterbrot',
    category: 'Brot',
    type: 'seasonal',
    price: 4.5,
    isActive: true,
  }),
]
```

### Custom Generators

```typescript
import { ProductGenerator } from '@bakery/shared/data-mocks'

class CustomProductGenerator extends ProductGenerator {
  static generateVeganProduct() {
    return this.generateProduct({
      allergens: ['Gluten'], // No animal products
      description: 'Vegan und lecker!',
      ingredients: ['Mehl', 'Wasser', 'Pflanzenmargarine', 'Zucker'],
    })
  }
}
```

## Best Practices

1. **Use TypeScript** - All mock data is fully typed
2. **Prefer generators for tests** - More flexible than static data
3. **Cache static collections** - Import once and reuse
4. **Generate realistic patterns** - Use date ranges and frequencies
5. **Match production constraints** - Respect business rules

## Migration from Old Mock Data

```typescript
// Old approach (src/mocks/products.ts)
import { PRODUCTS } from '../mocks/products'

// New approach
import { ALL_PRODUCTS } from '@bakery/shared/data-mocks'
// or
import { PRODUCTS } from '@bakery/shared/data-mocks' // Aliased export
```

## License

Part of the bakery management system - private use only.
