# Theme Components

This directory contains components related to theme management in the bakery application, focusing on dark mode support for the admin area.

## ThemeToggler Component

The `ThemeToggler.tsx` component provides a UI control for switching between light and dark themes in the admin area of the application.

### Features

- Only renders in admin routes (`/admin/*`) through path-based checks
- Toggles between light and dark mode
- Displays appropriate icons based on current theme state
- Includes tooltip for better user experience
- Integrates with the ThemeContext

### Implementation Details

The ThemeToggler component:
1. Uses the custom useTheme hook to access theme state and toggle functionality
2. Checks the current path to determine if it should be displayed
3. Uses Material UI's IconButton and Tooltip components
4. Shows a sun icon (Brightness7Icon) in dark mode and a moon icon (Brightness4Icon) in light mode

### Usage

The ThemeToggler is primarily used in the BakeryLayout component's AppBar but can be included elsewhere within the admin area:

```tsx
import ThemeToggler from '../components/theme/ThemeToggler'

function MyAdminComponent() {
  return (
    <div>
      <ThemeToggler tooltip={true} />
    </div>
  )
}
```

## Props

The ThemeToggler accepts the following props:

- `tooltip` (optional, default: true): Whether to display a tooltip explaining the button's function

## Integration with Theme Context

These components work with the ThemeContext to maintain theme state across the admin area while ensuring the main site always uses light theme.