---
id: TASK-015
aliases:
  - TASK-015
title: Document Backend API with OpenAPI/Swagger
slug: document-backend-api-with-openapi-swagger
status: cancelled
priority: 4
owner: ''
projects: []
customers: []
tags:
  - backend-completion
sprint: ''
depends_on:
  - TASK-001
due_date: ''
created: 2026-02-28
updated: 2026-03-11
---

[AUDIT: Swagger config exists but API won't start due to 61+ TypeScript errors. Cannot test /api-docs endpoint.] Create and integrate OpenAPI (Swagger) specifications for the backend API to provide interactive documentation, making it easier for developers to understand and consume the endpoints.

## Details

Integrate OpenAPI documentation into the main backend application (`apps/api`). Install `swagger-jsdoc` and `swagger-ui-express` packages. Configure `swagger-jsdoc` to parse JSDoc comments from the API route files. Set up a new endpoint, `/api-docs`, in the Express application to serve the interactive Swagger UI. Systematically add OpenAPI-compliant JSDoc annotations to all existing API endpoints, including those for staff management (Task 7), recipes (Task 8), and dashboard analytics (Task 4). The documentation for each endpoint should clearly define its path, method, parameters, request body, and possible response schemas, including error responses. Special attention should be given to documenting the JWT-based authentication mechanism (from Task 1) by defining a security scheme.

_Original dependencies: [1, 4, 7, 8, 15]_
