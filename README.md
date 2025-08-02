# Bakery Monorepo

A modern bakery management system built with Nx, featuring a modular monolith backend and micro-frontend architecture.

## Prerequisites

- Node.js 18+
- npm 8+
- Git

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/bakery-monorepo.git
cd bakery-monorepo

# Install dependencies
npm install

# Start development servers
nx serve bakery-shop        # Customer shop at http://localhost:4200
nx serve bakery-management  # Management system at http://localhost:4201
nx serve bakery-api         # Backend API at http://localhost:3333
```

## Project Structure

```
bakery-monorepo/
├── apps/                    # Applications
│   ├── bakery-landing/      # Static landing page
│   ├── bakery-shop/         # Customer e-commerce
│   ├── bakery-management/   # Internal management
│   └── bakery-api/          # Backend API
├── libs/                    # Shared libraries
│   ├── shared/              # Cross-app utilities
│   ├── bakery-shop/         # Shop-specific features
│   └── bakery-management/   # Management features
└── docs/                    # Documentation
```

## Key Commands

```bash
# Development
nx serve <app-name>          # Start dev server
nx build <app-name>          # Build for production
nx test <app-name>           # Run tests
nx affected:build            # Build only affected projects

# Code quality
nx lint <project-name>       # Lint a project
nx format:write              # Format all files

# Deployment
nx deploy bakery-landing     # Deploy landing to GitHub Pages
nx deploy bakery-shop        # Deploy shop to Vercel
nx deploy bakery-api         # Deploy API to Cloud Run
```

## Documentation

- [Architecture Overview](./docs/architecture.md) - System design and technical decisions
- [Migration Guide](./docs/migration-guide.md) - Step-by-step migration from current setup
- [Development Guide](./docs/development.md) - Development workflow and conventions
- [Deployment Guide](./docs/deployment.md) - CI/CD and deployment strategies
- [Testing Guide](./docs/testing.md) - Testing strategies and best practices
- [Monitoring Guide](./docs/monitoring.md) - Performance metrics and monitoring

## License

MIT