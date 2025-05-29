# UI Component Library

This directory contains reusable UI components used throughout the bakery management application. Components are organized by feature and functionality to promote reusability and maintainability.

## Structure Overview

- `header/`: Navigation and header components
- `footer/`: Footer components
- `theme/`: Theme-related components including ThemeToggler
- `products/`: Product-related components such as product cards and listings
- `orders/`: Order management and display components
- `dashboard/`: Dashboard widgets and data visualization components
- `common/`: Common UI elements used across the application

## Component Design Principles

The components in this library follow these principles:
- **Reusability**: Components are designed to be reused across multiple pages
- **Composability**: Smaller components can be combined to create more complex UIs
- **Theme-awareness**: Components adapt to both light and dark themes
- **Accessibility**: Components are built with accessibility in mind
- **Responsiveness**: Components adapt to different screen sizes

## Theme Components

The `theme` directory contains components specifically related to theming:
- `ThemeToggler.tsx`: A toggle button that switches between light and dark mode
- Additional theme-related components

## Common Usage

To use components from this library:

```tsx
import ThemeToggler from '../components/theme/ThemeToggler'

function MyComponent() {
  return (
    <div>
      <ThemeToggler />
      {/* Other content */}
    </div>
  )
}
```

## Adding New Components

When adding new components:
1. Create a new directory for related components
2. Export components through an index.ts file
3. Ensure components are theme-aware using the theme context
4. Include proper TypeScript typing for component props
5. Follow the existing naming conventions