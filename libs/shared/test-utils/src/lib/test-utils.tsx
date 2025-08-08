'use client'
import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

// Create a default theme for testing
const defaultTheme = createTheme({
  palette: {
    mode: 'light',
  },
})

interface TestProviderProps {
  children: React.ReactNode
  theme?: any
}

// Provider wrapper for tests
function TestProviders({ children, theme = defaultTheme }: TestProviderProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}

// Custom render function with theme
export function renderWithTheme(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { theme?: any }
) {
  const { theme, ...renderOptions } = options || {}
  
  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders theme={theme}>{children}</TestProviders>
    ),
    ...renderOptions,
  })
}

// Re-export everything from testing library
export * from '@testing-library/react'