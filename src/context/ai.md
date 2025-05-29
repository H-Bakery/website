# Context Providers

This directory contains React context providers that manage application state across components. Context providers are used to share state and functionality without having to pass props through multiple component layers.

## Structure Overview

- `ThemeContext.tsx`: Provides theme state management for light/dark mode support
- `CartContext.tsx`: Manages shopping cart state for the customer-facing store
- Additional context providers as needed

## Theme Context

The `ThemeContext.tsx` provides functionality for:
- Toggling between light and dark theme modes
- Storing theme preference in localStorage
- Accessing the current theme mode from any component
- Setting theme mode explicitly

### Usage Example

```tsx
import { useTheme } from '../context/ThemeContext';

function MyComponent() {
  const { mode, toggleTheme } = useTheme();
  
  return (
    <div>
      <p>Current theme: {mode}</p>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
}
```

## Cart Context

The `CartContext.tsx` provides functionality for:
- Adding items to the shopping cart
- Removing items from the cart
- Updating item quantities
- Calculating totals

## Implementation Pattern

Context providers in this application follow this pattern:
1. Create a context with a default value
2. Create a provider component that manages state
3. Provide a custom hook to consume the context
4. Export both the provider component and the custom hook

## Best Practices

When working with context:
- Only put truly global state in context
- Consider performance implications of context updates
- Split large contexts into smaller ones to prevent unnecessary renders
- Use the useContext hook pattern for consuming contexts