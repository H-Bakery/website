# Bakery Monorepo - Development Guide

## Quick Start

This monorepo contains three Next.js applications for the Bäckerei Heusser business:

### Applications

| Application      | Port | Purpose               | URL                   |
| ---------------- | ---- | --------------------- | --------------------- |
| **Landing Page** | 3002 | Static marketing site | http://localhost:3002 |
| **Shop**         | 3010 | E-commerce site       | http://localhost:3010 |
| **Management**   | 3011 | Admin dashboard       | http://localhost:3011 |

### Start Development

```bash
# Start all applications simultaneously
npm run dev:all

# Or start individually
npx nx next:dev bakery-landing --port=3002   # Landing page
npx nx next:dev bakery-shop --port=3010      # Shop
npx nx next:dev bakery-management --port=3011 # Management
```

## Navigation Architecture

All applications use a shared navigation system built with:

- **Shared navigation configuration** (`@bakery/shared/utils`)
- **Reusable navigation components** (`@bakery/shared/ui`)
- **Consistent routing patterns** across all apps

### Cross-Application Navigation

The applications link to each other using environment-aware URLs:

**Development URLs:**

- Landing: http://localhost:3002
- Shop: http://localhost:3010
- Management: http://localhost:3011

**Production URLs:**

- Landing: https://baeckerei-heusser.de
- Shop: https://shop.baeckerei-heusser.de
- Management: https://manage.baeckerei-heusser.de

### Navigation Features

#### Landing Page

- Company information and marketing
- Links to shop for product orders
- Contact information and location
- Mobile-responsive navigation menu

#### Shop Application

- Product catalog and shopping cart
- Order placement and checkout
- Customer-facing interface
- Integration with shared cart context

#### Management Application

- Admin dashboard with sidebar navigation
- Order management and inventory
- Production planning and baking lists
- Protected admin routes

## Library Architecture

### Shared Libraries

- `@bakery/shared/ui` - Reusable UI components
- `@bakery/shared/contexts` - React contexts (theme, cart, auth)
- `@bakery/shared/utils` - Utility functions and navigation config
- `@bakery/shared/types` - TypeScript type definitions

### Feature Libraries

- `@bakery/shop/feature-cart` - Shopping cart functionality
- `@bakery/shop/feature-catalog` - Product browsing
- `@bakery/management/feature-orders` - Order management
- `@bakery/management/feature-inventory` - Inventory management

## Development Workflow

### 1. Starting Development

```bash
# Install dependencies
npm install

# Start development servers
npm run dev:all
```

### 2. Building Applications

```bash
# Build all applications
npx nx run-many --target=build --all

# Build specific application
npx nx build bakery-shop
```

### 3. Testing

```bash
# Run all tests
npx nx run-many --target=test --all

# Run tests for specific library
npx nx test shared-ui
```

### 4. Linting

```bash
# Lint all projects
npx nx run-many --target=lint --all

# Lint specific project
npx nx lint bakery-shop
```

## Common Development Tasks

### Adding New Navigation Items

1. Update navigation configuration in `libs/shared/utils/src/lib/navigation.ts`
2. Add corresponding routes in the target application
3. Update navigation components if needed

### Creating New Components

```bash
# Generate new component in shared UI
npx nx g @nx/react:component my-component --project=shared-ui

# Generate new feature library
npx nx g @nx/react:lib feature-new --directory=libs/bakery-shop
```

### Adding Routes

1. Create page files in `src/app/` directory
2. Update navigation configuration if needed
3. Add breadcrumb mappings if necessary

## Troubleshooting

### Port Conflicts

If ports are in use, update the port numbers in development commands:

```bash
npx nx next:dev bakery-shop --port=4000
```

### Import Errors

Ensure proper import paths:

```typescript
// Correct
import { Button } from '@bakery/shared/ui'

// Incorrect
import { Button } from '../../../libs/shared/ui'
```

### Build Errors

Check that all dependencies are properly exported:

```bash
# Verify exports
npx nx graph --focus=shared-ui
```

## Production Deployment

### Landing Page (GitHub Pages)

```bash
npx nx build bakery-landing
npx nx export bakery-landing
# Deploy ./dist/apps/bakery-landing/exported to GitHub Pages
```

### Shop & Management (Vercel)

```bash
npx nx build bakery-shop
npx nx build bakery-management
# Deploy using Vercel CLI or GitHub integration
```

## Environment Variables

### Development

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SHOP_URL=http://localhost:3010
NEXT_PUBLIC_MANAGEMENT_URL=http://localhost:3011
```

### Production

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.baeckerei-heusser.de
NEXT_PUBLIC_SHOP_URL=https://shop.baeckerei-heusser.de
NEXT_PUBLIC_MANAGEMENT_URL=https://manage.baeckerei-heusser.de
```

## Additional Resources

- [Nx Documentation](https://nx.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Material-UI Documentation](https://mui.com)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
