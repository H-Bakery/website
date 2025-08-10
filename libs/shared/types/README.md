# @bakery/shared/types

Comprehensive TypeScript type definitions for the bakery management system.

## Overview

This library provides a centralized collection of TypeScript types, interfaces, and enums used throughout the bakery monorepo. It ensures type safety and consistency across all applications and libraries.

## Installation

This library is part of the Nx monorepo and is automatically available to all apps and libs within the workspace.

```typescript
import { Product, Order, User } from '@bakery/shared/types'
```

## Type Categories

### Core Business Types

- **Product** - Product catalog and inventory management
- **Order** - Customer orders and order management
- **User** - User accounts, authentication, and roles

### Common Types

- **ApiResponse** - Standardized API responses
- **PaginatedResponse** - Paginated data structures
- **DateRange** - Date filtering utilities
- **BaseEntity** - Common entity fields (id, createdAt, updatedAt)

## Key Features

### Type Safety

All types include:

- Comprehensive JSDoc documentation
- Strict TypeScript definitions
- Type guards for runtime validation
- Utility types for common operations

### Enums with Type Guards

```typescript
import { ProductStatus, isProductStatus } from '@bakery/shared/types'

const status = 'available'
if (isProductStatus(status)) {
  // TypeScript knows status is ProductStatus
}
```

### Utility Types

```typescript
// Create/Update helpers
type CreateProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateProductInput = Partial<Product> & { id: number };

// Deep utilities
type DeepPartial<T> // Makes all properties optional recursively
type Nullable<T> // Adds null to all properties
```

## Usage Examples

### Products

```typescript
import { Product, ProductCategory, ProductFilters } from '@bakery/shared/types'

const product: Product = {
  id: 1,
  name: 'Sourdough Bread',
  category: ProductCategory.Bread,
  price: 3.5,
  // ... other properties
}

const filters: ProductFilters = {
  categories: [ProductCategory.Bread, ProductCategory.Pastries],
  priceRange: { min: 2, max: 10 },
  inStock: true,
}
```

### Orders

```typescript
import { Order, OrderStatus, CreateOrderInput } from '@bakery/shared/types'

const order: Order = {
  id: 1,
  orderNumber: 'ORD-001',
  customerName: 'John Doe',
  status: OrderStatus.Pending,
  // ... other properties
}
```

### API Integration

```typescript
import { ApiResponse, PaginatedResponse } from '@bakery/shared/types'

// Success response
const response: ApiResponse<Product[]> = {
  success: true,
  data: products,
  message: 'Products retrieved successfully',
}

// Paginated response
const paginated: PaginatedResponse<Product> = {
  items: products,
  total: 100,
  page: 1,
  limit: 20,
  totalPages: 5,
  hasMore: true,
  hasPrevious: false,
}
```

## Best Practices

1. **Import from index** - Always import from '@bakery/shared/types'
2. **Use enums** - Prefer enums over string literals for constants
3. **Use type guards** - Validate external data with provided type guards
4. **Extend interfaces** - Create domain-specific extensions when needed
5. **Document changes** - Update JSDoc when modifying types

## Development

### Adding New Types

1. Create a new file in `src/lib/` following the naming convention
2. Export all public types from the file
3. Add export to `src/index.ts`
4. Include JSDoc documentation
5. Add type guards where appropriate

### Testing

```bash
# Type check
nx run shared-types:build

# Run tests
nx run shared-types:test
```

## Related Libraries

- `@bakery/shared/utils` - Utility functions
- `@bakery/shared/data-access` - API services
- `@bakery/shared/ui` - UI components
