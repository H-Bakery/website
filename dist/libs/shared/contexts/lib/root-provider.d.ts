import { default as React } from 'react'
import { ThemeProviderProps } from './theme/theme.context'
import { AuthProviderProps } from './auth/auth.context'
import { CartProviderProps } from './cart/cart.context'
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
export declare const RootProvider: React.FC<RootProviderProps>
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
export declare function withRootProvider<P extends object>(
  Component: React.ComponentType<P>,
  config?: Omit<RootProviderProps, 'children'>
): React.ComponentType<P>
