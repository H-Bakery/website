# ThemeRegistry Component

This component is responsible for setting up the Material UI theme provider for the entire application. The ThemeRegistry wraps the application with necessary providers to ensure consistent styling throughout the app.

## Key Features

- Sets up Material UI with the AppRouterCacheProvider for Next.js App Router
- Always applies the light theme to the main site (outside admin area)
- Configures global styles and CSS baseline
- Wraps the application in the CartProvider for e-commerce functionality
- Sets up the consistent layout with Header and Footer components

## Implementation Details

The ThemeRegistry has been simplified to always use the light theme for the customer-facing portion of the website. This ensures a consistent brand experience for all users visiting the main site.

The main site no longer uses the ThemeContext provider at all, removing any possibility of dark mode being applied outside the admin area. It uses a fixed light theme with the bakery's signature gradient background:

```
background: radial-gradient(143.25% 143.25% at 50% 100%, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%), #D8E1F4
```

## Integration

- Imports the lightTheme directly from the theme.ts file
- Completely removed the ThemeProvider from the main site
- Uses a direct MuiThemeProvider with lightTheme for all non-admin routes
- The admin area has its own separate theming system with dark mode support via ThemedAdminContent component

## Usage

The ThemeRegistry is used in the root layout.tsx of the Next.js App Router, wrapping the entire application to provide consistent styling. The admin layout then applies its own theme provider to enable dark mode functionality only within admin routes.