# Testing Guide

## Testing Strategy Overview

The bakery monorepo follows a comprehensive testing pyramid:

- **Unit Tests**: 70% - Fast, isolated component/function tests
- **Integration Tests**: 20% - API endpoints, service interactions
- **E2E Tests**: 10% - Critical user journeys

## Running Tests

### Quick Commands

```bash
# Run all tests
nx run-many --target=test --all

# Run affected tests
nx affected:test

# Run specific project tests
nx test bakery-shop
nx test bakery-api

# Run with coverage
nx test bakery-shop --coverage

# Run in watch mode
nx test bakery-shop --watch

# Run E2E tests
nx e2e bakery-shop-e2e
```

## Unit Testing

### Frontend Components

```typescript
// libs/shared/ui/src/lib/button/button.spec.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should apply variant styles', () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByText('Delete');
    expect(button).toHaveClass('bg-red-600');
  });

  it('should be disabled when prop is set', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText('Disabled')).toBeDisabled();
  });
});
```

### React Hooks

```typescript
// libs/bakery-shop/feature-cart/src/lib/hooks/use-cart.spec.ts
import { renderHook, act } from '@testing-library/react';
import { useCart } from './use-cart';

describe('useCart', () => {
  it('should add items to cart', () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addItem({
        id: '1',
        name: 'Croissant',
        price: 2.50,
      });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.total).toBe(2.50);
  });

  it('should update item quantity', () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addItem({
        id: '1',
        name: 'Croissant',
        price: 2.50,
      });
      result.current.updateQuantity('1', 3);
    });

    expect(result.current.items[0].quantity).toBe(3);
    expect(result.current.total).toBe(7.50);
  });
});
```

### Backend Services

```typescript
// apps/bakery-api/src/modules/orders/order.service.spec.ts
import { Test } from '@nestjs/testing';
import { OrderService } from './order.service';
import { OrderRepository } from './order.repository';
import { InventoryService } from '../inventory/inventory.service';

describe('OrderService', () => {
  let service: OrderService;
  let orderRepo: jest.Mocked<OrderRepository>;
  let inventoryService: jest.Mocked<InventoryService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: OrderRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: InventoryService,
          useValue: {
            checkAvailability: jest.fn(),
            reserveItems: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(OrderService);
    orderRepo = module.get(OrderRepository);
    inventoryService = module.get(InventoryService);
  });

  describe('createOrder', () => {
    it('should create order when inventory is available', async () => {
      const orderData = {
        customerId: 'cust-123',
        items: [{ productId: 'prod-1', quantity: 2 }],
      };

      inventoryService.checkAvailability.mockResolvedValue(true);
      orderRepo.create.mockResolvedValue({
        id: 'order-123',
        ...orderData,
        status: 'pending',
      });

      const result = await service.createOrder(orderData);

      expect(inventoryService.checkAvailability).toHaveBeenCalledWith(orderData.items);
      expect(inventoryService.reserveItems).toHaveBeenCalledWith(orderData.items);
      expect(result.id).toBe('order-123');
    });

    it('should throw when inventory is insufficient', async () => {
      inventoryService.checkAvailability.mockResolvedValue(false);

      await expect(
        service.createOrder({
          customerId: 'cust-123',
          items: [{ productId: 'prod-1', quantity: 100 }],
        })
      ).rejects.toThrow('Insufficient inventory');
    });
  });
});
```

## Integration Testing

### API Endpoints

```typescript
// apps/bakery-api/src/modules/orders/order.controller.spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('OrderController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });
    
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /orders', () => {
    it('should create order with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            { productId: 'prod-1', quantity: 2 },
            { productId: 'prod-2', quantity: 1 },
          ],
          deliveryAddress: '123 Main St',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        status: 'pending',
        items: expect.arrayContaining([
          expect.objectContaining({
            productId: 'prod-1',
            quantity: 2,
          }),
        ]),
      });
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send({ items: [] })
        .expect(401);
    });
  });
});
```

### Database Integration

```typescript
// libs/bakery-api/data-access/src/lib/repositories/order.repository.spec.ts
import { PrismaClient } from '@prisma/client';
import { OrderRepository } from './order.repository';

describe('OrderRepository', () => {
  let prisma: PrismaClient;
  let repository: OrderRepository;

  beforeAll(async () => {
    // Use test database
    process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
    prisma = new PrismaClient();
    await prisma.$connect();
    repository = new OrderRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean database
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.customer.deleteMany();
  });

  it('should create order with items', async () => {
    // Seed data
    const customer = await prisma.customer.create({
      data: { email: 'test@example.com', name: 'Test User' },
    });

    const product = await prisma.product.create({
      data: { name: 'Croissant', price: 2.50, stock: 100 },
    });

    // Test repository
    const order = await repository.create({
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 2 }],
    });

    expect(order.id).toBeDefined();
    expect(order.items).toHaveLength(1);
    expect(order.total).toBe(5.00);
  });
});
```

