/**
 * Button Components Export
 *
 * Re-exports all button-related components for easy consumption
 *
 * @example Basic button usage:
 * ```tsx
 * import { Button } from '@bakery/shared/ui'
 *
 * <Button variant="contained" color="primary">
 *   Click me
 * </Button>
 * ```
 *
 * @example Enhanced button with animations:
 * ```tsx
 * import { EnhancedButton } from '@bakery/shared/ui'
 *
 * <EnhancedButton variant="contained" pulse shimmer>
 *   Animated Button
 * </EnhancedButton>
 * ```
 */

// Export components
export { Button } from './button'
export { EnhancedButton } from './enhanced-button'

// Export types
export type { ButtonProps } from './button'
export type { EnhancedButtonProps } from './enhanced-button'

// Re-export default for backwards compatibility
export { Button as default } from './button'
