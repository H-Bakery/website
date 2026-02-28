---
id: TASK-016
aliases:
  - TASK-016
title: Create Backend Endpoints for Dashboard Analytics
slug: create-backend-endpoints-for-dashboard-analytics
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

[AUDIT: Backend broken - Module @bakery/api/dashboard not found, API has 61+ TypeScript errors and won't compile. Frontend falls back to mock data.] Develop new backend endpoints under the `/dashboard/*` namespace to aggregate and serve real business data from the SQLite database, replacing the current frontend-only mock data for analytics.

## Details

In the Node.js/Express backend, create a new `dashboardRoutes.js` file. Implement endpoints such as `GET /dashboard/sales-summary` and `GET /dashboard/production-overview`. These endpoints will execute SQL queries using aggregate functions (`SUM`, `COUNT`, `GROUP BY`) on the `orders`, `products`, and other relevant tables to generate meaningful time-series data. Protect all new endpoints with the existing JWT authentication middleware.
