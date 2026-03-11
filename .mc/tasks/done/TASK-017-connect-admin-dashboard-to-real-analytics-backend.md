---
id: TASK-017
aliases:
  - TASK-017
title: Connect Admin Dashboard to Real Analytics Backend
slug: connect-admin-dashboard-to-real-analytics-backend
status: cancelled
priority: 3
owner: ''
projects: []
customers: []
tags:
  - frontend
sprint: ''
depends_on:
  - TASK-001
  - TASK-016
due_date: ''
created: 2026-02-28
updated: 2026-03-11
---

[AUDIT: Not connected - Dashboard uses mock data fallback because backend API doesn't compile. Task 4 must be fixed first.] Refactor the admin dashboard frontend to consume data from the new analytics backend API, completely removing all mock data sources and providing real-time business insights.

## Details

In the `/pages/admin/dashboard.tsx` component, replace all mock data hooks and objects with API calls to the `/dashboard/*` endpoints. Use a data-fetching library like SWR or React Query to handle loading, caching, and error states gracefully. Connect the fetched data to the existing Material UI chart and stat card components. Implement loading skeletons to improve user experience during data fetching.

_Original dependencies: [2, 4]_
