# Bakery Website - Nx Monorepo

Modern bakery management system with e-commerce, admin dashboard, and marketing site.

## 🚀 Quick Start

```bash
npm install
npm run serve:all        # Start all applications
```

**Applications:**

- Landing Page: http://localhost:3000 (Static marketing site)
- Shop: http://localhost:4200 (E-commerce frontend)
- Management: http://localhost:4201 (Admin dashboard)
- API: http://localhost:3333 (Backend services)

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

# Static builds (Landing Page)
npm run build:landing:static    # Standalone build (recommended)
npm run build:landing:nx        # Nx integrated build
nx build-static-standalone bakery-landing  # Direct Nx command

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

### Static Landing Page

The landing page builds to static files for CDN deployment:

```bash
# Build static files (output: apps/bakery-landing/out/)
npm run build:landing:static

# Deploy to GitHub Pages, Vercel, or any static host
```

**Deployment Options:**
- **GitHub Pages**: Upload `out/` folder or use Actions
- **Vercel**: Connect repository for auto-deployment
- **CDN/S3**: Upload `out/` directory contents

### Automatic Deployment

**Push to `main` triggers:**
- Landing → GitHub Pages (static)
- Shop/Management → Vercel (SSR)
- API → Google Cloud Run (container)

## 📚 Documentation

- [Architecture](./docs/architecture.md)
- [Development](./docs/development.md)
- [CI/CD](./docs/ci-cd.md)
- [Testing](./docs/testing.md)
- [Deployment](./docs/deployment.md)
- [Monitoring](./docs/monitoring.md)
