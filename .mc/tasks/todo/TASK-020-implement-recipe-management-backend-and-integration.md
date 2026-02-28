---
id: TASK-020
aliases:
  - TASK-020
title: Implement Recipe Management Backend and Integration
slug: implement-recipe-management-backend-and-integration
status: backlog
priority: 4
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

[AUDIT: Backend broken - Module @bakery/api/recipes not found. API has 61+ TypeScript errors and won't compile.] Create a backend API for recipe management (Task 15) that can serve markdown-based recipes and connect the existing frontend components to this new, persistent data source.

## Details

Backend: Create CRUD endpoints under `/api/recipes`. The `POST` and `PUT` endpoints will accept raw markdown. Use a library like `marked` to parse markdown to HTML before sending it in `GET` responses. Store the raw markdown in the database. Frontend: Refactor the recipe management components to fetch data from the `/api/recipes` endpoints. Use `dangerouslySetInnerHTML` to render the parsed HTML content from the API.

_Original dependencies: [2]_
