---
id: TASK-004
aliases:
  - TASK-004
title: Verify Database Migrations and Schema
slug: verify-database-migrations-and-schema
status: done
priority: 2
owner: ''
projects: []
customers: []
tags:
  - backend-infra
sprint: ''
depends_on:
  - TASK-001
due_date: ''
created: 2026-02-28
updated: 2026-03-11
---

Run database migrations and verify the SQLite schema matches Sequelize model definitions. The MIGRATION_COMPLETE.md claimed this was done but the sign-off checklist shows it was never verified.

## Details

**Verification Steps:**

1. **Run Migrations:**

   - `cd apps/bakery-api && npx sequelize-cli db:migrate`
   - Verify no migration errors

2. **Verify Schema:**

   - Check all tables exist in SQLite database
   - Verify foreign key relationships
   - Compare with model definitions in `apps/bakery-api/src/models/`

3. **Test Basic CRUD:**
   - Create a test record in each major table
   - Read it back
   - Update it
   - Delete it

**Files Involved:**

- `apps/bakery-api/src/models/*.ts` - Sequelize model definitions
- `apps/bakery-api/migrations/*.js` - Migration files
- `apps/bakery-api/config/database.js` - Database config
- `apps/bakery-api/data/bakery.sqlite` - SQLite database file

_Original dependencies: [60]_
