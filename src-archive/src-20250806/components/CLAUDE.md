# CLAUDE.md - Website Components

This directory contains reusable UI components for the bakery website, organized by feature and functionality.

## Component Architecture

The components follow a modular, feature-based organization with consistent patterns for styling, testing, and integration.

## Directory Structure

### Admin Components (`admin/`)

**Purpose**: Admin dashboard and management interface components

#### Cash Management (`admin/cash/`)

- `CashEntryForm.tsx`: Form for recording daily cash entries
- `CashHistoryTable.tsx`: Table displaying cash entry history
- `DeleteCashEntryDialog.tsx`: Confirmation dialog for cash entry deletion
- `EditCashEntryModal.tsx`: Modal for editing existing cash entries
- `MonthlySummary.tsx`: Monthly revenue summary widget

#### Daily Prep (`admin/dailyPrep/`)

- `DailyPrepTabs.tsx`: Tab navigation for prep sections
- `AdditionalProduction/`: Components for additional production planning
- `BakingSchedule/`: Baking schedule management components
- `Header/`: Daily prep header components
- `PrepSections/`: Task card and section components
- `PrintUtils/`: Utilities for printing prep sheets
- `ProgressOverview/`: Progress tracking components

#### Product Management (`admin/products/`)

- `ProductFilters.tsx`: Filtering interface for product lists
- `ProductTable.tsx`: Data table for product management

#### Unsold Products (`admin/unsoldProducts/`)

- `DailyUnsoldTracker.tsx`: Daily unsold product recording
- `DateNavigator.tsx`: Date selection for unsold records
- `UnsoldProductsForm.tsx`: Form for recording unsold items
- `UnsoldProductsHistory.tsx`: Historical unsold data display
- `WeeklySummary.tsx`: Weekly waste summary

### Bakery Components (`bakery/`)

**Purpose**: Production workflow and bakery-specific functionality

#### Core Production

- `AdditionalProductionManager.tsx`: Manage additional production requests
- `PrepTaskCard.tsx`: Individual prep task display
- `WorkflowCreationForm.tsx`: Create new production workflows
- `WorkflowDetail.tsx`: Detailed workflow information
- `WorkflowSidebar.tsx`: Workflow navigation sidebar
- `WorkflowStepTable.tsx`: Table of workflow steps
- `WorkflowTimeline.tsx`: Timeline view of workflows

#### Internal Orders (`intern-orders/`)

- `InternOrderForm.tsx`: Form for staff-to-staff orders
- `InternOrderList.tsx`: List of internal orders

#### Recipes (`recipes/`)

- `RecipeDetailView.tsx`: Full recipe display
- `RecipeForm.tsx`: Recipe creation/editing form
- `RecipeList.tsx`: Recipe catalog display
- `RecipeListItem.tsx`: Individual recipe item

#### Reviews (`reviews/`)

- `ReviewForm.tsx`: Customer review submission
- `ReviewListItem.tsx`: Individual review display

### Customer-Facing Components

#### Button Components (`button/`)

- `Index.tsx`: Primary button component with variants
- Supports different styles, sizes, and states

#### Cart Components (`cart/`)

- `Card.tsx`: Cart item display card
- `CartButton.tsx`: Floating cart button with navigation and count display
- `Modal.tsx`: Shopping cart modal overlay
- `index.tsx`: Cart context integration

**Modern Cart Implementation:**

- Real-time cart count badge with 99+ overflow handling
- Click-to-navigate functionality to `/cart` page
- Conditional rendering (hidden when cart is empty)
- Integration with updated CartContext using API Product types

#### Footer Components (`footer/`)

- `Contact.tsx`: Contact information section
- `Index.tsx`: Main footer container
- `Link.tsx`: Footer link component
- `Menu.tsx`: Footer navigation menu
- `Openings.tsx`: Store hours display
- `data.ts`: Footer configuration data

#### Header Components (`header/`)

- `Hamburger.tsx`: Mobile menu toggle
- `Item.tsx`: Navigation menu item
- `MobileItem.tsx`: Mobile-specific menu item
- `Modal.tsx`: Mobile menu modal
- `index.tsx`: Main header component

#### Home Page Components (`home/`)

- `hero/`: Hero section components
- `map/`: Interactive store location map
- `news/`: Homepage news display
- `products/`: Enhanced products section with shopping cart integration
- `testimonial/`: Customer testimonials
- `wochenanfebote/`: Weekly offers section

**Enhanced Products Section (`home/products/`):**

- `index.tsx`: Main products display component with search, filtering, and pagination
- `ProductCard.tsx`: Updated product cards with "Add to Cart" functionality
- Search functionality with real-time filtering
- Category-based sorting and pagination controls
- Integration with CartContext for seamless shopping experience
- Responsive grid layout with accessibility features
- Support for both product browsing and cart management

### Utility Components

#### Dashboard Components (`dashboard/`)

- `ChartComponent.tsx`: Reusable chart wrapper
- `DataTable.tsx`: Generic data table
- `DateRangeSelector.tsx`: Date range picker
- `MetricCard.tsx`: KPI metric display
- `ProductivityChart.tsx`: Production metrics chart
- `StatsComparison.tsx`: Comparative statistics

#### Icon Components (`icons/`)

- `brand/`: Bakery brand icons (logo, dividers)
- `products/`: Product category icons
- `socials/`: Social media icons
- `Message.tsx`, `Phone.tsx`, `User.tsx`: Common UI icons

