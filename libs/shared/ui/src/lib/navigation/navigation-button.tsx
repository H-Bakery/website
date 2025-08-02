'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import { Button, ButtonProps } from '../button/button'

/**
 * Navigation button props extending ButtonProps
 * @interface NavigationButtonProps
 */
export interface NavigationButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** The route to navigate to */
  href: string
  /** Optional onClick handler that receives the route */
  onClick?: (href: string) => void
  /** Whether to replace the current route instead of pushing */
  replace?: boolean
}

/**
 * Navigation button component that wraps the Button component with Next.js routing
 *
 * Features:
 * - Programmatic navigation using Next.js router
 * - Support for both push and replace navigation
 * - Optional custom onClick handler
 * - Inherits all Button component features
 *
 * @component
 * @example
 * ```tsx
 * // Basic navigation
 * <NavigationButton href="/products">
 *   View Products
 * </NavigationButton>
 *
 * // With custom onClick and replace
 * <NavigationButton
 *   href="/login"
 *   replace
 *   onClick={(href) => console.log(`Navigating to ${href}`)}
 *   variant="outlined"
 * >
 *   Login
 * </NavigationButton>
 *
 * // With enhanced styling
 * <NavigationButton
 *   href="/checkout"
 *   variant="contained"
 *   color="primary"
 *   size="large"
 * >
 *   Proceed to Checkout
 * </NavigationButton>
 * ```
 */
export const NavigationButton: React.FC<NavigationButtonProps> = ({
  href,
  onClick,
  replace = false,
  children,
  ...props
}) => {
  const router = useRouter()

  const handleClick = () => {
    // Call custom onClick handler if provided
    if (onClick) {
      onClick(href)
    }

    // Navigate using Next.js router
    if (replace) {
      router.replace(href)
    } else {
      router.push(href)
    }
  }

  return (
    <Button onClick={handleClick} {...props}>
      {children}
    </Button>
  )
}

export default NavigationButton
