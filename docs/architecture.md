# Architecture Overview

## System Design

The bakery system is designed as an Nx integrated monorepo with a modular monolith backend that can evolve into microservices as needed.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Nx Monorepo                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Landing    │  │  Management  │  │     Shop     │        │
│  │    Page      │  │    System    │  │    System    │        │
│  │  (Next.js)   │  │  (Next.js)   │  │  (Next.js)   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│         ↓                  ↓                  ↓                │
│  ┌─────────────────────────────────────────────────────┐      │
│  │            API Gateway (Express)                     │      │
│  └─────────────────────────────────────────────────────┘      │
│                           ↓                                    │
│  ┌─────────────────────────────────────────────────────┐      │
│  │        Modular Monolith Backend (Express)           │      │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐   │      │
│  │  │ Orders  │ │Inventory│ │Customer │ │Delivery│   │      │
│  │  │ Module  │ │ Module  │ │ Module  │ │ Module │   │      │
│  │  └─────────┘ └─────────┘ └─────────┘ └────────┘   │      │
│  └─────────────────────────────────────────────────────┘      │
│                           ↓                                    │
│  ┌─────────────────────────────────────────────────────┐      │
│  │          PostgreSQL (Schema-separated)               │      │
│  └─────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

### 1. Monorepo with Nx

**Decision**: Use Nx for monorepo management

**Rationale**:
- Efficient dependency management and build caching
- Selective deployment with affected commands
- Consistent tooling across all applications
- Enhanced developer experience with generators

### 2. Modular Monolith Backend

**Decision**: Start with a modular monolith instead of microservices

**Rationale**:
- Lower operational complexity for small team
- Easier local development and debugging
- Can evolve to microservices when needed
- Shared database with schema separation

### 3. Micro-frontends with Module Federation

**Decision**: Implement micro-frontend architecture

**Rationale**:
- Independent deployment of frontend applications
- Team autonomy for different business domains
- Runtime integration for shared components
- Fault isolation between applications

### 4. Schema-separated Database

**Decision**: Single PostgreSQL instance with schema separation

**Rationale**:
- Logical separation maintains boundaries
- Easier backup and maintenance
- Can migrate to separate databases later
- Cost-effective for current scale

## Module Architecture

### Backend Modules

Each backend module follows Domain-Driven Design principles:

```typescript
// Module structure
modules/
  orders/
    ├── order.service.ts       // Business logic
    ├── order.controller.ts    // HTTP endpoints
    ├── order.repository.ts    // Data access
    ├── order.entity.ts        // Domain model
    ├── order.dto.ts          // Data transfer objects
    └── order.module.ts       // Module configuration
```

### Frontend Applications

Each frontend application is independently deployable:

- **Landing Page**: Static site generation for SEO
- **Shop System**: Server-side rendering for performance
- **Management System**: Client-side rendering for interactivity

## Communication Patterns

### Inter-module Communication

Modules communicate through:
1. **Direct method calls** (within monolith)
2. **Event bus** for loose coupling
3. **Shared interfaces** in libs/shared

### Frontend-Backend Communication

- RESTful API with OpenAPI specification
- JWT-based authentication
- Request/response caching
- Optimistic UI updates

## Security Architecture

### Authentication & Authorization

- JWT tokens with refresh token rotation
- Role-based access control (RBAC)
- API rate limiting per user/IP
- Input validation at all layers

### Data Protection

- Encryption at rest for sensitive data
- HTTPS for all communications
- GDPR compliance measures
- Regular security audits

## Scalability Considerations

### Horizontal Scaling

- Stateless backend design
- Redis for session management
- Load balancer ready architecture
- Database connection pooling

### Evolution Path

1. **Current**: Modular monolith with shared database
2. **Next**: Extract high-traffic modules to services
3. **Future**: Full microservices with service mesh

## Technology Stack

### Frontend
- **Framework**: Next.js 15
- **UI Library**: Material-UI / Tailwind CSS
- **State Management**: React Context + React Query
- **Testing**: Jest + React Testing Library

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **ORM**: Prisma / TypeORM
- **Testing**: Jest + Supertest

### Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes (future)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

## Performance Optimization

### Caching Strategy
- CDN for static assets
- Redis for API responses
- Browser caching policies
- Database query optimization

### Build Optimization
- Nx computation caching
- Incremental builds
- Tree shaking and code splitting
- Docker layer caching