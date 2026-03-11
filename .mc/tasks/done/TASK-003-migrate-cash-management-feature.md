---
id: TASK-003
aliases:
  - TASK-003
title: Migrate Cash Management Feature
slug: migrate-cash-management-feature
status: done
priority: 2
owner: ''
projects: []
customers: []
tags:
  - backend-foundation
sprint: ''
depends_on: []
due_date: ''
created: 2026-02-28
updated: 2026-03-11
---

[AUDIT: Broken - Frontend calls bakeryAPI.getCashHistory() which doesn't exist in the API service. Page will crash on load.] Migrate Cash Management from src/app/admin/cash to apps/bakery-management/src/app/admin/cash. Copy page.tsx and 5 components (CashEntryForm, CashHistoryTable, DeleteCashEntryDialog, EditCashEntryModal, MonthlySummary) from src/components/admin/cash/ to libs/bakery-management/feature-cash/src/lib/components/. Connect to existing libs/api/cash API. Update imports to use @bakery/bakery-management/feature-cash.
