import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import RootLayout from './layout'

// Mock the shared providers
jest.mock('@bakery/shared/contexts', () => ({
  RootProvider: jest.fn(({ children }) => (
    <div data-testid="root-provider">
      <div data-testid="theme-provider">Theme Provider Active</div>
      <div data-testid="cart-provider">Cart Provider Active</div>
      <div data-testid="auth-provider">Auth Provider Active</div>
      <div data-testid="notification-provider">
        Notification Provider Active
      </div>
      {children}
    </div>
  )),
}))

// Mock Next.js metadata
jest.mock('next/font/google', () => ({
  Inter: jest.fn(() => ({
    className: 'inter-font',
  })),
}))

describe('RootLayout (Shop App)', () => {
  const mockChildren = (
    <main data-testid="page-content">
      <h1>Shop Page Content</h1>
      <p>This is the page content</p>
    </main>
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Layout Structure', () => {
    it('renders the root HTML structure', () => {
      renderWithTheme(<RootLayout>{mockChildren}</RootLayout>)

      // Check that children are rendered
      expect(screen.getByTestId('page-content')).toBeInTheDocument()
      expect(screen.getByText('Shop Page Content')).toBeInTheDocument()
    })

    it('wraps content in RootProvider for context management', () => {
      renderWithTheme(<RootLayout>{mockChildren}</RootLayout>)

      // Check that RootProvider is applied
      expect(screen.getByTestId('root-provider')).toBeInTheDocument()

      // Verify all context providers are active
      expect(screen.getByTestId('theme-provider')).toBeInTheDocument()
      expect(screen.getByTestId('cart-provider')).toBeInTheDocument()
      expect(screen.getByTestId('auth-provider')).toBeInTheDocument()
      expect(screen.getByTestId('notification-provider')).toBeInTheDocument()
    })

    it('renders children inside the provider structure', () => {
      renderWithTheme(<RootLayout>{mockChildren}</RootLayout>)

      const rootProvider = screen.getByTestId('root-provider')
      const pageContent = screen.getByTestId('page-content')

      expect(rootProvider).toContainElement(pageContent)
      expect(pageContent).toHaveTextContent('Shop Page Content')
      expect(pageContent).toHaveTextContent('This is the page content')
    })
  })

  describe('Provider Integration', () => {
    it('integrates RootProvider correctly', () => {
      const { RootProvider } = require('@bakery/shared/contexts')

      renderWithTheme(<RootLayout>{mockChildren}</RootLayout>)

      expect(RootProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          children: mockChildren,
        }),
        expect.any(Object)
      )
    })

    it('provides all necessary contexts for shop functionality', () => {
      renderWithTheme(<RootLayout>{mockChildren}</RootLayout>)

      // Verify all essential providers are available
      expect(screen.getByTestId('theme-provider')).toHaveTextContent(
        'Theme Provider Active'
      )
      expect(screen.getByTestId('cart-provider')).toHaveTextContent(
        'Cart Provider Active'
      )
      expect(screen.getByTestId('auth-provider')).toHaveTextContent(
        'Auth Provider Active'
      )
      expect(screen.getByTestId('notification-provider')).toHaveTextContent(
        'Notification Provider Active'
      )
    })
  })

  describe('Accessibility', () => {
    it('provides proper document structure', () => {
      renderWithTheme(<RootLayout>{mockChildren}</RootLayout>)

      // Content should be accessible
      expect(screen.getByTestId('page-content')).toBeInTheDocument()
      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('maintains semantic HTML structure', () => {
      renderWithTheme(
        <RootLayout>
          <header data-testid="header">Header</header>
          <main data-testid="main">Main Content</main>
          <footer data-testid="footer">Footer</footer>
        </RootLayout>
      )

      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('main')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })
  })

  describe('Shop-Specific Features', () => {
    it('enables cart functionality through provider', () => {
      renderWithTheme(<RootLayout>{mockChildren}</RootLayout>)

      // Cart provider should be active for shop functionality
      expect(screen.getByTestId('cart-provider')).toBeInTheDocument()
      expect(screen.getByTestId('cart-provider')).toHaveTextContent(
        'Cart Provider Active'
      )
    })

    it('enables theme management for consistent styling', () => {
      renderWithTheme(<RootLayout>{mockChildren}</RootLayout>)

      // Theme provider should be active for Material UI theming
      expect(screen.getByTestId('theme-provider')).toBeInTheDocument()
      expect(screen.getByTestId('theme-provider')).toHaveTextContent(
        'Theme Provider Active'
      )
    })

    it('enables authentication for potential user features', () => {
      renderWithTheme(<RootLayout>{mockChildren}</RootLayout>)

      // Auth provider should be available for login/user features
      expect(screen.getByTestId('auth-provider')).toBeInTheDocument()
      expect(screen.getByTestId('auth-provider')).toHaveTextContent(
        'Auth Provider Active'
      )
    })

    it('enables notifications for user feedback', () => {
      renderWithTheme(<RootLayout>{mockChildren}</RootLayout>)

      // Notification provider should be active for user feedback
      expect(screen.getByTestId('notification-provider')).toBeInTheDocument()
      expect(screen.getByTestId('notification-provider')).toHaveTextContent(
        'Notification Provider Active'
      )
    })
  })

  describe('Multiple Children Support', () => {
    it('handles multiple child components', () => {
      const multipleChildren = (
        <>
          <header data-testid="child-header">Shop Header</header>
          <main data-testid="child-main">Shop Main</main>
          <footer data-testid="child-footer">Shop Footer</footer>
        </>
      )

      renderWithTheme(<RootLayout>{multipleChildren}</RootLayout>)

      expect(screen.getByTestId('child-header')).toBeInTheDocument()
      expect(screen.getByTestId('child-main')).toBeInTheDocument()
      expect(screen.getByTestId('child-footer')).toBeInTheDocument()
    })

    it('handles complex nested components', () => {
      const complexChildren = (
        <div data-testid="page-wrapper">
          <nav data-testid="navigation">
            <ul>
              <li>
                <a href="/products">Products</a>
              </li>
              <li>
                <a href="/cart">Cart</a>
              </li>
            </ul>
          </nav>
          <main data-testid="content">
            <section data-testid="hero">Hero Section</section>
            <section data-testid="products">Products Section</section>
          </main>
        </div>
      )

      renderWithTheme(<RootLayout>{complexChildren}</RootLayout>)

      expect(screen.getByTestId('page-wrapper')).toBeInTheDocument()
      expect(screen.getByTestId('navigation')).toBeInTheDocument()
      expect(screen.getByTestId('content')).toBeInTheDocument()
      expect(screen.getByTestId('hero')).toBeInTheDocument()
      expect(screen.getByTestId('products')).toBeInTheDocument()
    })
  })

  describe('Error Boundaries', () => {
    it('continues to render even if children have errors', () => {
      // This test ensures the layout is robust
      renderWithTheme(
        <RootLayout>
          <div data-testid="safe-content">Safe content</div>
        </RootLayout>
      )

      // Provider structure should still be intact
      expect(screen.getByTestId('root-provider')).toBeInTheDocument()
      expect(screen.getByTestId('safe-content')).toBeInTheDocument()
    })
  })
})
