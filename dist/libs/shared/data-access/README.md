# @bakery/shared/data-access

Data access layer providing API services and HTTP client functionality for the bakery management system.

## Overview

This library centralizes all API communication logic, providing a consistent interface for frontend applications to interact with backend endpoints. It includes services for products, orders, users, and authentication.

## Installation

This library is part of the Nx monorepo and is automatically available to all apps and libs within the workspace.

```typescript
import {
  productService,
  orderService,
  userService,
  apiClient,
} from '@bakery/shared/data-access'
```

## Features

### API Client

- **Centralized Configuration** - Single configuration point for all API calls
- **Authentication Handling** - Automatic token management
- **Error Handling** - Consistent error handling across all requests
- **Type Safety** - Full TypeScript support with type definitions from `@bakery/shared/types`
- **Request/Response Transformation** - Automatic JSON parsing and formatting
- **File Upload Support** - Built-in file upload capabilities
- **Timeout Management** - Configurable request timeouts

### Services

#### Product Service

- Get products with filtering and pagination
- Create, update, and delete products
- Search functionality
- Stock management
- Image upload
- Category-based queries

#### Order Service

- Order lifecycle management
- Status updates and tracking
- Customer order history
- Baking list generation
- Order analytics and summaries
- Search and filtering

#### User Service

- User authentication (login, register, logout)
- Password management
- Profile management
- User administration (for admins)
- Role-based access

## Usage Examples

### Basic Product Operations

```typescript
import { productService } from '@bakery/shared/data-access'
import { ProductCategory } from '@bakery/shared/types'

// Get all products
const products = await productService.getProducts()

// Get products with filters
const breadProducts = await productService.getProducts({
  categories: [ProductCategory.Bread],
  inStock: true,
})

// Create a new product
const newProduct = await productService.createProduct({
  name: 'Sourdough Bread',
  category: ProductCategory.Bread,
  price: 3.5,
  stock: 20,
})
```

### Order Management

```typescript
import { orderService } from '@bakery/shared/data-access'
import { OrderStatus } from '@bakery/shared/types'

// Create an order
const newOrder = await orderService.createOrder({
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  items: [
    { productId: 1, quantity: 2 },
    { productId: 3, quantity: 1 },
  ],
  isPickup: true,
})

// Update order status
await orderService.updateOrderStatus(newOrder.data.id, OrderStatus.Confirmed)

// Get today's orders
const todaysOrders = await orderService.getTodaysOrders()
```

### Authentication

```typescript
import { userService } from '@bakery/shared/data-access'

// Login
const loginResult = await userService.login({
  email: 'user@example.com',
  password: 'password123',
})

// Get current user
const currentUser = await userService.getCurrentUser()

// Logout
await userService.logout()
```

### Custom API Calls

```typescript
import { apiClient } from '@bakery/shared/data-access'

// Direct API client usage for custom endpoints
const customData = await apiClient.get('/api/custom-endpoint')

// With authentication
apiClient.setAuthToken('your-jwt-token')
const protectedData = await apiClient.get('/api/protected-data')
```

## Configuration

### Environment Variables

```bash
# API base URL
NEXT_PUBLIC_API_URL=http://localhost:5000

# Or for production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Custom API Client

```typescript
import { ApiClient } from '@bakery/shared/data-access'

const customApiClient = new ApiClient({
  baseUrl: 'https://custom-api.com',
  timeout: 15000,
  headers: {
    'Custom-Header': 'value',
  },
})
```

## Error Handling

All services return responses in a consistent `ApiResponse<T>` format:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
}
```

Example error handling:

```typescript
const result = await productService.getProduct(123)

if (result.success) {
  console.log('Product:', result.data)
} else {
  console.error('Error:', result.error || result.message)
}
```

## Testing

```bash
# Run tests
nx test shared-data-access

# Build library
nx build shared-data-access
```

## Best Practices

1. **Use Service Instances** - Import and use the singleton service instances
2. **Handle Errors** - Always check the `success` property in responses
3. **Type Safety** - Use types from `@bakery/shared/types`
4. **Authentication** - The API client automatically manages tokens after login
5. **Environment Configuration** - Use environment variables for API URLs

## Related Libraries

- `@bakery/shared/types` - TypeScript type definitions
- `@bakery/shared/utils` - Utility functions
- `@bakery/shared/ui` - UI components
