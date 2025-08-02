# Bakery Website - Claude Code Project Instructions

## Project Overview

This is a full-stack bakery management system built with Next.js, Material UI, and TypeScript. The project is being migrated to an Nx monorepo architecture with a modular monolith backend and micro-frontend architecture.

**Current Architecture:**
- Frontend: Next.js 15 with App Router, Material UI, TypeScript
- Testing: Jest + React Testing Library
- State Management: React Context (Theme, Cart, Authentication)
- API Integration: bakeryAPI service with mock data fallback

**Target Architecture (Nx Monorepo):**
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

### Nx Commands (Migration in Progress)
```bash
nx serve bakery-shop       # Start shop application
nx serve bakery-management # Start management system
nx serve bakery-api        # Start backend API
nx affected:build          # Build only affected projects
nx affected:test           # Test only affected projects
```

## Project Structure

```
website/
├── src/
│   ├── app/               # Next.js app directory
│   ├── components/        # React components
│   ├── context/           # React contexts (Theme, Cart, Auth)
│   ├── services/          # API services
│   ├── types/             # TypeScript definitions
│   └── utils/             # Utility functions
├── docs/                  # Comprehensive documentation
│   ├── architecture.md    # System design
│   ├── migration-guide.md # Nx migration steps
│   ├── deployment.md      # CI/CD configuration
│   ├── development.md     # Dev workflow
│   ├── testing.md         # Testing strategies
│   └── monitoring.md      # Success metrics
└── __tests__/             # Test files
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

## Important Notes

- API base URL: `http://localhost:5000` (backend)
- Frontend dev server: `http://localhost:3000`
- Always check existing patterns before implementing new features
- Follow existing code conventions and component structure

## External Tools & Imports

### Claude Flow Integration
See @claude-flow.md for:
- SPARC methodology and TDD workflow
- Batch operations and parallel execution
- MCP tools for coordination
- Agent patterns and swarm orchestration

### Task Master Integration
See @task-master.md for:
- Task management workflow
- PRD parsing and task generation
- Progress tracking
- Multi-Claude workflows

## Documentation References

For detailed information, see:
- Architecture: @docs/architecture.md
- Migration Plan: @docs/migration-guide.md
- Development Guide: @docs/development.md
- Deployment: @docs/deployment.md
- Testing: @docs/testing.md
- Monitoring: @docs/monitoring.md