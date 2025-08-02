# Bakery Website - Nx Monorepo

Modern bakery management system with e-commerce, admin dashboard, and marketing site.

## 🚀 Quick Start

```bash
npm install
npm run serve:all        # Start all applications
```

**Applications:**

- Shop: http://localhost:4200
- Management: http://localhost:3001
- Landing: http://localhost:3000
- API: http://localhost:3333

## 📁 Structure

```
apps/
├── bakery-landing/      # Marketing site (Next.js)
├── bakery-shop/         # E-commerce (Next.js + Material UI)
├── bakery-management/   # Admin dashboard (Next.js)
└── bakery-api/          # Backend API (Express)

libs/
├── shared/              # Shared code (types, utils, UI, contexts)
├── bakery-shop/         # Shop features (cart, catalog)
└── bakery-management/   # Admin features (orders, inventory)
```

## 🛠️ Development

```bash
# Serve specific apps
npm run serve:shop
npm run serve:management
npm run serve:landing

# Testing
npm run test:unit        # All unit tests
npm run test:e2e         # All E2E tests
npm run test:unit:shop   # App-specific tests

# Code quality
npm run lint:all
npm run format
npm run validate        # Lint + type-check + test
```

## 🚢 Deployment

**Automatic:** Push to `main` deploys to production

**Platforms:**

- Landing → GitHub Pages
- Shop/Management → Vercel
- API → Google Cloud Run

## 📚 Documentation

- [Architecture](./docs/architecture.md)
- [Development](./docs/development.md)
- [CI/CD](./docs/ci-cd.md)
- [Testing](./docs/testing.md)
- [Deployment](./docs/deployment.md)
- [Monitoring](./docs/monitoring.md)
