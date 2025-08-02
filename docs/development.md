# Development Guide

## Development Workflow

### Getting Started

```bash
# Clone repository
git clone https://github.com/yourusername/bakery-monorepo.git
cd bakery-monorepo

# Install dependencies
npm install

# Start development
npm run dev              # Starts all services
npm run dev:shop         # Start only shop
npm run dev:api          # Start only API
```

### Nx Commands

#### Essential Commands

```bash
# Serve applications
nx serve bakery-shop
nx serve bakery-management --port=4201
nx serve bakery-api --port=3333

# Build applications
nx build bakery-shop --configuration=production
nx affected:build --base=main

# Run tests
nx test bakery-shop
nx affected:test
nx run-many --target=test --all

# Linting and formatting
nx affected:lint
nx format:write
```

#### Code Generation

```bash
# Generate new application
nx g @nx/next:app my-app

# Generate new library
nx g @nx/react:lib feature-name --directory=libs/bakery-shop

# Generate component
nx g @nx/react:component button --project=shared-ui

# Generate service
nx g @nx/node:service order --project=bakery-api
```

## Project Structure Best Practices

### Application Structure

```
apps/bakery-shop/
├── app/                    # Next.js 15 app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── products/
│       ├── page.tsx       # Products list
│       └── [id]/
│           └── page.tsx   # Product detail
├── components/            # App-specific components
├── hooks/                 # App-specific hooks
├── services/              # API service layer
└── project.json          # Nx configuration
```

### Library Structure

```
libs/bakery-shop/feature-cart/
├── src/
│   ├── lib/
│   │   ├── cart-context.tsx
│   │   ├── cart-provider.tsx
│   │   ├── hooks/
│   │   │   └── use-cart.ts
│   │   └── components/
│   │       ├── cart-item.tsx
│   │       └── cart-summary.tsx
│   ├── index.ts           # Public API
│   └── test-setup.ts
├── project.json
├── tsconfig.json
└── README.md
```

## Code Organization

### Module Boundaries

Configure in `.eslintrc.json`:
```json
{
  "overrides": [
    {
      "files": ["*.ts", "*.tsx"],
      "rules": {
        "@nx/enforce-module-boundaries": [
          "error",
          {
            "enforceBuildableLibDependency": true,
            "allow": [],
            "depConstraints": [
              {
                "sourceTag": "scope:shop",
                "onlyDependOnLibsWithTags": ["scope:shop", "scope:shared"]
              },
              {
                "sourceTag": "scope:management",
                "onlyDependOnLibsWithTags": ["scope:management", "scope:shared"]
              },
              {
                "sourceTag": "type:feature",
                "onlyDependOnLibsWithTags": ["type:feature", "type:ui", "type:data-access", "type:util"]
              },
              {
                "sourceTag": "type:ui",
                "onlyDependOnLibsWithTags": ["type:ui", "type:util"]
              },
              {
                "sourceTag": "type:util",
                "onlyDependOnLibsWithTags": ["type:util"]
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### Import Paths

Configure in `tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@bakery/shared/ui": ["libs/shared/ui/src/index.ts"],
      "@bakery/shared/types": ["libs/shared/types/src/index.ts"],
      "@bakery/shared/utils": ["libs/shared/utils/src/index.ts"],
      "@bakery/shop/*": ["libs/bakery-shop/*/src/index.ts"],
      "@bakery/management/*": ["libs/bakery-management/*/src/index.ts"]
    }
  }
}
```

## Development Best Practices

### 1. Component Development

```typescript
// libs/shared/ui/src/lib/button/button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@bakery/shared/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium',
          {
            'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
            'bg-gray-200 text-gray-900 hover:bg-gray-300': variant === 'secondary',
            'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-base': size === 'md',
            'px-6 py-3 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
```

### 2. Service Layer Pattern

```typescript
// libs/shared/data-access/src/lib/api-client.ts
export class ApiClient {
  constructor(private baseUrl: string) {}

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
```

### 3. State Management

```typescript
// libs/bakery-shop/feature-cart/src/lib/cart-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartState {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (product) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === product.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === product.id
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            };
          }
          return {
            items: [...state.items, { ...product, quantity: 1 }],
          };
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== productId),
        })),

      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === productId ? { ...i, quantity } : i
          ),
        })),

      clearCart: () => set({ items: [] }),

      get total() {
        return get().items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
      },
    }),
    {
      name: 'bakery-cart',
    }
  )
);
```

### 4. Error Handling

```typescript
// libs/shared/utils/src/lib/error-boundary.tsx
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong.</div>;
    }

    return this.props.children;
  }
}
```

## Git Workflow

### Branch Strategy

```
main                 # Production-ready code
├── develop          # Integration branch
    ├── feature/*    # Feature branches
    ├── bugfix/*     # Bug fixes
    └── hotfix/*     # Emergency fixes
```

### Commit Messages

Follow conventional commits:
```bash
feat: add shopping cart functionality
fix: resolve checkout button alignment issue
docs: update API documentation
style: format code with prettier
refactor: extract payment logic to service
test: add unit tests for order service
chore: update dependencies
```

### Pull Request Process

1. Create feature branch
```bash
git checkout -b feature/add-delivery-tracking
```

2. Make changes and commit
```bash
git add .
git commit -m "feat: add delivery tracking to order page"
```

3. Run affected checks
```bash
nx affected:lint
nx affected:test
nx affected:build
```

4. Push and create PR
```bash
git push origin feature/add-delivery-tracking
```

## Environment Setup

### VS Code Extensions

Recommended extensions in `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "nrwl.angular-console",
    "firsttris.vscode-jest-runner",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma"
  ]
}
```

### Workspace Settings

`.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

## Performance Optimization

### 1. Build Optimization

```json
// nx.json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nrwl/nx-cloud",
      "options": {
        "cacheableOperations": ["build", "lint", "test", "e2e"],
        "parallel": 3,
        "cacheDirectory": ".nx/cache"
      }
    }
  }
}
```

### 2. Development Performance

```bash
# Use Nx computation caching
nx build bakery-shop --skip-nx-cache=false

# Run only affected
nx affected:build --base=main

# Use Nx Cloud for distributed caching
nx connect-to-nx-cloud
```

### 3. Bundle Size Optimization

```javascript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
          },
        },
      };
    }
    return config;
  },
};
```

## Debugging

### Backend Debugging

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["nx", "serve", "bakery-api"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Frontend Debugging

```bash
# Debug in Chrome DevTools
npm run dev:shop -- --inspect

# Debug tests
nx test bakery-shop --watch --debug
```