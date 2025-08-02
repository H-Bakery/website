# Migration Guide

This guide provides a step-by-step approach to migrate the existing bakery project to an Nx monorepo architecture.

## Migration Timeline

Total estimated time: 12-14 weeks

### Phase 1: Foundation Setup (Weeks 1-2)
### Phase 2: Backend Migration (Weeks 3-4)
### Phase 3: Frontend Migration (Weeks 5-6)
### Phase 4: Shop System Development (Weeks 7-8)
### Phase 5: CI/CD Pipeline Setup (Weeks 9-10)
### Phase 6: Delivery System Addition (Weeks 11-12)
### Phase 7: Optimization and Polish (Weeks 13-14)

## Phase 1: Foundation Setup

### 1.1 Create Nx Workspace

```bash
# Create new Nx workspace
npx create-nx-workspace@latest bakery-monorepo \
  --preset=apps \
  --packageManager=npm

# Navigate to workspace
cd bakery-monorepo

# Add necessary Nx plugins
npm install -D @nx/next @nx/react @nx/node @nx/express @nx/jest
```

### 1.2 Configure Workspace

Create `nx.json`:
```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nx/workspace/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "lint", "test", "e2e"]
      }
    }
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    },
    "test": {
      "inputs": ["default", "^production", "{workspaceRoot}/jest.preset.js"]
    }
  }
}
```

### 1.3 Create Shared Libraries

```bash
# Create shared UI library
nx g @nx/react:lib ui --directory=libs/shared --tags=scope:shared,type:ui

# Create shared types
nx g @nx/js:lib types --directory=libs/shared --tags=scope:shared,type:util

# Create shared utilities
nx g @nx/js:lib utils --directory=libs/shared --tags=scope:shared,type:util
```

## Phase 2: Backend Migration

### 2.1 Import Existing Backend

```bash
# Import backend with git history
nx import ../backend --destination=apps/bakery-api

# Restructure to modular architecture
cd apps/bakery-api
mkdir -p src/modules/{orders,inventory,customers,delivery}
```

### 2.2 Refactor to Modules

Create module structure:
```typescript
// apps/bakery-api/src/modules/orders/order.module.ts
import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderRepository } from './order.repository';

@Module({
  controllers: [OrderController],
  providers: [OrderService, OrderRepository],
  exports: [OrderService]
})
export class OrderModule {}
```

### 2.3 Database Migration

```sql
-- Create schemas for separation
CREATE SCHEMA IF NOT EXISTS orders;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS customers;

-- Migrate existing tables
ALTER TABLE public.orders SET SCHEMA orders;
ALTER TABLE public.products SET SCHEMA inventory;
ALTER TABLE public.users SET SCHEMA customers;
```

## Phase 3: Frontend Migration

### 3.1 Migrate Landing Page

```bash
# Create landing app
nx g @nx/next:app bakery-landing --style=scss

# Copy existing landing page files
cp -r ../website/pages/landing/* apps/bakery-landing/pages/
cp -r ../website/components/landing/* apps/bakery-landing/components/

# Configure for static export
echo "module.exports = { output: 'export' }" > apps/bakery-landing/next.config.js
```

### 3.2 Create Management System

```bash
# Generate management app
nx g @nx/next:app bakery-management --style=scss

# Create feature libraries
nx g @nx/react:lib feature-inventory \
  --directory=libs/bakery-management \
  --tags=scope:management,type:feature

nx g @nx/react:lib feature-orders \
  --directory=libs/bakery-management \
  --tags=scope:management,type:feature
```

### 3.3 Migrate Existing Components

```bash
# Create migration script
cat > migrate-components.js << 'EOF'
const fs = require('fs');
const path = require('path');

// Map old paths to new library structure
const componentMap = {
  'components/admin/Orders': 'libs/bakery-management/feature-orders',
  'components/admin/Inventory': 'libs/bakery-management/feature-inventory',
  'components/common': 'libs/shared/ui'
};

// Execute migration
Object.entries(componentMap).forEach(([oldPath, newPath]) => {
  // Migration logic here
});
EOF

node migrate-components.js
```

## Phase 4: Shop System Development

