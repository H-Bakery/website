<context>
# Overview
The Bakery Management System (BMS) is an open-source software solution designed specifically for small bakeries (3-20 employees) in rural German towns. It aims to help these traditional businesses run healthy, efficient, and fair operations while embracing digital transformation. The system serves as both a standalone toolkit and a digital extension of a broader strategic business guide ("Leitfaden").

# Core Features

## Customer-Facing Website

- Public-facing product catalog showcasing the bakery's offerings with images and pricing
- Online ordering system allowing customers to place and manage orders
- Consistent light theme for brand experience
- Responsive design for all devices

## Admin Dashboard

- Comprehensive admin interface with dark mode support
- Staff management for tracking employee information and schedules
- Order processing system for handling customer orders
- Production planning tools to organize daily baking schedules
- Analytics and reporting for business insights
- System settings including theme preferences

## Backend API

- RESTful API endpoints for authentication, products, orders, etc.
- CSV product import functionality
- Cash management system
- Internal chat functionality
- Database integration with Sequelize ORM

# User Experience

## User Personas

### Karin – The Traditional Bakery Owner (54)

- Values craft and community
- Needs intuitive digital tools that respect traditional workflows
- Primary user of the admin dashboard and reporting features

### Lena – Business-Savvy Manager (38)

- Seeks analytics, dashboards, and automated reporting
- Appreciates modern UI and well-structured admin tools
- Uses the system for operational decision-making

### Tobias – Young Digital Baker (29)

- Interested in automation and data-driven baking
- Potential system champion and power user
- Values mobile access and modern interfaces

## Key User Flows

- Product management: Adding, updating, and organizing bakery offerings
- Order processing: From customer submission to fulfillment
- Production planning: Creating and managing daily baking schedules
- Staff coordination: Managing shifts and responsibilities
- Analytics: Tracking sales, popular products, and business performance
  </context>
  <PRD>

# Technical Architecture

## Frontend Components

- **Framework**: Next.js with TypeScript and Material UI
- **Routing**: Next.js App Router pattern
- **State Management**: React context providers
- **Structure**:
  - `src/app/`: Pages and routes
  - `src/components/`: Reusable UI components
  - `src/context/`: Context providers
  - `src/layouts/`: Layout components
  - `src/services/`: API services
  - `src/utils/`: Utility functions
  - `src/types/`: TypeScript type definitions

## Backend Components

- **Framework**: Node.js with Express
- **Database**: Sequelize ORM with SQLite (adaptable to PostgreSQL)
- **Structure**:
  - `config/`: Database configuration
  - `controllers/`: Request handlers
  - `middleware/`: Express middleware
  - `models/`: Sequelize data models
  - `routes/`: API route definitions
  - `seeders/`: Database seed data
  - `utils/`: Utility functions

## Data Models

- **Products**: id, name, category, price, image
- **Orders**: customer information, products, quantities, status
- **Users**: authentication and role information
- **Production Plans**: daily baking schedules
- **Cash Management**: financial tracking data

## APIs and Integrations

- Authentication: `/login`, `/register`
- Products: `/products`, `/products/:id`
- Orders: `/orders`
- Baking List: `/baking-list`
- Cash: `/cash`
- Chat: `/chat`

## Infrastructure Requirements

- Offline-first capability for unreliable connectivity
- GDPR compliance for customer data
- Modular design allowing features to be enabled/disabled
- Docker support (planned)

# Development Roadmap

## MVP Phase

- Core backend API with product, order, and user endpoints
- CSV import functionality for product data
- Basic admin interface with product management
- Customer-facing website with product catalog
- Simple ordering system
- Authentication and authorization

## Phase 2: Enhanced Operations

- Production planning interface
- Staff management dashboard
- Expanded admin features
- Order tracking system
- Basic analytics reporting
- Dark mode for admin area

## Phase 3: Advanced Features

- Cash management system
- Internal chat functionality
- Enhanced analytics dashboard
- Offline-mode capabilities
- Mobile-optimized interfaces
- Performance optimizations

## Phase 4: Community and Integration

- Docker containerization
- Open-source community engagement tools
- Integration with common POS systems
- Advanced AI assistant integration
- Extended customization options

# Logical Dependency Chain

## Foundation Layer

1. Database models and schema design
2. Authentication system
3. Product management backend
4. Basic admin interface framework
5. Customer-facing website structure

## Functional Layer

1. Product catalog with CSV import
2. Order processing system
3. Production planning tools
4. Staff management interface
5. Basic reporting functionality

## Enhancement Layer

1. Theme customization with dark mode
2. Cash management system
3. Internal chat functionality
4. Advanced analytics dashboard
5. Offline capabilities

# Risks and Mitigations

## Technical Challenges

- **Risk**: Poor internet connectivity in rural areas
  - **Mitigation**: Design with offline-first principles
- **Risk**: Varying technical proficiency of users
  - **Mitigation**: Create intuitive UIs with comprehensive onboarding

## MVP Scope Management

- **Risk**: Feature creep extending development timeline
  - **Mitigation**: Strict prioritization based on core user needs
- **Risk**: Over-engineering solutions for simple problems
  - **Mitigation**: Regular user testing with actual bakery staff

## Resource Constraints

- **Risk**: Limited development resources for open-source project
  - **Mitigation**: Modular architecture allowing community contributions
- **Risk**: Adoption barriers for traditional businesses
  - **Mitigation**: Integration with Leitfaden business guide for context

# Appendix

## Research Findings

- Small bakeries (3-20 employees) need digital solutions that respect craft traditions
- Rural connectivity challenges require offline-first approach
- GDPR compliance essential for customer data handling
- Integration with traditional workflows crucial for adoption

## Technical Specifications

- Node.js v18+ for backend
- Next.js 13+ with App Router
- Material UI for component library
- Sequelize ORM with SQLite (default) or PostgreSQL (optional)
- Responsive design with mobile breakpoints
- LocalStorage for offline data persistence
  </PRD>
