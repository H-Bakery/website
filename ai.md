# Bakery Website Project

This is the frontend component of the Bakery Management System. The application is built using Next.js with TypeScript and Material UI as the component library. The project uses the Next.js App Router pattern for routing and organization.

## Project Structure Overview

- `src/app/`: Contains the Next.js app router pages and routes
- `src/components/`: Reusable UI components
- `src/context/`: React context providers for state management
- `src/layouts/`: Layout components including the BakeryLayout with admin navigation
- `src/services/`: API services and data fetching logic
- `src/utils/`: Utility functions used across the application
- `src/types/`: TypeScript type definitions

## Key Features

- Customer-facing website with product catalog
- Admin interface with dark mode support (admin area only)
- Staff management dashboard
- Order processing system
- Production process management
- Dashboard with analytics and reporting

## Admin Area

The admin area (`/admin` routes) provides administrative functions and includes:
- Staff management (`/admin/staff`)
- System settings including theme preferences (`/admin/settings`)

The admin interface includes dark mode support that can be toggled in the settings page or directly from the navbar. Dark mode is exclusively available in the admin area, while the main customer-facing website always uses light mode.

## Theme Configuration

The application implements a split theming approach:
- Main site: Always uses light theme for a consistent brand experience
- Admin area: Supports toggle between light and dark themes
- Admin theme preferences are stored in local storage
- Theme settings are managed through ThemeContext with path-based checks
- The ThemeToggler component only appears in admin routes

## Getting Started

To run the development server:

```bash
npm run dev
```

For a production build:

```bash
npm run build
npm start
```