#### Information Components (`info/`)

- `Calendar.tsx`: Event calendar display
- `News.tsx`: News ticker component
- `Products.tsx`: Product information display
- `RSSFeed.tsx`: RSS feed reader
- `Slideshow.tsx`: Image slideshow
- `Weather.tsx`: Weather widget
- `useDate.tsx`: Date hook utility

#### Order Components (`orders/`)

- `Form.tsx`: Order creation form
- `OrderDetailView.tsx`: Order details display
- `OrderForm.tsx`: Customer order form
- `QuickOrderForm.tsx`: Simplified order form
- `weekly-view/`: Weekly order calendar

#### Product Components (`products/`)

- `Filter.tsx`: Enhanced product filtering interface with API integration
- `ProductDetail.tsx`: Individual product details
- `types.ts`: Product type definitions (deprecated - now using `/types/product.ts`)

**Enhanced Product Filtering:**

- Integration with real API product data via `allProducts` prop
- Category filtering with "All" option and visual filter buttons
- Real-time filtering without API calls for better performance
- Support for dynamic product categories from backend data

#### Social Media Components (`socialMedia/`)

- `SocialMediaContentCreator.tsx`: Content creation tool
- `config/`: Template configurations
- `core/`: Core functionality components
- `utils/`: Social media utilities

#### Theme Components (`theme/`)

- `ThemeToggler.tsx`: Light/dark mode toggle for admin

## Component Patterns

### Common Props Interface

```typescript
interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
  variant?: 'primary' | 'secondary' | 'outlined'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
}
```

### Material UI Integration

```typescript
import { styled, useTheme } from '@mui/material/styles'
import { Box, Typography, Button } from '@mui/material'

const StyledComponent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
}))
```

### Context Integration

```typescript
import { useContext } from 'react'
import { CartContext } from '@/context/CartContext'
import { ThemeContext } from '@/context/ThemeContext'

export const Component = () => {
  const { addToCart, items, totalCount, totalPrice } = useContext(CartContext)
  const { isDarkMode } = useContext(ThemeContext)

  // Modern cart operations
  const handleAddToCart = (product: Product) => {
    addToCart(product) // Automatically handles quantity increments
  }

  const handleUpdateQuantity = (id: number, quantity: number) => {
    updateQuantity(id, quantity) // Direct quantity setting
  }

  const handleRemoveItem = (id: number) => {
    removeFromCart(id) // Complete item removal
  }
}
```

**CartContext Features:**

- Optimized state management with `useMemo` for calculated values
- Modern React patterns with `useCallback` for performance
- Automatic total calculation and quantity management
- TypeScript integration with proper Product and CartItem types

## Testing Strategy

### Component Testing

Each component directory includes `__tests__/` folders with:

- Unit tests for component logic
- Rendering tests with different props
- User interaction testing
- Context integration testing

### Testing Utilities

```typescript
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@/context/ThemeContext'
import { CartProvider } from '@/context/CartContext'

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <CartProvider>{component}</CartProvider>
    </ThemeProvider>
  )
}
```

## Styling Guidelines

### Theme Integration

- Use Material UI theme system for consistency
- Follow responsive design patterns
- Implement dark/light mode support where appropriate

### Component Styling

```typescript
const useStyles = () => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  header: {
    typography: 'h6',
    color: 'primary.main',
  },
})
```

### Responsive Design

```typescript
const StyledContainer = styled(Box)(({ theme }) => ({
  [theme.breakpoints.down('md')]: {
    flexDirection: 'column',
  },
  [theme.breakpoints.up('md')]: {
    flexDirection: 'row',
  },
}))
```

## Performance Optimization

### Code Splitting

- Lazy load components where appropriate
- Use React.memo for expensive renders
- Implement proper dependency arrays for hooks

### Bundle Optimization

```typescript
import { lazy, Suspense } from 'react'

const HeavyComponent = lazy(() => import('./HeavyComponent'))

export const Container = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <HeavyComponent />
  </Suspense>
)
```

## Accessibility

### ARIA Support

- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility
- Focus management

### Implementation

```typescript
<Button
  aria-label="Add to cart"
  role="button"
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Add to Cart
</Button>
```

## Integration Points

### API Integration

```typescript
import { useBakeryAPI } from '@/services/bakeryAPI'

export const DataComponent = () => {
  const { data, loading, error } = useBakeryAPI('/products')
  // Component logic
}
```

### State Management

- React Context for global state
- Local state for component-specific data
- React Query for server state

### Navigation

```typescript
import { useRouter } from 'next/navigation'

export const NavigationComponent = () => {
  const router = useRouter()

  const handleNavigation = () => {
    router.push('/admin/products')
  }
}
```

## Development Guidelines

### Component Creation

1. Create component directory with descriptive name
2. Implement main component with TypeScript
3. Add prop types and interfaces
4. Create test file in `__tests__/` directory
5. Document component purpose and usage

### Naming Conventions

- PascalCase for component names
- camelCase for prop names
- Descriptive file names matching component names
- Clear directory structure by feature

### Code Quality

- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Jest for testing
- Component documentation with JSDoc

## Future Enhancements

### Planned Features

- Enhanced accessibility features
- Performance monitoring
- Storybook integration
- Visual regression testing
- Component library extraction

### Scalability Considerations

- Component composition patterns
- Design system consistency
- Reusability improvements
- Documentation automation
