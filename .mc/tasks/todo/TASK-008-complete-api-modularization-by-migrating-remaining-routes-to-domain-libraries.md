---
id: TASK-008
aliases:
  - TASK-008
title: Complete API Modularization by Migrating Remaining Routes to Domain Libraries
slug: complete-api-modularization-by-migrating-remaining-routes-to-domain-libraries
status: backlog
priority: 3
owner: ''
projects: []
customers: []
tags:
  - backend-infra
sprint: ''
depends_on: [TASK-001]
due_date: ''
created: 2026-02-28
updated: 2026-02-28
---

[AUDIT: Modules exist but don't build - Many @bakery/api/* modules referenced in main.ts are not found. 61+ TypeScript errors prevent API compilation.] Migrate the remaining routes (auth, cash, chat, dashboard, products, recipes, staff) from local imports in main.ts to their respective domain libraries, completing the modular monolith architecture transformation.

## Details

Complete the API modularization by creating domain-specific libraries for the remaining routes and migrating them from local imports. First, create buildable libraries for each remaining domain: `nx g @nx/js:lib auth --buildable --directory=libs/api`, `nx g @nx/js:lib cash --buildable --directory=libs/api`, `nx g @nx/js:lib chat --buildable --directory=libs/api`, `nx g @nx/js:lib dashboard --buildable --directory=libs/api`, `nx g @nx/js:lib products --buildable --directory=libs/api`, `nx g @nx/js:lib recipes --buildable --directory=libs/api`, and `nx g @nx/js:lib staff --buildable --directory=libs/api`. For each library, migrate the corresponding route files from the local routes directory to the new library's `src/lib` folder. Update each route file to export the router as the default export and ensure all dependencies (models, middleware, utilities) are properly imported. Create an `index.ts` file in each library to export the router. Update the main application's `main.ts` file to import routes from the new libraries instead of local files: `import authRoutes from '@bakery/api/auth'`, `import cashRoutes from '@bakery/api/cash'`, etc. Ensure all route mounting in main.ts uses the imported library routes. Update the workspace's `tsconfig.base.json` to include path mappings for each new library. Verify that all middleware, database models, and utility functions are accessible from the new library locations. Follow the established patterns from the previously migrated libraries (orders, inventory, customers, production, notifications) to maintain consistency in structure and imports.

_Original dependencies: [15]_
