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
- Admin interface with dark mode support
- Staff management dashboard
- Order processing system
- Production process management
- Dashboard with analytics and reporting

## Admin Area

The admin area (`/admin` routes) provides administrative functions and includes:
- Staff management (`/admin/staff`)
- System settings including theme preferences (`/admin/settings`)

The admin interface includes dark mode support that can be toggled in the settings page or directly from the navbar.

## Theme Configuration

The application supports both light and dark themes:
- Theme preferences are stored in local storage
- Theme settings are managed through ThemeContext
- Material UI theming is used for consistent styling

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