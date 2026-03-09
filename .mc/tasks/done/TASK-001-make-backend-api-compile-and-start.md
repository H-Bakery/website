---
id: TASK-001
aliases:
  - TASK-001
title: Make Backend API Compile and Start
slug: make-backend-api-compile-and-start
status: done
priority: 1
owner: ''
projects: []
customers: []
tags:
  - blocker
  - backend-foundation
sprint: ''
depends_on: []
due_date: ''
created: 2026-02-28
updated: 2026-03-09
---

The backend API (apps/bakery-api) has TypeScript compilation errors preventing `nx serve bakery-api` from starting. A simple mock server (`npm run serve:api:simple`) is available as a workaround.

## Progress (2026-03-01)

**Fixed:**

- Renamed `isArray` custom validators to `validateArray` in 4 model files (Sequelize type conflict with `ModelValidateOptions`)
- Updated `@opentelemetry/semantic-conventions` usage: `SemanticResourceAttributes` → `ATTR_SERVICE_NAME`/`ATTR_SERVICE_VERSION`
- Commented out unresolvable `@bakery/api/sales-analytics` import in `models/index.ts`
- Added `@ts-ignore` for `express-validator` ESM/CJS interop in `validation.middleware.ts`

**Workaround available:** `npm run serve:api:simple` runs a minimal Express server with mock endpoints on port 5000.

## Remaining Errors

### 1. Missing @bakery/api/\* route modules

These modules are imported in route files but the libraries don't export the expected route handlers:

- `@bakery/api/chat` → imported in `src/routes/chat.routes.ts`
- `@bakery/api/dashboard` → imported in `src/routes/dashboard.routes.ts`

### 2. Missing npm packages / type declarations

- `csv-parse` → imported in `src/routes/import.routes.ts` (not installed)
- `xlsx` → imported in `src/routes/import.routes.ts` (not installed)
- `@types/multer` → `req.file` has no type on Express Request (multiple occurrences in `import.routes.ts`)

### 3. OpenTelemetry type issues in `src/monitoring/tracing.ts`

- `Resource` from `@opentelemetry/resources` is only a type, not a value (API changed in v2)
- `JaegerExporter` from `@opentelemetry/exporter-jaeger` — package deprecated, exporter removed

### 4. express-validator ESM/CJS interop

- `validation.middleware.ts` — `validationResult` named import fails due to module format mismatch
- Workaround: `@ts-ignore` applied, but proper fix needs either `esModuleInterop` to work with the build config or switching to `require()`

### 5. Build configuration

- `tsconfig.build.json` uses `files: ["src/main.ts"]` with `exclude: ["**/*"]` — TypeScript follows imports from main.ts but path resolution for `@bakery/*` libs fails at build time even though the libs compile successfully as separate Nx targets

## Files to Fix

- `apps/bakery-api/src/routes/chat.routes.ts` - needs `@bakery/api/chat` route export or inline routes
- `apps/bakery-api/src/routes/dashboard.routes.ts` - needs `@bakery/api/dashboard` route export or inline routes
- `apps/bakery-api/src/routes/import.routes.ts` - needs `csv-parse`, `xlsx`, `@types/multer` installed
- `apps/bakery-api/src/monitoring/tracing.ts` - needs OpenTelemetry v2 API migration
- `apps/bakery-api/src/middleware/validation.middleware.ts` - needs proper CJS/ESM fix

## Approach Options

1. **Quick fix**: Add `skipLibCheck: true` and suppress remaining errors with `@ts-ignore` to get a compiling build
2. **Proper fix**: Install missing packages, create stub route modules, migrate OpenTelemetry to v2 API
3. **Hybrid**: Inline the route handlers that currently import from missing libs, install missing packages
