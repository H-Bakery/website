# Bakery Monorepo Refactoring Documentation

## Overview

This document tracks the detailed migration of existing website code from `/src` to the appropriate Nx apps/libs folders. The migration transforms a monolithic Next.js application into a well-organized, scalable Nx monorepo.

## Migration Status: 🚧 **IN PROGRESS**

### Completed ✅

- [x] Nx monorepo structure created
- [x] Apps and libs folders generated
- [x] TypeScript path mappings configured
- [x] Deployment scripts created for Raspberry Pi

### In Progress 🔄

- [ ] Phase 1: Shared libraries and utilities migration
- [ ] Phase 2: Core services and contexts migration
- [ ] Phase 3: UI components migration
- [ ] Phase 4: Landing page app migration
- [ ] Phase 5: Shop app migration
- [ ] Phase 6: Management app migration
- [ ] Phase 7: Import path updates and testing

## Current Architecture Analysis

### Source Structure (Current)

```
src/
├── app/                    # Next.js App Router pages
│   ├── (user)/            # Customer-facing pages
│   ├── admin/             # Admin dashboard pages
│   ├── products/          # Product browsing
│   ├── cart/              # Shopping cart
│   └── bestellen/         # Order placement
├── components/            # All React components
│   ├── admin/            # Admin-specific components
│   ├── home/             # Landing page components
│   ├── cart/             # Cart functionality
│   ├── products/         # Product components
│   └── shared/           # Reusable components
├── services/             # API clients and business logic
├── types/                # TypeScript definitions
├── utils/                # Utility functions
├── hooks/                # Custom React hooks
├── context/              # React contexts
└── mocks/                # Mock data for development
```

### Target Structure (Nx Monorepo)

```
apps/
├── bakery-landing/       # Marketing website
├── bakery-shop/          # E-commerce application
├── bakery-management/    # Admin dashboard
└── bakery-api/           # Backend API

libs/
├── shared/
│   ├── ui/              # Reusable UI components
│   ├── types/           # TypeScript definitions
│   ├── utils/           # Utility functions
│   └── data-access/     # Services, hooks, contexts
├── bakery-shop/
│   ├── feature-cart/    # Shopping cart feature
│   └── feature-catalog/ # Product catalog feature
└── bakery-management/
    ├── feature-orders/  # Order management
    └── feature-inventory/ # Inventory management
```

## Detailed Migration Map

### Phase 1: Shared Libraries and Utilities ⏳

| Source File                       | Target Location                                     | Status | Notes                 |
| --------------------------------- | --------------------------------------------------- | ------ | --------------------- |
| `src/types/index.ts`              | `libs/shared/types/src/lib/index.ts`                | ⏳     | Core type definitions |
| `src/types/**`                    | `libs/shared/types/src/lib/**`                      | ⏳     | All TypeScript types  |
| `src/utils/AppConfig.ts`          | `libs/shared/utils/src/lib/app-config.ts`           | ⏳     | App configuration     |
| `src/utils/formatPrice.ts`        | `libs/shared/utils/src/lib/format-price.ts`         | ⏳     | Price formatting      |
| `src/utils/createEmotionCache.ts` | `libs/shared/utils/src/lib/create-emotion-cache.ts` | ⏳     | Emotion cache         |
| `src/utils/**`                    | `libs/shared/utils/src/lib/**`                      | ⏳     | All utility functions |

### Phase 2: Core Services and Contexts ⏳

| Source File                    | Target Location                                             | Status | Notes               |
| ------------------------------ | ----------------------------------------------------------- | ------ | ------------------- |
| `src/services/bakeryAPI.ts`    | `libs/shared/data-access/src/lib/bakery-api.ts`             | ⏳     | Main API service    |
| `src/services/**`              | `libs/shared/data-access/src/lib/services/**`               | ⏳     | All service files   |
| `src/hooks/**`                 | `libs/shared/data-access/src/lib/hooks/**`                  | ⏳     | Custom React hooks  |
| `src/context/AuthContext.tsx`  | `libs/shared/data-access/src/lib/context/auth-context.tsx`  | ⏳     | Authentication      |
| `src/context/ThemeContext.tsx` | `libs/shared/data-access/src/lib/context/theme-context.tsx` | ⏳     | Theme management    |
| `src/context/CartContext.tsx`  | `libs/bakery-shop/feature-cart/src/lib/cart-context.tsx`    | ⏳     | Shopping cart state |
| `src/mocks/**`                 | `libs/shared/data-access/src/lib/mocks/**`                  | ⏳     | Mock data           |

