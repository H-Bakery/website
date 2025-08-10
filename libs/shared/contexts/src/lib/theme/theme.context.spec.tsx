/**
 * @fileoverview Tests for enhanced theme context
 * @module @bakery/shared/contexts/theme/tests
 */

import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { ThemeProvider, useTheme, useColorScheme, useIsDarkMode } from './theme.context'

// Mock matchMedia
const mockMatchMedia = (matches: boolean) => ({
  matches,
  media: '',
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('ThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    window.matchMedia = jest.fn().mockImplementation(query => {
      return mockMatchMedia(query === '(prefers-color-scheme: dark)')
    })
  })

  it('should provide default light theme', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    })

    expect(result.current.mode).toBe('light')
    expect(result.current.colorScheme).toBe('light')
    expect(result.current.theme.enableTransitions).toBe(true)
  })

  it('should toggle theme between light, dark, and system', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    })

    // Initial: light
    expect(result.current.mode).toBe('light')

    // Toggle to dark
    act(() => {
      result.current.toggleTheme()
    })
    expect(result.current.mode).toBe('dark')
    expect(result.current.colorScheme).toBe('dark')

    // Toggle to system
    act(() => {
      result.current.toggleTheme()
    })
    expect(result.current.mode).toBe('system')
    
    // Toggle back to light
    act(() => {
      result.current.toggleTheme()
    })
    expect(result.current.mode).toBe('light')
  })

  it('should set theme mode explicitly', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    })

    act(() => {
      result.current.setMode('dark')
    })
    expect(result.current.mode).toBe('dark')
    expect(result.current.colorScheme).toBe('dark')

    act(() => {
      result.current.setMode('system')
    })
    expect(result.current.mode).toBe('system')
  })

  it('should detect system preference', () => {
    // Mock dark mode preference
    window.matchMedia = jest.fn().mockImplementation(query => {
      return mockMatchMedia(query === '(prefers-color-scheme: dark)')
    })

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider defaultMode="system">{children}</ThemeProvider>
      ),
    })

    expect(result.current.mode).toBe('system')
    expect(result.current.colorScheme).toBe('dark')
    expect(result.current.systemPrefersDark).toBe(true)
  })

  it('should persist theme to localStorage', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    })

    act(() => {
      result.current.setMode('dark')
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'bakery-theme',
      expect.stringContaining('"mode":"dark"')
    )
  })

  it('should load theme from localStorage', () => {
    const savedTheme = {
      mode: 'dark',
      enableTransitions: false,
    }

    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedTheme))

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    })

    expect(result.current.mode).toBe('dark')
    expect(result.current.theme.enableTransitions).toBe(false)
  })

  it('should disable persistence when configured', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider disablePersistence>{children}</ThemeProvider>
      ),
    })

    act(() => {
      result.current.setMode('dark')
    })

    expect(localStorageMock.setItem).not.toHaveBeenCalled()
  })

  it('should enable/disable transitions', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    })

    expect(result.current.theme.enableTransitions).toBe(true)

    act(() => {
      result.current.setTransitionsEnabled(false)
    })

    expect(result.current.theme.enableTransitions).toBe(false)
  })

  it('should apply custom theme', () => {
    const customTheme = {
      primaryColor: '#ff0000',
      fontSize: '16px',
    }

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider customTheme={customTheme}>{children}</ThemeProvider>
      ),
    })

    expect(result.current.theme.customTheme).toEqual(customTheme)

    // Update custom theme
    const newTheme = { primaryColor: '#00ff00' }
    act(() => {
      result.current.setCustomTheme(newTheme)
    })

    expect(result.current.theme.customTheme).toEqual(newTheme)
  })

  it('should reset theme to defaults', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider defaultMode="light" defaultEnableTransitions={false}>
          {children}
        </ThemeProvider>
      ),
    })

    // Change settings
    act(() => {
      result.current.setMode('dark')
      result.current.setTransitionsEnabled(true)
    })

    expect(result.current.mode).toBe('dark')
    expect(result.current.theme.enableTransitions).toBe(true)

    // Reset
    act(() => {
      result.current.resetTheme()
    })

    expect(result.current.mode).toBe('light')
    expect(result.current.theme.enableTransitions).toBe(false)
  })

  it('should apply theme classes to document', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    })

    // Check light class
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    // Change to dark
    act(() => {
      result.current.setMode('dark')
    })

    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('should handle system theme changes', () => {
    let darkModeListener: ((e: MediaQueryListEvent) => void) | null = null

    window.matchMedia = jest.fn().mockImplementation(query => {
      const mediaQuery = mockMatchMedia(false)
      mediaQuery.addEventListener = jest.fn((event, listener) => {
        if (event === 'change') {
          darkModeListener = listener
        }
      })
      return mediaQuery
    })

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider defaultMode="system">{children}</ThemeProvider>
      ),
    })

    expect(result.current.colorScheme).toBe('light')

    // Simulate system change to dark mode
    act(() => {
      darkModeListener?.({ matches: true } as MediaQueryListEvent)
    })

    expect(result.current.colorScheme).toBe('dark')
  })

  describe('useColorScheme hook', () => {
    it('should return current color scheme', () => {
      const { result } = renderHook(() => useColorScheme(), {
        wrapper: ({ children }) => (
          <ThemeProvider defaultMode="dark">{children}</ThemeProvider>
        ),
      })

      expect(result.current).toBe('dark')
    })
  })

  describe('useIsDarkMode hook', () => {
    it('should return true for dark mode', () => {
      const { result } = renderHook(() => useIsDarkMode(), {
        wrapper: ({ children }) => (
          <ThemeProvider defaultMode="dark">{children}</ThemeProvider>
        ),
      })

      expect(result.current).toBe(true)
    })

    it('should return false for light mode', () => {
      const { result } = renderHook(() => useIsDarkMode(), {
        wrapper: ({ children }) => (
          <ThemeProvider defaultMode="light">{children}</ThemeProvider>
        ),
      })

      expect(result.current).toBe(false)
    })
  })

  it('should throw error when used outside provider', () => {
    const { result } = renderHook(() => useTheme())

    expect(() => result.current).toThrow('useTheme must be used within a ThemeProvider')
  })
})