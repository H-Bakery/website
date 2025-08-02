/**
 * Bakery Shared UI Library
 *
 * A comprehensive collection of reusable React components for the bakery application.
 * Built with Material UI, TypeScript, and modern React patterns.
 *
 * @example Import individual components:
 * ```tsx
 * import { Button, Input, NavigationButton, Hero, CallToAction } from '@bakery/shared/ui'
 * ```
 *
 * @example Import layout components:
 * ```tsx
 * import { Header, Footer, CartButton, ProductCard } from '@bakery/shared/ui'
 * ```
 *
 * @example Import dashboard components:
 * ```tsx
 * import { MetricCard, DataTable, ChartComponent } from '@bakery/shared/ui'
 * ```
 *
 * @example Import icons:
 * ```tsx
 * import { MessageIcon, BrotIcon, FacebookIcon } from '@bakery/shared/ui'
 * ```
 *
 * @example Import with types:
 * ```tsx
 * import { Button, type ButtonProps, type HeroProps } from '@bakery/shared/ui'
 * ```
 */

// Core UI Components
export * from './lib/button'
export * from './lib/input'
export * from './lib/navigation'
export * from './lib/display'

// Layout Components
export * from './lib/layout'

// Feature Components
export * from './lib/cart'
export * from './lib/products'

// Dashboard Components
export * from './lib/dashboard'

// Mobile Components
export * from './lib/mobile'

// Social Media Components
export * from './lib/social'

// Icon Components
export * from './lib/icons'

// Re-export most commonly used components as defaults
export { Button as DefaultButton } from './lib/button'
export { Input as DefaultInput } from './lib/input'
export { NavigationButton as DefaultNavigationButton } from './lib/navigation'
export { Hero as DefaultHero } from './lib/display'
export { CallToAction as DefaultCallToAction } from './lib/display'

// Re-export commonly used layout components
export { Header as DefaultHeader, Footer as DefaultFooter } from './lib/layout'

// Re-export commonly used feature components
export {
  CartButton as DefaultCartButton,
  ProductCard as DefaultProductCard,
} from './lib/cart'

// Re-export commonly used dashboard components
export {
  MetricCard as DefaultMetricCard,
  DataTable as DefaultDataTable,
} from './lib/dashboard'
