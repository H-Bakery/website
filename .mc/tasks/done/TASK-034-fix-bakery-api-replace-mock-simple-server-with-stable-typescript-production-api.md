---
id: TASK-034
aliases:
  - TASK-034
title: 'Fix Bakery API: replace mock/simple server with stable TypeScript production API'
slug: fix-bakery-api-replace-mock-simple-server-with-stable-typescript-production-api
status: done
priority: 1
owner: ''
projects: []
customers: []
tags:
  - api
  - typescript
  - migration
  - stability
sprint: ''
depends_on: []
due_date: ''
created: 2026-03-01
updated: 2026-03-09
---

# Fix Bakery API: replace mock/simple server with stable TypeScript production API

## Description

Ablösung des `simple-server.js` durch eine stabile, testbare TypeScript-API (`apps/bakery-api`) als produktionsnahe Basis für die App. Fokus: nachhaltige Migration statt Quickfixes.

## Acceptance Criteria

- [ ] Fehlercluster ist dokumentiert (Dependencies, Typen, Modell-Drift, Routing/Imports)
- [ ] Minimal lauffähiger API-Core startet per `nx serve bakery-api` (Health + Products + Recipes)
- [ ] Mock-Server ist klar als Fallback markiert und nicht mehr Default für Entwicklungsfluss
- [ ] CI-Validation für API-Build + Kern-Tests ist grün
- [ ] Migrationsplan in 2 Stufen ist dokumentiert (Stabilisierung -> Ausbau)
- [ ] Landing/Shop/Management nutzen dieselbe stabile API-Basis

## Notes