### Phase 3: UI Components ⏳

| Source File                          | Target Location                               | Status | Notes             |
| ------------------------------------ | --------------------------------------------- | ------ | ----------------- |
| `src/components/button/**`           | `libs/shared/ui/src/lib/button/**`            | ⏳     | Reusable buttons  |
| `src/components/icons/**`            | `libs/shared/ui/src/lib/icons/**`             | ⏳     | Icon components   |
| `src/components/header/**`           | `libs/shared/ui/src/lib/header/**`            | ⏳     | Navigation header |
| `src/components/footer/**`           | `libs/shared/ui/src/lib/footer/**`            | ⏳     | Site footer       |
| `src/components/theme/**`            | `libs/shared/ui/src/lib/theme/**`             | ⏳     | Theme components  |
| `src/components/Hero.tsx`            | `libs/shared/ui/src/lib/hero.tsx`             | ⏳     | Hero component    |
| `src/components/Input.tsx`           | `libs/shared/ui/src/lib/input.tsx`            | ⏳     | Input component   |
| `src/components/MarkdownDisplay.tsx` | `libs/shared/ui/src/lib/markdown-display.tsx` | ⏳     | Markdown renderer |

### Phase 4: Landing Page App ⏳

| Source File                       | Target Location                                         | Status | Notes              |
| --------------------------------- | ------------------------------------------------------- | ------ | ------------------ |
| `src/app/(user)/page.tsx`         | `apps/bakery-landing/src/app/page.tsx`                  | ⏳     | Homepage           |
| `src/app/about/page.tsx`          | `apps/bakery-landing/src/app/about/page.tsx`            | ⏳     | About page         |
| `src/app/imprint/page.tsx`        | `apps/bakery-landing/src/app/imprint/page.tsx`          | ⏳     | Imprint page       |
| `src/app/docs/page.tsx`           | `apps/bakery-landing/src/app/docs/page.tsx`             | ⏳     | Documentation      |
| `src/app/infotv/page.tsx`         | `apps/bakery-landing/src/app/infotv/page.tsx`           | ⏳     | Info TV display    |
| `src/components/home/**`          | `apps/bakery-landing/src/components/home/**`            | ⏳     | Landing components |
| `src/components/info/**`          | `apps/bakery-landing/src/components/info/**`            | ⏳     | Info components    |
| `src/components/CallToAction.tsx` | `apps/bakery-landing/src/components/call-to-action.tsx` | ⏳     | CTA component      |

### Phase 5: Shop App ⏳

| Source File                  | Target Location                               | Status | Notes           |
| ---------------------------- | --------------------------------------------- | ------ | --------------- |
| `src/app/products/**`        | `apps/bakery-shop/src/app/products/**`        | ⏳     | Product pages   |
| `src/app/cart/page.tsx`      | `apps/bakery-shop/src/app/cart/page.tsx`      | ⏳     | Cart page       |
| `src/app/bestellen/page.tsx` | `apps/bakery-shop/src/app/orders/page.tsx`    | ⏳     | Order page      |
| `src/app/news/**`            | `apps/bakery-shop/src/app/news/**`            | ⏳     | News pages      |
| `src/app/login/page.tsx`     | `apps/bakery-shop/src/app/login/page.tsx`     | ⏳     | Login page      |
| `src/components/cart/**`     | `libs/bakery-shop/feature-cart/src/lib/**`    | ⏳     | Cart feature    |
| `src/components/products/**` | `libs/bakery-shop/feature-catalog/src/lib/**` | ⏳     | Product catalog |

### Phase 6: Management App ⏳