## E2E Testing

### Cypress Configuration

```javascript
// apps/bakery-shop-e2e/cypress.config.ts
import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__dirname),
    baseUrl: 'http://localhost:4200',
    supportFile: 'src/support/e2e.ts',
    specPattern: 'src/integration/**/*.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
  },
});
```

### E2E Test Examples

```typescript
// apps/bakery-shop-e2e/src/integration/shopping-flow.cy.ts
describe('Shopping Flow', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.intercept('GET', '/api/products', { fixture: 'products.json' });
  });

  it('should complete purchase flow', () => {
    // Browse products
    cy.get('[data-cy=product-grid]').should('be.visible');
    cy.get('[data-cy=product-card]').should('have.length.at.least', 1);

    // Add to cart
    cy.get('[data-cy=product-card]').first().within(() => {
      cy.get('[data-cy=add-to-cart]').click();
    });

    // Cart indicator should update
    cy.get('[data-cy=cart-count]').should('contain', '1');

    // Go to cart
    cy.get('[data-cy=cart-button]').click();
    cy.url().should('include', '/cart');

    // Update quantity
    cy.get('[data-cy=quantity-input]').clear().type('3');
    cy.get('[data-cy=cart-total]').should('contain', '€7.50');

    // Proceed to checkout
    cy.get('[data-cy=checkout-button]').click();

    // Fill checkout form
    cy.get('[data-cy=customer-name]').type('John Doe');
    cy.get('[data-cy=customer-email]').type('john@example.com');
    cy.get('[data-cy=delivery-address]').type('123 Main St');

    // Complete order
    cy.get('[data-cy=place-order]').click();

    // Verify success
    cy.url().should('include', '/order-confirmation');
    cy.get('[data-cy=order-number]').should('be.visible');
  });

  it('should handle out of stock items', () => {
    cy.intercept('POST', '/api/cart/add', {
      statusCode: 400,
      body: { error: 'Product out of stock' },
    });

    cy.get('[data-cy=product-card]').first().within(() => {
      cy.get('[data-cy=add-to-cart]').click();
    });

    cy.get('[data-cy=error-toast]').should('contain', 'out of stock');
  });
});
```

## Test Configuration

### Jest Configuration

```javascript
// jest.config.base.js
module.exports = {
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.spec.json' },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### Testing Library Setup

```typescript
// libs/shared/test-utils/src/lib/test-utils.tsx
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from '@bakery/shared/ui';

interface TestProviderProps {
  children: React.ReactNode;
}

function TestProviders({ children }: TestProviderProps) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: TestProviders, ...options });
}

export * from '@testing-library/react';
```

## Testing Best Practices

### 1. Test Structure

Follow the AAA pattern:
```typescript
describe('Component/Function', () => {
  it('should do something specific', () => {
    // Arrange
    const input = { value: 42 };
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe(42);
  });
});
```

### 2. Test Data Builders

```typescript
// libs/shared/test-utils/src/lib/builders/order.builder.ts
export class OrderBuilder {
  private order = {
    id: 'order-123',
    customerId: 'cust-123',
    items: [],
    status: 'pending',
    total: 0,
    createdAt: new Date(),
  };

  withId(id: string) {
    this.order.id = id;
    return this;
  }

  withItems(items: OrderItem[]) {
    this.order.items = items;
    this.order.total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return this;
  }

  build() {
    return { ...this.order };
  }
}

// Usage
const order = new OrderBuilder()
  .withId('test-order')
  .withItems([{ productId: '1', quantity: 2, price: 5 }])
  .build();
```

### 3. Mock Strategies

```typescript
// libs/shared/test-utils/src/lib/mocks/api.mocks.ts
import { rest } from 'msw';
import { setupServer } from 'msw/node';

export const handlers = [
  rest.get('/api/products', (req, res, ctx) => {
    return res(
      ctx.json([
        { id: '1', name: 'Croissant', price: 2.50 },
        { id: '2', name: 'Baguette', price: 1.80 },
      ])
    );
  }),

  rest.post('/api/orders', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'order-123',
        status: 'pending',
        ...req.body,
      })
    );
  }),
];

export const server = setupServer(...handlers);

// Setup in test file
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 4. Visual Regression Testing

```typescript
// .storybook/test-runner.ts
import { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  async postRender(page, context) {
    // Take screenshot for visual regression
    await page.screenshot({
      path: `screenshots/${context.id}.png`,
      fullPage: true,
    });
  },
};

export default config;
```

## Continuous Testing

### Pre-commit Hooks

```json
// .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

nx affected:lint
nx affected:test
```

### CI Pipeline Testing

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: nx affected:test --parallel=3
      - run: nx affected:e2e --parallel=1
      - uses: codecov/codecov-action@v3
        with:
          directory: ./coverage
```