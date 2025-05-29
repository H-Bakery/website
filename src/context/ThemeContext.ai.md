# Theme Context

This module provides the theming functionality for the bakery application, with special focus on supporting dark mode in the admin area while ensuring the main site always uses light theme.

## Overview

The ThemeContext is a React context that manages theme state across the application. It includes:

- Theme state management (light/dark mode)
- Theme toggling functionality
- Storage of theme preferences in localStorage
- Path-based theme application (admin vs. main site)

## Implementation Details

The ThemeContext is implemented as a standard React context with a provider component that:

1. Initializes theme state with a default of 'light'
2. Loads saved theme preferences from localStorage
3. Provides functions to toggle and explicitly set the theme
4. Saves theme preferences back to localStorage when changed
5. Uses 'adminThemeMode' as the localStorage key to isolate admin preferences

## Structure

```
ThemeContext
├── ThemeProvider - Provider component that wraps admin area
└── useTheme - Custom hook to access theme context
```

## Usage

The ThemeContext is used differently in different parts of the application:

### Admin Area

In the admin area, the ThemeProvider is used to enable theme switching:

```tsx
// In admin layout.tsx
<ThemeProvider isAdmin={true}>
  <ThemedAdminContent>{children}</ThemedAdminContent>
</ThemeProvider>
```

### Main Site

For the main site, the ThemeContext is not used directly, and instead the light theme is always applied:

```tsx
// In ThemeRegistry.tsx
<MuiThemeProvider theme={lightTheme}>
  {/* Main site content */}
</MuiThemeProvider>
```

## Theme Switching Logic

The context includes logic to:
- Only allow theme toggling in admin routes
- Maintain separate theme state for admin vs. main site
- Persist the admin theme preference in localStorage

This ensures a consistent light theme for customers while giving administrators the flexibility of dark mode.