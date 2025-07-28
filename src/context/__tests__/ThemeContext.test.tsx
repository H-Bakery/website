import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider, useTheme } from '../ThemeContext'

// Test component that uses the theme context
const TestComponent = () => {
  const { mode, toggleTheme, setMode } = useTheme()
  
  return (
    <div>
      <div data-testid="theme-mode">{mode}</div>
      <button onClick={toggleTheme} data-testid="toggle-theme">Toggle Theme</button>
      <button onClick={() => setMode('light')} data-testid="set-light">Set Light</button>
      <button onClick={() => setMode('dark')} data-testid="set-dark">Set Dark</button>
    </div>
  )
}

describe('ThemeContext', () => {
  // Clear localStorage between tests
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })

  it('provides default light theme when no theme is stored', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )
    
    expect(screen.getByTestId('theme-mode')).toHaveTextContent('light')
    expect(localStorage.getItem).toHaveBeenCalledWith('themeMode')
  })

  it('loads theme from localStorage on initial render', () => {
    localStorage.getItem.mockReturnValueOnce('dark')
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )
    
    expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark')
  })

  it('toggles between light and dark themes', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )
    
    // Default is light
    expect(screen.getByTestId('theme-mode')).toHaveTextContent('light')
    
    // Toggle to dark
    fireEvent.click(screen.getByTestId('toggle-theme'))
    expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark')
    expect(localStorage.setItem).toHaveBeenCalledWith('themeMode', 'dark')
    
    // Toggle back to light
    fireEvent.click(screen.getByTestId('toggle-theme'))
    expect(screen.getByTestId('theme-mode')).toHaveTextContent('light')
    expect(localStorage.setItem).toHaveBeenCalledWith('themeMode', 'light')
  })

  it('directly sets theme mode', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )
    
    // Set to dark explicitly
    fireEvent.click(screen.getByTestId('set-dark'))
    expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark')
    expect(localStorage.setItem).toHaveBeenCalledWith('themeMode', 'dark')
    
    // Set to light explicitly
    fireEvent.click(screen.getByTestId('set-light'))
    expect(screen.getByTestId('theme-mode')).toHaveTextContent('light')
    expect(localStorage.setItem).toHaveBeenCalledWith('themeMode', 'light')
  })

  it('ignores invalid saved theme value', () => {
    // Set invalid theme value
    localStorage.getItem.mockReturnValueOnce('invalid_theme')
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )
    
    // Should default to light
    expect(screen.getByTestId('theme-mode')).toHaveTextContent('light')
  })

  it('throws error when useTheme is used outside of ThemeProvider', () => {
    // Spy on console.error to prevent the error from being displayed in test output
    const consoleErrorSpy = jest.spyOn(console, 'error')
    consoleErrorSpy.mockImplementation(() => {})
    
    // Expect the error to be thrown
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useTheme must be used within a ThemeProvider')
    
    // Restore console.error
    consoleErrorSpy.mockRestore()
  })
})