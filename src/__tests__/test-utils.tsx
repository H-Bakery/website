/* eslint-disable testing-library/await-async-query, testing-library/no-await-sync-query, testing-library/no-render-in-setup, testing-library/prefer-wait-for */
import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '../context/ThemeContext'
import CartProvider from '../context/CartContext'
import { UserEvent } from '@testing-library/user-event/dist/types/setup/setup'

// Create a custom renderer that includes providers
interface AllProvidersProps {
  children: React.ReactNode
  initialTheme?: 'light' | 'dark'
}

const AllProviders = ({ 
  children,
  initialTheme = 'light'
}: AllProvidersProps) => {
  // Set theme in localStorage before rendering
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('themeMode', initialTheme)
  }

  return (
    <ThemeProvider>
      <CartProvider>
        {children}
      </CartProvider>
    </ThemeProvider>
  )
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialTheme?: 'light' | 'dark'
}

function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { initialTheme, ...renderOptions } = options || {}
  
  return {
    ...render(ui, { 
      wrapper: (props) => (
        <AllProviders {...props} initialTheme={initialTheme} />
      ),
      ...renderOptions,
    }),
    user: userEvent.setup() 
  }
}

// Helper function to setup userEvent
function setup(): UserEvent {
  return userEvent.setup()
}

// Re-export everything from testing-library
export * from '@testing-library/react'

// Override render method and export other helpers
export { customRender as render, setup }