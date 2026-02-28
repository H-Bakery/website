---
id: TASK-018
aliases:
  - TASK-018
title: Build Comprehensive Order Management UI
slug: build-comprehensive-order-management-ui
status: backlog
priority: 3
owner: ''
projects: []
customers: []
tags:
  - frontend
sprint: ''
depends_on: [TASK-001]
due_date: ''
created: 2026-02-28
updated: 2026-02-28
---

[AUDIT: Uses hardcoded mockOrders array - UI exists but makes no real API calls. Backend must compile first.] Build a comprehensive user interface for managing customer orders (Task 13). The interface will allow staff to view, search, filter, and update the status of orders by connecting to the existing order management backend API.

## Details

Create a new page at `/admin/orders`. Use a Material UI `<DataGrid>` to display a list of all orders with columns for key details like ID, customer, date, and status. Implement server-side filtering and sorting. Create a detail view at `/admin/orders/[id]` to show complete order information and provide controls (e.g., a dropdown) to update the order status via a `PUT` request to `/orders/:id`.

_Original dependencies: [2]_
