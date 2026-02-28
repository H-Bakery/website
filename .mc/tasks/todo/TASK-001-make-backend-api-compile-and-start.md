---
id: TASK-001
aliases:
  - TASK-001
title: Make Backend API Compile and Start
slug: make-backend-api-compile-and-start
status: backlog
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
updated: 2026-02-28
---

The backend API (apps/bakery-api) has 61+ TypeScript compilation errors preventing it from starting. This task involves creating missing library modules and fixing type errors so that `nx serve bakery-api` runs successfully.

## Details

**Root Cause Analysis:**

1. **Missing @bakery/api/\* modules** - main.ts imports these but they don't exist:

   - `@bakery/api/dashboard` - not found
   - `@bakery/api/staff` - not found
   - `@bakery/api/recipes` - not found
   - `@bakery/api/chat` - not found

2. **Sequelize Model Type Errors** (~20 errors):

   - `apps/bakery-api/src/models/Production*.ts` have Symbol type mismatches
   - Model associations have incorrect typing

3. **Middleware Import Issues:**

   - `apps/bakery-api/src/middleware/validation.middleware.ts` has broken express-validator import

4. **models/index.ts Issues:**
   - Missing module exports for some models

**Files to Fix:**

- `apps/bakery-api/src/main.ts` - Entry point with broken imports
- `apps/bakery-api/src/models/*.ts` - Model definitions with type errors
- `apps/bakery-api/src/middleware/validation.middleware.ts` - Broken import
- `libs/api/*/src/index.ts` - Missing library exports
- `tsconfig.base.json` - Path mappings for @bakery/api/\*

**Libraries to Create (if missing):**

- `libs/api/dashboard/` - Dashboard analytics routes
- `libs/api/staff/` - Staff management routes
- `libs/api/recipes/` - Recipe management routes
- `libs/api/chat/` - Chat functionality routes
