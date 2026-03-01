# Bakery Website - Claude Code Project Instructions

## Project Overview

This is a full-stack bakery management system built with Next.js, Material UI, and TypeScript in an Nx monorepo architecture.

**Architecture:**

- Frontend: Next.js 15 with App Router, Material UI, TypeScript
- Backend: TypeScript with domain-driven design (Express + Sequelize)
- Testing: Jest + React Testing Library
- State Management: React Context (Theme, Cart, Authentication)
- API Integration: bakeryAPI service with mock data fallback

**Deployment Targets:**

- Landing Page → GitHub Pages (static export)
- Shop System → Vercel (SSR for performance)
- Management System → Vercel (CSR for interactivity)
- Backend API → Google Cloud Run (containerized)

## Quick Commands

### Development

```bash
npm run dev                 # Start development server
npm run build              # Build for production
npm run test               # Run tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
npm run lint               # Run ESLint
```

### Nx Commands

```bash
# Development (working services)
npm run dev:landing          # Landing page (port 3000) ✓
npm run serve:shop           # Shop app (port 4200) ✓
npm run serve:management     # Management app (port 4201) ✓
npm run serve:api:simple     # Simple API server with mock data (port 5000) ✓

# API (TypeScript build - has compilation errors, see TASK-001)
npm run serve:api            # Full TS API - currently broken due to migration issues

# Building
nx build bakery-shop       # Build shop app
nx next:build bakery-landing  # Build landing page with Nx dependencies
nx build-static-standalone bakery-landing  # Build landing page standalone (recommended)
nx affected:build          # Build only affected projects

# Static Export (Landing Page)
nx build-static-standalone bakery-landing  # Recommended: standalone static build
npm run build:landing:static               # Same as above
npm run build:landing:nx                   # Uses Nx dependencies (may fail)
nx build-static bakery-landing             # Full Nx build + export

# Testing & Quality
nx affected:test           # Test only affected projects
nx affected:lint           # Lint affected projects
nx format:write            # Format code
```

## Project Structure (Nx Monorepo)

```
website/
├── apps/                              # Applications (deployable units)
│   ├── bakery-landing/               # Public landing page (GitHub Pages) - port 3000
│   ├── bakery-shop/                  # Customer e-commerce (Vercel SSR)
│   ├── bakery-management/            # Internal management (Vercel CSR)
│   ├── bakery-delivery/              # Delivery tracking app
│   ├── bakery-api/                   # Backend API (Cloud Run) - port 5000
│   └── *-e2e/                        # E2E test apps for each application
├── libs/                             # Shared libraries
│   ├── api/                          # API domain libraries
│   ├── shared/                       # Cross-app shared code (types, utils, UI)
│   ├── bakery-management/            # Management-specific feature libs
│   ├── bakery-shop/                  # Shop-specific feature libs
│   ├── bakery-delivery-routing/      # Delivery routing logic
│   └── bakery-delivery-tracking/     # Delivery tracking logic
├── content/                          # Content files (news, markdown)
├── docs/                             # Documentation
│   ├── architecture.md               # System design
│   ├── development.md                # Dev workflow
│   └── testing-guide.md              # Testing strategies
└── monitoring/                       # Monitoring configuration
```

## Key Features

### Customer Experience

- Product browsing with category filtering
- Shopping cart with persistence
- Real-time inventory checking
- German localization throughout

### Admin Dashboard

- Order management with DataGrid
- Inventory tracking
- Production workflow management
- User authentication with JWT

## Testing Guidelines

- Write tests alongside implementation
- Maintain >80% coverage
- Use React Testing Library best practices
- Run `npm test` before committing

## Development Workflow

1. Check current status: `git status`
2. Run tests: `npm test`
3. Lint code: `npm run lint`
4. Build to verify: `npm run build`

## Service Status (as of 2026-03-01)

| Service       | Command                    | Port | Status                                       |
| ------------- | -------------------------- | ---- | -------------------------------------------- |
| Landing Page  | `npm run dev:landing`      | 3000 | Working                                      |
| Shop          | `npm run serve:shop`       | 4200 | Working                                      |
| Management    | `npm run serve:management` | 4201 | Working                                      |
| API (simple)  | `npm run serve:api:simple` | 5000 | Working (mock data)                          |
| API (full TS) | `npm run serve:api`        | 5000 | Broken (TS compilation errors, see TASK-001) |

The full TypeScript API (`bakery-api`) has systemic compilation errors from an incomplete JS→TS migration. Use `serve:api:simple` for a working API with mock endpoints.

## Important Notes

- Always check existing patterns before implementing new features
- Follow existing code conventions and component structure
- German localization throughout customer-facing apps

## Task Management (MissionControl)

Tasks managed via `mc` CLI. Files in `.mc/tasks/` as markdown with YAML frontmatter.

Quick reference:

```bash
mc status              # Dashboard
mc task board          # Kanban board
mc task next           # Next actionable task
mc new task "Title"    # Create task
mc task move TASK-NNN in-progress  # Change status
mc mcp                 # Start MCP server (stdio)
```

## Documentation References

For detailed information, see:

- Architecture: @docs/architecture.md
- Development Guide: @docs/development.md

## Static Landing Page Build & Deployment

### Building for Static Export

The landing page (`apps/bakery-landing/`) is configured for static export to GitHub Pages, Vercel, or any static hosting:

**Recommended Build Commands:**

```bash
# Clean stale cache first (required if dev server was running)
rm -rf apps/bakery-landing/.next

# Standalone build (always works, recommended)
NODE_ENV=production npx nx build-static-standalone bakery-landing

# Or via npm script
npm run build:landing:static
```

**Output Location:** `apps/bakery-landing/out/` (ready for deployment)

### Deployment Options

- **GitHub Pages**: Upload `out/` contents or use GitHub Actions workflow
- **Traditional Hosting**: Upload `out/` directory to web server

### Troubleshooting Static Builds

**Problem: Build fails with `<Html> should not be imported outside of pages/_document` or `Cannot find module for page`**

```bash
# Cause: Stale .next cache from dev server. Always clean before building.
rm -rf apps/bakery-landing/.next
NODE_ENV=production npx nx build-static-standalone bakery-landing
```

**Problem: Nx build fails with shared library TypeScript errors**

```bash
# Solution: Use standalone build that avoids problematic dependencies
npm run build:landing:static
```

**Problem: Module resolution errors for @bakery/\* imports**

```bash
# Solution: Ensure tsconfig extends the base configuration
# File: apps/bakery-landing/tsconfig.json should have:
# "extends": "../../tsconfig.base.json"
```

**Problem: Cannot resolve shared library modules**

```bash
# Solution: Build required shared libraries first
nx build shared-utils
nx build shared-types
# Then try the landing page build again
```
