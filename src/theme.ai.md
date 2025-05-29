# Theme Configuration

This module provides the theme configuration for the bakery application, supporting both light and dark modes with consistent styling across the application.

## Overview

The theme configuration uses Material UI's theming system to define:
- Light and dark themes with consistent brand colors
- Typography styles with custom fonts for headlines and buttons
- Color palettes for both theme modes

## Structure

- `getThemeOptions`: Function that generates theme options based on mode
- `lightTheme`: The light theme configuration (default for main site)
- `darkTheme`: The dark theme configuration (used only in admin area)
- `theme`: Default export that points to lightTheme

## Light Theme vs Dark Theme

The light theme is used by default across the entire application, while the dark theme is only accessible in the admin area. Both themes share:

- Same primary colors
- Same typography settings
- Same success colors

But differ in:

- Background colors
- Text colors
- Contrast levels

## Implementation Details

The theme uses a factory function approach that generates theme options based on the specified mode:

```typescript
const getThemeOptions = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    primary: { main: '#D038BA' },
    // Other palette settings that vary by mode
  },
  typography: { /* Typography settings */ }
})
```

## Integration

The theme is integrated into the application through:

1. The ThemeRegistry for the main site (always light theme)
2. ThemedAdminContent for the admin area (can toggle between light/dark)

## Usage

To use the theme in components:

```tsx
import { useTheme } from '@mui/material/styles'

function MyComponent() {
  const theme = useTheme()
  
  return <Box sx={{ bgcolor: theme.palette.background.default }} />
}
```

The theme colors, typography, and other design tokens should be accessed through the theme object rather than being hardcoded to maintain consistency.