### 4.1 Create Shop Application

```bash
# Generate shop app
nx g @nx/next:app bakery-shop --style=scss

# Create shop libraries
nx g @nx/react:lib feature-catalog --directory=libs/bakery-shop
nx g @nx/react:lib feature-cart --directory=libs/bakery-shop
nx g @nx/react:lib feature-checkout --directory=libs/bakery-shop
```

### 4.2 Implement E-commerce Features

```typescript
// libs/bakery-shop/feature-cart/src/lib/cart-context.tsx
import { createContext, useContext, useState } from 'react';

interface CartContextType {
  items: CartItem[];
  addItem: (item: Product) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: number;
}

export const CartContext = createContext<CartContextType>(null);
```

## Phase 5: CI/CD Pipeline Setup

### 5.1 GitHub Actions Configuration

Create `.github/workflows/ci.yml`:
```yaml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  affected:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.set-matrix.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: nrwl/nx-set-shas@v4
      - run: npm ci
      - id: set-matrix
        run: |
          AFFECTED=$(npx nx show projects --affected --with-target=build)
          echo "matrix={\"project\":$(echo $AFFECTED | jq -R -s -c 'split("\n")[:-1]')}" >> $GITHUB_OUTPUT

  build:
    needs: affected
    runs-on: ubuntu-latest
    strategy:
      matrix: ${{fromJson(needs.affected.outputs.matrix)}}
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx nx build ${{ matrix.project }}
      - run: npx nx test ${{ matrix.project }}
```

### 5.2 Docker Configuration

Create `apps/bakery-api/Dockerfile`:
```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx nx build bakery-api --prod

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist/apps/bakery-api ./
EXPOSE 3333
CMD ["node", "main.js"]
```

## Phase 6: Delivery System Addition

### 6.1 Create Delivery App

```bash
# Generate delivery app
nx g @nx/react:app bakery-delivery

# Create delivery libraries
nx g @nx/react:lib feature-tracking --directory=libs/bakery-delivery
nx g @nx/react:lib feature-routing --directory=libs/bakery-delivery
```

### 6.2 Implement Real-time Features

```typescript
// apps/bakery-delivery/src/app/services/websocket.service.ts
import { io, Socket } from 'socket.io-client';

export class WebSocketService {
  private socket: Socket;

  connect() {
    this.socket = io(process.env.NX_API_URL);
    
    this.socket.on('delivery.update', (data) => {
      // Handle delivery updates
    });
  }
}
```

## Phase 7: Optimization and Polish

### 7.1 Performance Optimization

```bash
# Analyze bundle sizes
nx run-many --target=build --all --configuration=production
nx run bakery-shop:analyze

# Implement lazy loading
nx g @nx/react:lib feature-reports \
  --directory=libs/bakery-management \
  --lazy
```

### 7.2 Documentation

```bash
# Generate architecture documentation
nx g @nx/workspace:run-commands document \
  --project=workspace \
  --command="npx compodoc -p tsconfig.base.json"

# Set up Storybook
nx g @nx/storybook:configuration bakery-shop --uiFramework=@storybook/react
```

## Migration Checklist

### Pre-migration
- [ ] Backup existing repositories
- [ ] Document current architecture
- [ ] Create migration branch
- [ ] Notify team of migration schedule

### During Migration
- [ ] Set up Nx workspace
- [ ] Migrate backend to modular architecture
- [ ] Import frontend applications
- [ ] Create shared libraries
- [ ] Set up CI/CD pipelines
- [ ] Configure deployment targets

### Post-migration
- [ ] Run comprehensive tests
- [ ] Update documentation
- [ ] Train team on new structure
- [ ] Monitor performance metrics
- [ ] Plan incremental improvements

## Rollback Strategy

In case of issues:

1. **Keep old repositories** intact for 30 days
2. **Tag stable versions** before major changes
3. **Document breaking changes** thoroughly
4. **Create rollback scripts** for database changes
5. **Test rollback procedures** in staging

## Success Criteria

- All tests passing in new structure
- Build times reduced by >50%
- Successful deployment of all applications
- Team productive with new tooling
- No degradation in application performance