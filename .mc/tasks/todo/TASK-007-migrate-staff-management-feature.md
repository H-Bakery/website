---
id: TASK-007
aliases:
  - TASK-007
title: Migrate Staff Management Feature
slug: migrate-staff-management-feature
status: backlog
priority: 2
owner: ''
projects: []
customers: []
tags:
  - backend-infra
sprint: ''
depends_on: [TASK-003]
due_date: ''
created: 2026-02-28
updated: 2026-02-28
---

[AUDIT: Broken - Frontend calls bakeryAPI.getStaff() which doesn't exist in the API service. Page will crash on load. Backend @bakery/api/staff module also not found.] Migrate Staff Management from src/app/admin/staff to apps/bakery-management/src/app/admin/staff. Create new library with: nx g @nx/react:lib feature-staff --directory=libs/bakery-management. Copy page.tsx and 3 components (CreateUserModal, DeleteConfirmationModal, EditUserModal) from src/components/admin/staff/ to new library. Connect to existing libs/api/staff API.

_Original dependencies: [36]_
