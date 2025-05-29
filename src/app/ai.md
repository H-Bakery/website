# App Directory - Next.js App Router

This directory contains all the routes and pages for the Next.js application using the App Router pattern. The App Router is a newer routing system introduced in Next.js 13+ that uses folder-based routing with React Server Components.

## Structure Overview

- `layout.tsx`: Root layout that wraps all pages
- `page.tsx`: Homepage component
- `ThemeRegistry.tsx`: Material UI theme configuration for the App Router
- `admin/`: Admin area routes with dark mode support
- `bakery/`: Bakery production process management
- `dashboard/`: Analytics and metrics dashboards
- `products/`: Product catalog and management
- `orders/`: Order processing system
- `login/`: Authentication pages

## Folder-based Routing

The Next.js App Router uses a folder-based routing system where:
- Folders define routes
- `page.tsx` files are rendered as the route's UI
- `layout.tsx` files define shared layouts
- `loading.tsx` files provide loading states
- `error.tsx` files define error boundaries

## Admin Area

The admin area (`/admin`) includes the following key features:
- Dark/light mode toggle in the navigation bar
- Staff management interface
- System settings including theme preferences
- Responsive layout for all device sizes

## Special Files

- `fonts.ts`: Font configuration for the application
- `print.css`: Styles for print layouts
- `ThemeRegistry.tsx`: Configures Material UI with the application theme