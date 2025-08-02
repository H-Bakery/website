/**
 * @fileoverview Root provider that combines all application contexts
 * @module @bakery/shared/contexts/root
 */

import React from 'react'
import { ThemeProvider, ThemeProviderProps } from './theme/theme.context'
import { AuthProvider, AuthProviderProps } from './auth/auth.context'
import { CartProvider, CartProviderProps } from './cart/cart.context'
// TODO: Re-enable after fixing dependencies
// import { NotificationProvider, NotificationProviderProps } from './notification/notification.context'

/**
 * Root provider props combining all context provider props
 */
export interface RootProviderProps {
  /** Child components */
  children: React.ReactNode
  /** Theme provider configuration */
  theme?: Omit<ThemeProviderProps, 'children'>
  /** Auth provider configuration */
  auth?: Omit<AuthProviderProps, 'children'>
  /** Cart provider configuration */
  cart?: Omit<CartProviderProps, 'children'>
  /** Notification provider configuration */
  // TODO: Re-enable after fixing dependencies
  // notification?: Omit<NotificationProviderProps, 'children'>
}

/**
 * Root provider that combines all application contexts
 *
 * @example
 * ```tsx
 * <RootProvider
 *   theme={{ defaultMode: 'system' }}
 *   auth={{ refreshInterval: 300000 }}
 *   cart={{ enablePersistence: true }}
 *   notification={{ enableRealTime: true }}
 * >
 *   <App />
 * </RootProvider>
 * ```
 */
export const RootProvider: React.FC<RootProviderProps> = ({
  children,
  theme,
  auth,
  cart,
  // TODO: Re-enable after fixing dependencies
  // notification,
}) => {
  return (
    <ThemeProvider {...theme}>
      <AuthProvider {...auth}>
        {/* TODO: Re-enable after fixing dependencies */}
        {/* <NotificationProvider {...notification}> */}
        <CartProvider {...cart}>{children}</CartProvider>
        {/* </NotificationProvider> */}
      </AuthProvider>
    </ThemeProvider>
  )
}

/**
 * HOC to wrap a component with the root provider
 *
 * @example
 * ```tsx
 * export default withRootProvider(App, {
 *   theme: { defaultMode: 'light' },
 *   auth: { checkAuthOnMount: true }
 * })
 * ```
 */
export function withRootProvider<P extends object>(
  Component: React.ComponentType<P>,
  config?: Omit<RootProviderProps, 'children'>
): React.ComponentType<P> {
  const WrappedComponent: React.FC<P> = (props) => (
    <RootProvider {...config}>
      <Component {...props} />
    </RootProvider>
  )

  WrappedComponent.displayName = `withRootProvider(${
    Component.displayName || Component.name
  })`

  return WrappedComponent
}
