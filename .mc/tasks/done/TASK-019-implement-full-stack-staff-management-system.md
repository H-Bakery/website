---
id: TASK-019
aliases:
  - TASK-019
title: Implement Full-Stack Staff Management System
slug: implement-full-stack-staff-management-system
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
due_date: ''
created: 2026-02-28
updated: 2026-03-11
---

[AUDIT: Backend broken - Module @bakery/api/staff not found. Frontend calls bakeryAPI.getStaff() which doesn't exist, will crash on load.] Implement a full-stack staff management system (Task 16) that allows administrators to create, read, update, and delete user accounts and manage their roles and permissions.

## Details

Backend: Create CRUD endpoints under `/api/staff` in the Node.js/Express application for user management. Ensure these endpoints are protected and only accessible by users with an 'admin' role. Frontend: Develop the UI on the `/admin/staff` page. Use a table to list users and their roles. Implement forms within modals for creating and editing users. API calls from the frontend must be authenticated.

_Original dependencies: [1, 2]_
