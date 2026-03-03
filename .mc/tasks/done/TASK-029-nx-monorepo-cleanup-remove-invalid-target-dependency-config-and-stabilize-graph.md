---
id: TASK-029
aliases:
  - TASK-029
title: 'NX Monorepo Cleanup: remove invalid target/dependency config and stabilize graph'
slug: nx-monorepo-cleanup-remove-invalid-target-dependency-config-and-stabilize-graph
status: done
priority: 1
owner: ''
projects: []
customers: []
tags:
  - nx
  - monorepo
  - stability
  - setup
sprint: ''
depends_on: []
due_date: ''
created: 2026-03-01
updated: 2026-03-03
---

# NX Monorepo Cleanup: remove invalid target/dependency config and stabilize graph

## Description

Nx-Konfiguration bereinigen (insb. fehlerhafte `dependsOn`/Target-Referenzen), sodass Dev/CI-Befehle reproduzierbar laufen und `nx graph`/`nx report` ohne Konfig-Fehler durchlaufen.

## Acceptance Criteria

- [x] `npx nx graph --file=tmp-nx-graph.html` läuft ohne Konfig-Fehler
- [x] Fehlerhafte Zielreferenzen sind korrigiert (z. B. E2E-Projektreferenzen)
- [x] Lokaler Dev-Start für Landing, Shop, Management und API-simple ist dokumentiert
- [x] Änderungen sind in `docs/development.md` oder gleichwertiger Doku festgehalten

## Notes

### Fixes applied (2026-03-03)

1. **import-service sub-projects (9 files)**: Fixed `sourceRoot`, `main`, `tsConfig`, `assets`, `jestConfig`, `outputPath`, and `$schema` paths that incorrectly pointed to `libs/api/<name>/` instead of `libs/api/import-service/<name>/`
   - core, customers, event-bus, inventory, orders, production, types, notifications, workflows
2. **notifications sourceRoot conflict**: Was pointing to `libs/api/notifications/src` (a different library); corrected to `libs/api/import-service/notifications/src`
3. **bakery-management lint executor**: Replaced deprecated `@nx/linter:eslint` with `@nx/eslint:lint`
4. **feature-dashboard & feature-delivery $schema**: Fixed depth from `../../../../` (4 levels, overshoots root) to `../../../` (3 levels, correct)
5. **bakery-api serve targets**: Removed invalid `buildTarget` option from `nx:run-commands` executor (only valid for `@nx/next:server`); `dependsOn: ["build"]` already handles build ordering
