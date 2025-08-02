import { default as React } from 'react'
/**
 * Available theme modes
 */
export type ThemeMode = 'light' | 'dark' | 'system'
/**
 * Color scheme preference
 */
export type ColorScheme = 'light' | 'dark'
/**
 * Theme configuration
 */
export interface ThemeConfig {
  /** Current theme mode setting */
  mode: ThemeMode
  /** Resolved color scheme (light or dark) */
  colorScheme: ColorScheme
  /** Whether transitions are enabled during theme changes */
  enableTransitions: boolean
  /** Custom theme overrides */
  customTheme?: Record<string, any>
}
/**
 * Theme context type
 */
export interface ThemeContextType {
  /** Current theme configuration */
  theme: ThemeConfig
  /** Current theme mode */
  mode: ThemeMode
  /** Resolved color scheme */
  colorScheme: ColorScheme
  /** Toggle between light and dark modes */
  toggleTheme: () => void
  /** Set theme mode explicitly */
  setMode: (mode: ThemeMode) => void
  /** Enable or disable transitions */
  setTransitionsEnabled: (enabled: boolean) => void
  /** Apply custom theme overrides */
  setCustomTheme: (customTheme: Record<string, any>) => void
  /** Reset to default theme */
  resetTheme: () => void
  /** Whether the system prefers dark mode */
  systemPrefersDark: boolean
}
/**
 * Theme provider props
 */
export interface ThemeProviderProps {
  /** Child components */
  children: React.ReactNode
  /** Default theme mode */
  defaultMode?: ThemeMode
  /** Default enable transitions */
  defaultEnableTransitions?: boolean
  /** Storage key for persistence */
  storageKey?: string
  /** Whether to disable persistence */
  disablePersistence?: boolean
  /** Custom theme overrides */
  customTheme?: Record<string, any>
}
/**
 * Enhanced theme provider component
 */
export declare const ThemeProvider: React.FC<ThemeProviderProps>
/**
 * Hook to use theme context
 * @throws {Error} If used outside of ThemeProvider
 */
export declare const useTheme: () => ThemeContextType
/**
 * Hook to get just the color scheme
 */
export declare const useColorScheme: () => ColorScheme
/**
 * Hook to check if dark mode is active
 */
export declare const useIsDarkMode: () => boolean
