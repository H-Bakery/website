import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { RootProvider } from '@bakery/shared/contexts'

// Create a test theme based on the light theme
const testTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#8B4513', // Saddle brown
      light: '#A0522D',
      dark: '#654321',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#D2691E', // Chocolate
      light: '#DEB887',
      dark: '#8B4513',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FFF8DC', // Cornsilk
      paper: '#FFFEF7',
    },
    text: {
      primary: '#3E2723',
      secondary: '#5D4037',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      color: '#3E2723',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      color: '#3E2723',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
      color: '#3E2723',
    },
  },
})

interface TestProvidersProps {
  children: React.ReactNode
}

/**
 * Test wrapper component that provides all necessary contexts and themes
 * for testing components in isolation
 */
export const TestProviders: React.FC<TestProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider theme={testTheme}>
      <CssBaseline />
      <RootProvider>{children}</RootProvider>
    </ThemeProvider>
  )
}

/**
 * Enhanced render function that wraps components with all necessary providers
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: TestProviders, ...options })
}

/**
 * Lightweight theme-only wrapper for components that don't need full context
 */
export const ThemeTestWrapper: React.FC<TestProvidersProps> = ({
  children,
}) => {
  return (
    <ThemeProvider theme={testTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}

/**
 * Theme-only render function for simple component testing
 */
export function renderWithTheme(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: ThemeTestWrapper, ...options })
}

// Re-export testing-library utilities for convenience
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
