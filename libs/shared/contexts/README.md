# @bakery/shared/contexts

Enhanced React contexts for global state management in the bakery application.

## Overview

This library provides centralized state management through React Context API with TypeScript support, persistence, real-time updates, and performance optimizations.

## Features

- 🎨 **Theme Context** - Dark/light/system modes with transitions
- 🛒 **Cart Context** - Shopping cart with persistence and validation
- 🔐 **Auth Context** - JWT authentication with role-based access
- 🔔 **Notification Context** - Real-time notifications with preferences
- 🌐 **Root Provider** - Combines all contexts with single setup

## Installation

This library is part of the Nx monorepo and is automatically available to all apps within the workspace.

```typescript
import {
  RootProvider,
  useTheme,
  useCart,
  useAuth,
  useNotifications,
} from '@bakery/shared/contexts'
```

## Quick Start

### Basic Setup

Wrap your application with the `RootProvider`:

```typescript
// app/layout.tsx or _app.tsx
import { RootProvider } from '@bakery/shared/contexts'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <RootProvider
          theme={{ defaultMode: 'system' }}
          auth={{ checkAuthOnMount: true }}
          cart={{ enablePersistence: true }}
          notification={{ enableRealTime: true }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  )
}
```

### Using Contexts

```typescript
import { useTheme, useCart, useAuth, useNotifications } from '@bakery/shared/contexts'

function MyComponent() {
  // Theme
  const { colorScheme, toggleTheme } = useTheme()

  // Cart
  const { items, addToCart, summary } = useCart()

  // Auth
  const { user, login, logout } = useAuth()

  // Notifications
  const { unreadCount, markAsRead } = useNotifications()

  return (
    // Your component JSX
  )
}
```

## Context Details

### Theme Context

Manages application theme with system preference detection.

```typescript
const {
  theme, // Current theme configuration
  mode, // 'light' | 'dark' | 'system'
  colorScheme, // Resolved color scheme
  toggleTheme, // Toggle between modes
  setMode, // Set specific mode
  setTransitionsEnabled, // Enable/disable transitions
  systemPrefersDark, // System preference
} = useTheme()
```

**Features:**

- System preference detection
- Smooth transitions between themes
- Persistence to localStorage
- Custom theme overrides
- CSS class application to document

**Configuration:**

```typescript
<ThemeProvider
  defaultMode="system"
  defaultEnableTransitions={true}
  storageKey="bakery-theme"
  disablePersistence={false}
  customTheme={{ primaryColor: '#007bff' }}
>
```

### Cart Context

Manages shopping cart with validation and persistence.

```typescript
const {
  items, // Cart items array
  summary, // Price summary with tax
  validation, // Validation state
  addToCart, // Add product to cart
  removeFromCart, // Remove item
  updateQuantity, // Update item quantity
  clearCart, // Clear all items
  applyDiscount, // Apply discount code
  isInCart, // Check if product in cart
  getQuantity, // Get product quantity
} = useCart()
```

**Features:**

- Automatic persistence to localStorage (written synchronously on every change)
- Real-time price calculations
- Tax and discount support
- Stock validation
- Quantity limits
- Import/export functionality

**Configuration:**

```typescript
<CartProvider
  enablePersistence={true}
  taxRate={0.19}              // 19% VAT
  maxItems={100}              // Max different products
  maxQuantityPerItem={99}     // Max quantity per item
  validateItem={(item) => []} // Custom validation
>
```

### Auth Context

JWT-based authentication with role management.

```typescript
const {
  user, // Current user
  isAuthenticated, // Auth status
  permissions, // User permissions set
  login, // Login function
  logout, // Logout function
  register, // Register new user
  refreshAuth, // Refresh authentication
  hasPermission, // Check permission
  hasRole, // Check role
  updateProfile, // Update user profile
} = useAuth()
```

**Features:**

- JWT token management
- Automatic token refresh
- Role-based permissions
- Secure password handling
- Profile management
- Auth state persistence

**Permission System:**

```typescript
// Check permissions
if (auth.hasPermission('products.write')) {
  // User can edit products
}

// Check roles
if (auth.hasRole('admin', 'manager')) {
  // User is admin or manager
}

// Require authentication
const SecureComponent = () => {
  const auth = useRequireAuth() // Throws if not authenticated
  // Component code
}
```

**Configuration:**

```typescript
<AuthProvider
  refreshInterval={300000}    // 5 minutes
  checkAuthOnMount={true}
  onAuthStateChange={(isAuth, user) => {}}
  permissionMapping={{
    admin: ['all permissions'],
    manager: ['limited permissions']
  }}
>
```

### Notification Context

Real-time notifications with preferences and filtering.

