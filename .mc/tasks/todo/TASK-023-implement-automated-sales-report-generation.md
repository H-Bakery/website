---
id: TASK-023
aliases:
  - TASK-023
title: Implement Automated Sales Report Generation
slug: implement-automated-sales-report-generation
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

[AUDIT: Cannot verify - Backend doesn't compile, so automated reporting service cannot be tested. Depends on Task 16 event bus which is also untestable.] Implement a backend service for automated sales analytics reporting, capable of generating and exporting PDF and Excel files for various timeframes, with support for scheduling and notification integration.

## Details

Create a new backend module, `libs/api/reporting-service`, to handle the generation of sales reports. This service will use data processed by the Sales Data Import Service (Task 28). Implement endpoints under `/api/reports`. Use a library like `exceljs` for Excel exports and `puppeteer` for generating PDFs from HTML templates to ensure consistent styling. The service should support on-demand generation and scheduled jobs using `node-cron`. For scheduling, create endpoints like `POST /api/reports/schedule` to define report type (daily, weekly, monthly), format (PDF/Excel), and recipients. Upon successful report generation, the service will emit a `ReportGeneratedEvent` on the event bus (from Task 16), including a secure link to the generated file. Generated reports should be stored in a designated secure location, such as a private cloud storage bucket.

_Original dependencies: [28, 16]_
