'use client'
import React, { createContext, useContext, useState, useEffect } from 'react'

type ThemeMode = 'light' | 'dark'

interface ThemeContextType {
  mode: ThemeMode
  toggleTheme: () => void
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // Always default to light mode
  const [mode, setMode] = useState<ThemeMode>('light')
  
  // Initialize theme from localStorage when component mounts (client-side only)
  useEffect(() => {
    // Check if we're in the browser environment
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('themeMode') as ThemeMode
      // Check if the saved mode is valid, only then apply it
      if (savedMode === 'light' || savedMode === 'dark') {
        setMode(savedMode)
      }
      // Always default to light mode, no system preference check
    }
  }, [])

  const toggleTheme = () => {
    const newMode = mode === 'light' ? 'dark' : 'light'
    setMode(newMode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('themeMode', newMode)
    }
  }

  // Handler to set mode explicitly
  const handleSetMode = (newMode: ThemeMode) => {
    setMode(newMode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('themeMode', newMode)
    }
  }

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setMode: handleSetMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}