```typescript
const {
  notifications, // All notifications
  filteredNotifications, // Filtered list
  unreadCount, // Unread count
  stats, // Statistics
  preferences, // User preferences
  markAsRead, // Mark as read
  deleteNotification, // Delete notification
  updatePreferences, // Update preferences
  setFilters, // Apply filters
} = useNotifications()
```

**Features:**

- WebSocket real-time updates
- Browser notifications
- Sound alerts
- Quiet hours
- Category preferences
- Priority filtering
- Auto-mark as read
- Push notification support

**Filtering:**

```typescript
// Apply filters
setFilters({
  unreadOnly: true,
  categories: ['order', 'inventory'],
  priorities: ['high', 'urgent'],
  dateRange: { start: new Date(), end: new Date() },
  search: 'payment',
})
```

**Configuration:**

```typescript
<NotificationProvider
  enableRealTime={true}
  pollingInterval={30000}     // Fallback polling
  requestPermissionOnMount={true}
  maxNotifications={100}
  autoMarkAsReadDelay={5000}  // 5 seconds
  soundUrl="/notification.mp3"
>
```

## Advanced Usage

### Custom Hooks

The library provides specialized hooks for common use cases:

```typescript
// Theme hooks
const colorScheme = useColorScheme() // Just the color scheme
const isDark = useIsDarkMode() // Boolean dark mode check

// Cart hooks
const summary = useCartSummary() // Just the summary
const isEmpty = useIsCartEmpty() // Boolean empty check

// Auth hooks
const user = useCurrentUser() // Just the user
const isAuth = useIsAuthenticated() // Boolean auth check
const auth = useRequireAuth() // Throws if not authenticated
const auth = useRequireRole('admin') // Throws if not admin

// Notification hooks
const count = useUnreadCount() // Just the count
const prefs = useNotificationPreferences() // Just preferences
```

### HOC Pattern

Wrap components with the root provider:

```typescript
import { withRootProvider } from '@bakery/shared/contexts'

const App = () => {
  // Your app component
}

export default withRootProvider(App, {
  theme: { defaultMode: 'light' },
  auth: { checkAuthOnMount: true },
  cart: { enablePersistence: true },
  notification: { enableRealTime: true },
})
```

### Testing

Mock contexts in tests:

```typescript
import { render } from '@testing-library/react'
import { RootProvider } from '@bakery/shared/contexts'

const renderWithProviders = (ui, options = {}) => {
  return render(<RootProvider {...options}>{ui}</RootProvider>)
}

// Test example
test('adds item to cart', () => {
  const { getByText } = renderWithProviders(
    <ProductCard product={mockProduct} />,
    {
      cart: { enablePersistence: false },
    }
  )

  fireEvent.click(getByText('Add to Cart'))
  // Assert cart updated
})
```

## Performance Considerations

### Optimization Tips

1. **Use specific hooks** instead of the full context when possible:

   ```typescript
   // ✅ Good - only subscribes to what's needed
   const isDark = useIsDarkMode()

   // ❌ Less optimal - subscribes to entire context
   const { colorScheme } = useTheme()
   const isDark = colorScheme === 'dark'
   ```

2. **Memoize computed values** in components:

   ```typescript
   const expensiveCalculation = useMemo(() => {
     return items.reduce((sum, item) => sum + complexCalc(item), 0)
   }, [items])
   ```

3. **Use context splitting** for independent state:
   ```typescript
   // Each context updates independently
   // Cart updates don't trigger theme re-renders
   ```

### Bundle Size

The library is tree-shakeable. Import only what you need:

```typescript
// ✅ Good - smaller bundle
import { useCart } from '@bakery/shared/contexts'

// ❌ Avoid - imports everything
import * as contexts from '@bakery/shared/contexts'
```

## Migration Guide

From old contexts to new:

```typescript
// Old (src/context/CartContext.tsx)
import { CartContext } from '../context/CartContext'
const { items, addToCart } = useContext(CartContext)

// New (@bakery/shared/contexts)
import { useCart } from '@bakery/shared/contexts'
const { items, addToCart } = useCart()
```

Key differences:

- Enhanced TypeScript types
- Built-in persistence
- Validation support
- Performance optimizations
- Better error handling

## Troubleshooting

### Common Issues

**Theme not applying:**

- Check if RootProvider is at the app root
- Verify CSS classes are not overridden
- Check browser console for errors

**Cart not persisting:**

- Ensure `enablePersistence={true}`
- Check localStorage is not blocked
- Verify storage key conflicts

**Auth token expired:**

- Check `refreshInterval` setting
- Ensure backend refresh endpoint works
- Check network requests in dev tools

**Notifications not showing:**

- Check browser notification permissions
- Verify WebSocket connection
- Check quiet hours settings

## Related Libraries

- `@bakery/shared/types` - TypeScript type definitions
- `@bakery/shared/data-access` - API services
- `@bakery/shared/utils` - Utility functions
- `@bakery/shared/ui` - UI components

## License

Private - Part of the bakery management system
