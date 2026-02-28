---
id: TASK-009
aliases:
  - TASK-009
title: Implement Event-Driven Communication Between API Modules
slug: implement-event-driven-communication-between-api-modules
status: backlog
priority: 3
owner: ''
projects: []
customers: []
tags:
  - backend-infra
sprint: ''
depends_on: [TASK-001]
due_date: ''
created: 2026-02-28
updated: 2026-02-28
---

[AUDIT: Cannot verify - Backend has 61+ TypeScript errors and won't compile. Event bus code exists but untestable.] Introduce an event bus system to enable asynchronous, decoupled communication between the domain libraries (e.g., orders, inventory) within the modular monolith API, replacing direct synchronous calls.

## Details

First, select and install a lightweight, in-process event emitter library like `eventemitter3`. Create a new shared library, `libs/api/event-bus`, to instantiate and export a singleton instance of the event emitter, ensuring all modules use the same bus. Second, define event contracts using TypeScript interfaces within the `libs/types` library (from Task #14). For example, create an `OrderCreatedEvent` interface. Finally, refactor existing module interactions. As an initial use case, modify the `orders` module to publish an `ORDER_CREATED` event when a new order is successfully created. The `inventory` module should then subscribe to this event and execute its logic to decrement stock levels, thus decoupling it from the `orders` module.

_Original dependencies: [14, 15]_
