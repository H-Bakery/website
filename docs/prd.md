# Product Requirements Document (PRD)

## **1. Title**

**Zukunftsfähige Bäckerei: Open Source Bakery Management System**

---

## **2. Purpose**

To create a modern, sustainable, and open-source software system that helps small bakeries (3–20 employees) in rural German towns run a healthy, fair, and efficient business. The system supports fair compensation, better work-life balance, traditional craftsmanship, and digital transformation — without requiring subsidies. The software serves both as a standalone toolkit and as a digital extension of a broader strategic business guide ("Leitfaden").

---

## **3. Scope**

The Bakery Management System (BMS) aims to support:

- Bakery owners and managers in organizing daily operations
- Staff members in efficiently executing tasks
- Customers in placing and managing orders online

The system includes:

- A customer-facing website
- An admin interface
- A backend REST API
- A strategic business guide (Leitfaden) as the philosophical and operational foundation

---

## **4. Features and Requirements**

### **Frontend (Next.js App)**

Framework: Next.js + TypeScript + Material UI

**Main Components:**

- **Public website** with product catalog, branding, and customer ordering
- **Admin dashboard** with:

  - Staff management
  - System settings (incl. dark mode toggle)
  - Order tracking
  - Production planning interface
  - Analytics dashboard

**Technical Details:**

- App Router architecture
- Theme control via `ThemeContext`, toggled by path (admin only)
- Reusable UI components
- API integration via `src/services/`

---

### **Backend (Node.js App)**

Framework: Node.js + Express + Sequelize (with SQLite)

**Core Features:**

- REST API endpoints for authentication, products, orders, baking lists, cash, and chat
- CSV import support for product data
- MVC architecture
- Sequelize-based ORM with image and category fields
- Authentication and role-based authorization
- Cash management system
- Internal chat support

**Key Endpoints:**

- `/login`, `/register`
- `/products`, `/orders`, `/baking-list`
- `/cash`, `/chat`

---

## **5. User Personas**

### **Karin – The Traditional Bakery Owner (54)**

- Values craft and community
- Needs help with digitalization, wants intuitive tools

### **Lena – Business-Savvy Manager (38)**

- Wants analytics, dashboards, and automated reporting
- Appreciates clean, modern UX and well-structured admin tools

### **Tobias – Young Digital Baker (29)**

- Interested in automation, AI assistants, and data-driven decision-making
- Potential internal champion for using and contributing to the system

---

## **6. Technical Requirements**

### **Frontend:**

- Framework: Next.js (App Router), TypeScript
- UI: Material UI, split theming
- Responsive design
- State management with React context
- Modular architecture (components, layouts, services)

### **Backend:**

- Node.js with Express
- Sequelize ORM with SQLite (easily switchable to PostgreSQL)
- RESTful API design
- CSV data support
- Middleware for auth, logging
- Error handling with async/await

### **Infrastructure:**

- Docker support (planned)
- Offline-first support (planned)
- GDPR compliance
- Modular: Features (chat, cash, bakery list) can be enabled/disabled

---

## **7. Constraints**

- Must be usable without external dependencies (no cloud-only features)
- Designed for bakeries with little or no tech staff
- Internet connectivity may be unreliable — offline readiness is key
- Maintain simplicity over feature creep

---

## **8. Success Metrics**

| Objective                             | KPI Example                              |
| ------------------------------------- | ---------------------------------------- |
| Adoption by bakeries                  | ≥50 bakeries actively using it in 1 year |
| Practical improvement (via Leitfaden) | ≥80% report more clarity in operations   |
| Staff satisfaction                    | ≥70% of users prefer new system          |
| Community engagement                  | ≥10 OSS contributors in year 1           |
| Cost savings/digital efficiency       | ≥25% time savings on admin tasks         |

---

## **9. Timeline and Milestones**

| Date               | Milestone                                                   |
| ------------------ | ----------------------------------------------------------- |
| **June 2025**      | Leitfaden v1 complete, initial backend/frontend development |
| **July 2025**      | Internal test bakery onboarded, feedback collected          |
| **August 2025**    | Full MVP: Online shop, admin dashboard, order flow          |
| **September 2025** | Dark mode, CSV import fully tested, POS prototype           |
| **October 2025**   | AI Assistant integration (basic), Chat module launched      |
| **November 2025**  | Public OSS release (v0.1), community forum started          |
| **Q1 2026**        | First 10 bakeries live, offline mode, Docker image          |
