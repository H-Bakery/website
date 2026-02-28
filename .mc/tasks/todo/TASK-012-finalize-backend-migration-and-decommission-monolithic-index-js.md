---
id: TASK-012
aliases:
  - TASK-012
title: Finalize Backend Migration and Decommission Monolithic index.js
slug: finalize-backend-migration-and-decommission-monolithic-index-js
status: backlog
priority: 3
owner: ''
projects: []
customers: []
tags:
  - backend-completion
sprint: ''
depends_on: [TASK-008]
due_date: ''
created: 2026-02-28
updated: 2026-02-28
---

[AUDIT: Incomplete - Backend has 61+ TypeScript errors preventing compilation. Missing modules: @bakery/api/dashboard, @bakery/api/staff, @bakery/api/recipes, @bakery/api/chat. Migration is partially done but API won't start.] Complete the full migration of all remaining backend logic from the legacy `apps/bakery-api/index.js` monolith to the new modular TypeScript architecture. Decommission the old CommonJS entry point and associated route/controller files to eliminate technical debt from running dual systems.

## Details

This task involves finalizing the backend architectural overhaul. First, conduct a thorough audit of `apps/bakery-api/index.js` and its associated `controllers/` and `routes/` directories to identify any business logic, middleware, or configuration not covered in Task 24 (e.g., `workflows`, `delivery`). For each remaining domain, create a new buildable library using `nx g @nx/js:lib <domain-name> --buildable --directory=libs/api`. Refactor the legacy Express.js CommonJS code into TypeScript, adhering to the Domain-Driven Design patterns established in `docs/architecture.md`. Once all logic is migrated into the new domain libraries and correctly imported and initialized within `apps/bakery-api/src/main.ts`, the final and most critical step is to delete the legacy files: `apps/bakery-api/index.js`, and the `apps/bakery-api/controllers/` and `apps/bakery-api/routes/` directories. Finally, update any root-level configuration files (`package.json` scripts, `nx.json`) to remove all references to the decommissioned `index.js` file.

_Original dependencies: [24]_
