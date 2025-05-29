# Layout Components

This directory contains higher-order layout components used to structure pages throughout the bakery management application. These layouts provide consistent structure, navigation, and styling across different sections of the application.

## Structure Overview

- `BakeryLayout.tsx`: Main layout for the admin and management sections
- Additional layout components as needed

## Bakery Layout

The `BakeryLayout.tsx` provides the following features:
- Responsive sidebar navigation with collapsible menu
- App bar with user information and actions
- Theme toggle for switching between light and dark modes (admin routes only)
- Path-based theme detection to apply dark mode styling only in admin area
- Role-based navigation items
- Persistent drawer on desktop and temporary drawer on mobile

### Navigation Structure

The navigation is organized into sections based on different areas of the application:
- Main Navigation
- Bakery Production
- Sales Area
- Administration

Each navigation item is filtered based on the user's role permissions.

## Usage

To use a layout component:

```tsx
import BakeryLayout from '../layouts/BakeryLayout';

function MyPage() {
  return (
    <BakeryLayout>
      <h1>My Page Content</h1>
      <p>This content will be wrapped by the BakeryLayout</p>
    </BakeryLayout>
  );
}
```

## Theme Integration

Layout components are theme-aware and will adapt their styling based on the current theme mode (light or dark). The BakeryLayout includes path-based checks to ensure dark mode styling is only applied within admin routes. The theme toggle component is conditionally rendered in the app bar only when in admin routes.

## Responsive Design

All layout components are fully responsive and adapt to different screen sizes:
- On mobile, the drawer is collapsible and can be toggled
- On desktop, the drawer is persistent but can be collapsed
- The app bar and content area adjust their spacing accordingly