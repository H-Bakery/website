'use client'

/**
 * @fileoverview Enhanced theme context with system preference detection and transitions
 * @module @bakery/shared/contexts/theme
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

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
 * Theme context
 */
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/**
 * Get system color scheme preference
 */
const getSystemColorScheme = (): ColorScheme => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Resolve color scheme from theme mode
 */
const resolveColorScheme = (mode: ThemeMode, systemPrefersDark: boolean): ColorScheme => {
  if (mode === 'system') {
    return systemPrefersDark ? 'dark' : 'light'
  }
  return mode as ColorScheme
}

/**
 * Enhanced theme provider component
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultMode = 'light',
  defaultEnableTransitions = true,
  storageKey = 'bakery-theme',
  disablePersistence = false,
  customTheme: initialCustomTheme,
}) => {
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemColorScheme() === 'dark')
  const [mode, setModeState] = useState<ThemeMode>(defaultMode)
  const [enableTransitions, setEnableTransitions] = useState(defaultEnableTransitions)
  const [customTheme, setCustomTheme] = useState(initialCustomTheme)

  // Calculate resolved color scheme
  const colorScheme = useMemo(
    () => resolveColorScheme(mode, systemPrefersDark),
    [mode, systemPrefersDark]
  )

  // Create theme config
  const theme = useMemo<ThemeConfig>(
    () => ({
      mode,
      colorScheme,
      enableTransitions,
      customTheme,
    }),
    [mode, colorScheme, enableTransitions, customTheme]
  )

  // Initialize theme from storage
  useEffect(() => {
    if (typeof window === 'undefined' || disablePersistence) return

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const config = JSON.parse(stored)
        if (config.mode && ['light', 'dark', 'system'].includes(config.mode)) {
          setModeState(config.mode)
        }
        if (typeof config.enableTransitions === 'boolean') {
          setEnableTransitions(config.enableTransitions)
        }
        if (config.customTheme) {
          setCustomTheme(config.customTheme)
        }
      }
    } catch (error) {
      console.warn('Failed to load theme from storage:', error)
    }
  }, [storageKey, disablePersistence])

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches)
    }

    // Modern browsers
    mediaQuery.addEventListener?.('change', handleChange)
    
    // Legacy browsers
    if (!mediaQuery.addEventListener) {
      mediaQuery.addListener?.(handleChange)
    }

    return () => {
      mediaQuery.removeEventListener?.('change', handleChange)
      if (!mediaQuery.removeEventListener) {
        mediaQuery.removeListener?.(handleChange)
      }
    }
  }, [])

  // Apply theme class to document
  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = document.documentElement
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark')
    
    // Add current theme class
    root.classList.add(colorScheme)
    
    // Apply transition class
    if (enableTransitions) {
      root.classList.add('theme-transitions')
    } else {
      root.classList.remove('theme-transitions')
    }

    // Apply custom CSS variables
    if (customTheme) {
      Object.entries(customTheme).forEach(([key, value]) => {
        root.style.setProperty(`--theme-${key}`, String(value))
      })
    }
  }, [colorScheme, enableTransitions, customTheme])

  // Persist theme configuration
  useEffect(() => {
    if (typeof window === 'undefined' || disablePersistence) return

    try {
      const config = {
        mode,
        enableTransitions,
        customTheme,
      }
      localStorage.setItem(storageKey, JSON.stringify(config))
    } catch (error) {
      console.warn('Failed to save theme to storage:', error)
    }
  }, [mode, enableTransitions, customTheme, storageKey, disablePersistence])

  // Toggle theme handler
  const toggleTheme = useCallback(() => {
    setModeState(current => {
      if (current === 'light') return 'dark'
      if (current === 'dark') return 'system'
      return 'light'
    })
  }, [])

  // Set mode handler
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode)
  }, [])

  // Set transitions enabled handler
  const setTransitionsEnabled = useCallback((enabled: boolean) => {
    setEnableTransitions(enabled)
  }, [])

  // Reset theme handler
  const resetTheme = useCallback(() => {
    setModeState(defaultMode)
    setEnableTransitions(defaultEnableTransitions)
    setCustomTheme(initialCustomTheme)
  }, [defaultMode, defaultEnableTransitions, initialCustomTheme])

  // Context value
  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      mode,
      colorScheme,
      toggleTheme,
      setMode,
      setTransitionsEnabled,
      setCustomTheme,
      resetTheme,
      systemPrefersDark,
    }),
    [theme, mode, colorScheme, toggleTheme, setMode, systemPrefersDark]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Hook to use theme context
 * @throws {Error} If used outside of ThemeProvider
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

/**
 * Hook to get just the color scheme
 */
export const useColorScheme = (): ColorScheme => {
  const { colorScheme } = useTheme()
  return colorScheme
}

/**
 * Hook to check if dark mode is active
 */
export const useIsDarkMode = (): boolean => {
  const { colorScheme } = useTheme()
  return colorScheme === 'dark'
}