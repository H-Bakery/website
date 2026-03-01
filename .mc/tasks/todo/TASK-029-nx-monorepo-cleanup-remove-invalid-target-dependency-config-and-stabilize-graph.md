---
id: TASK-029
aliases:
  - TASK-029
title: 'NX Monorepo Cleanup: remove invalid target/dependency config and stabilize graph'
slug: nx-monorepo-cleanup-remove-invalid-target-dependency-config-and-stabilize-graph
status: in-progress
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
updated: 2026-03-01
---

# NX Monorepo Cleanup: remove invalid target/dependency config and stabilize graph

## Description

Nx-Konfiguration bereinigen (insb. fehlerhafte `dependsOn`/Target-Referenzen), sodass Dev/CI-Befehle reproduzierbar laufen und `nx graph`/`nx report` ohne Konfig-Fehler durchlaufen.

## Acceptance Criteria

- [ ] `npx nx graph --file=tmp-nx-graph.html` läuft ohne Konfig-Fehler
- [ ] Fehlerhafte Zielreferenzen sind korrigiert (z. B. E2E-Projektreferenzen)
- [ ] Lokaler Dev-Start für Landing, Shop, Management und API-simple ist dokumentiert
- [ ] Änderungen sind in `docs/development.md` oder gleichwertiger Doku festgehalten

## Notes