| Source File                        | Target Location                                       | Status | Notes                |
| ---------------------------------- | ----------------------------------------------------- | ------ | -------------------- |
| `src/app/admin/**`                 | `apps/bakery-management/src/app/**`                   | ⏳     | All admin pages      |
| `src/components/admin/**`          | `apps/bakery-management/src/components/**`            | ⏳     | Admin components     |
| `src/components/dashboard/**`      | `apps/bakery-management/src/components/dashboard/**`  | ⏳     | Dashboard components |
| `src/components/bakery/**`         | `apps/bakery-management/src/components/bakery/**`     | ⏳     | Bakery management    |
| `src/components/production/**`     | `apps/bakery-management/src/components/production/**` | ⏳     | Production features  |
| `src/components/orders/**`         | `libs/bakery-management/feature-orders/src/lib/**`    | ⏳     | Order management     |
| `src/components/admin/products/**` | `libs/bakery-management/feature-inventory/src/lib/**` | ⏳     | Inventory management |

## Import Path Transformations

### Before (Relative Imports)

```typescript
import { bakeryAPI } from '../../../services/bakeryAPI'
import Button from '../../../components/button/Index'
import { Product } from '../../../types'
import { formatPrice } from '../../../utils/formatPrice'
```

### After (Nx Path Mapping)

```typescript
import { bakeryAPI } from '@bakery/shared/data-access'
import { Button } from '@bakery/shared/ui'
import { Product } from '@bakery/shared/types'
import { formatPrice } from '@bakery/shared/utils'
```

## Module Boundaries

### Enforced Rules

1. **Apps can import from**: `@bakery/shared/*` and their own domain libs
2. **Shared libs cannot import from**: Apps or domain-specific features
3. **Feature libs can import from**: `@bakery/shared/*` only
4. **Domain separation**: No cross-imports between shop ↔ management

### Dependency Graph

```
apps/bakery-landing     ─→ libs/shared/*
apps/bakery-shop        ─→ libs/shared/*, libs/bakery-shop/*
apps/bakery-management  ─→ libs/shared/*, libs/bakery-management/*

libs/bakery-shop/*      ─→ libs/shared/*
libs/bakery-management/* ─→ libs/shared/*
libs/shared/*           ─→ (no dependencies)
```

## Testing Strategy

1. **Preserve test files**: Move alongside their components
2. **Update test imports**: Use new `@bakery/*` paths
3. **Batch testing**: Test after each phase completion
4. **Integration testing**: Ensure apps work independently
5. **E2E testing**: Verify complete user workflows

## Quality Assurance Checklist

### After Each Phase

- [ ] All files moved correctly
- [ ] No broken imports or references
- [ ] TypeScript compilation passes
- [ ] Tests run successfully
- [ ] Nx project graph validates
- [ ] Apps serve correctly in development

### Final Validation

- [ ] All apps build successfully
- [ ] All libraries build successfully
- [ ] Import paths use `@bakery/*` namespace
- [ ] Module boundaries enforced
- [ ] Tests pass in all packages
- [ ] Production builds work
- [ ] Deployment scripts updated

## Rollback Plan

If issues occur during migration:

1. **Stop current phase** immediately
2. **Revert to last known good state** using git
3. **Identify and fix issues** before continuing
4. **Re-run tests** to ensure stability
5. **Resume migration** from safe checkpoint

## Notes and Decisions

### JavaScript to TypeScript Conversion

✅ **Not needed** - All source files are already TypeScript (.tsx/.ts)

### File Naming Conventions

- Convert PascalCase to kebab-case for consistency
- Example: `CallToAction.tsx` → `call-to-action.tsx`
- Keep component exports as PascalCase

### Performance Considerations

- Lazy loading for large feature libraries
- Code splitting at app boundaries
- Shared dependencies minimized

### Development Workflow

- Each app can be developed independently
- Shared libraries provide consistency
- Hot reloading works per-app
- Testing isolated by package

---

**Last Updated**: 2025-01-02  
**Migration Progress**: 10% (Structure created, documentation complete)  
**Next Phase**: Phase 1 - Shared libraries and utilities migration
