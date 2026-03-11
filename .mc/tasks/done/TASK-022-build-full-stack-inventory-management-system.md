---
id: TASK-022
aliases:
  - TASK-022
title: Build Full-Stack Inventory Management System
slug: build-full-stack-inventory-management-system
status: cancelled
priority: 4
owner: ''
projects: []
customers: []
tags:
  - frontend
sprint: ''
depends_on:
  - TASK-001
due_date: ''
created: 2026-02-28
updated: 2026-03-11
---

[AUDIT: Partial - validation.middleware.ts has broken import, Symbol type errors in models. Backend won't start.] Build a full-stack inventory management system (Task 18) from scratch, including a backend API and a frontend interface for tracking stock levels, managing suppliers, and flagging items for reordering.

## Details

Backend: Define a new database schema for `inventory_items` (e.g., name, quantity, reorder_level). Create full CRUD endpoints at `/api/inventory`. Include an endpoint for stock adjustments (e.g., `POST /api/inventory/:id/adjust`). Frontend: Create an `/admin/inventory` page. Display inventory in a `<DataGrid>`, highlighting items where `quantity` is below `reorder_level`. Implement forms for adding/editing items and quick controls for adjusting stock.

_Original dependencies: [2]_
