# Bakery API - Backend Service

## Overview

Express + TypeScript backend API for the bakery management system. Uses Sequelize ORM with SQLite for local development.

- **Port:** 5000
- **Entry:** `src/main.ts`
- **ORM:** Sequelize with TypeScript models
- **Auth:** JWT with role-based access control (admin, staff)

## Project Structure

```
apps/bakery-api/
├── src/
│   ├── main.ts              # App entry point, Express setup
│   ├── controllers/         # Route handlers
│   ├── models/              # Sequelize model definitions
│   ├── routes/              # Express route definitions
│   ├── services/            # Business logic layer
│   ├── middleware/           # Auth, validation, error handling
│   └── config/              # Database and app configuration
├── legacy-archive/          # Pre-migration JavaScript code (reference)
└── project.json             # Nx project configuration
```

## Key Commands

```bash
nx serve bakery-api          # Start dev server (port 5000)
nx build bakery-api          # Build for production
nx test bakery-api           # Run tests
npx tsc --noEmit -p apps/bakery-api/tsconfig.app.json  # Type-check
```

## Key Modules

- **Auth:** JWT login/logout/refresh, bcrypt password hashing
- **Products:** CRUD with CSV import from content repo
- **Orders:** Order lifecycle management
- **Cash:** Daily cash register reconciliation
- **Production:** Batch scheduling and workflow tracking
- **Staff:** Employee management with role assignments
- **Analytics:** Revenue trends, product performance reports

## API Conventions

- All routes prefixed with `/api/`
- Auth middleware on protected routes via `authenticateToken`
- Validation middleware using express-validator
- Error responses follow `{ error: string, details?: any }` format
- Domain libraries in `libs/api/*` for modular architecture

## Current Status

The API has known TypeScript compilation issues (see TASK-001 in `.mc/tasks/`). Many domain modules are partially migrated from the legacy JavaScript codebase. See `mc task board` for the full backlog.
