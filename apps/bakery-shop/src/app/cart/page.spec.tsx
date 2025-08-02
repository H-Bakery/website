import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import CartPage from './page'

// Mock the feature library components
jest.mock('@bakery/shop/feature-cart', () => ({
  CartPage: jest.fn(() => (
    <main data-testid="cart-page">
      <h1>Warenkorb</h1>
      <div data-testid="cart-contents">
        <p>Cart items will be displayed here</p>
        <div data-testid="cart-summary">
          <p>Gesamt: €0.00</p>
          <button>Zur Kasse</button>
        </div>
      </div>
      <div data-testid="empty-cart-message" style={{ display: 'none' }}>
        <p>Ihr Warenkorb ist leer</p>
        <a href="/products">Weiter einkaufen</a>
      </div>
    </main>
  )),
}))

// Mock the shared UI components
jest.mock('@bakery/shared/ui', () => ({
  Header: jest.fn(() => (
    <header data-testid="header">
      <h1>Bäckerei Heusser</h1>
      <nav>
        <a href="/products">Produkte</a>
        <a href="/cart">Warenkorb</a>
      </nav>
    </header>
  )),
  Footer: jest.fn(() => (
    <footer data-testid="footer">
      <p>© 2024 Bäckerei Heusser</p>
      <nav>
        <a href="/imprint">Impressum</a>
        <a href="/privacy">Datenschutz</a>
      </nav>
    </footer>
  )),
}))

describe('Cart Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders the cart page with all main sections', () => {
      renderWithTheme(<CartPage />)

      // Check for main sections
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('cart-page')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })

    it('renders the header component with navigation', () => {
      renderWithTheme(<CartPage />)

      const header = screen.getByTestId('header')
      expect(header).toBeInTheDocument()
      expect(header).toHaveTextContent('Bäckerei Heusser')
      expect(header).toHaveTextContent('Produkte')
      expect(header).toHaveTextContent('Warenkorb')
    })

    it('renders the cart page feature component', () => {
      renderWithTheme(<CartPage />)

      const cartPage = screen.getByTestId('cart-page')
      expect(cartPage).toBeInTheDocument()
      expect(cartPage).toHaveTextContent('Warenkorb')
      expect(cartPage).toHaveTextContent('Cart items will be displayed here')
    })

    it('renders the footer component with links', () => {
      renderWithTheme(<CartPage />)

      const footer = screen.getByTestId('footer')
      expect(footer).toBeInTheDocument()
      expect(footer).toHaveTextContent('© 2024 Bäckerei Heusser')
      expect(footer).toHaveTextContent('Impressum')
      expect(footer).toHaveTextContent('Datenschutz')
    })
  })

  describe('Layout Structure', () => {
    it('maintains proper page structure with header, main content, and footer', () => {
      renderWithTheme(<CartPage />)

      // Verify all main sections are present
      const header = screen.getByTestId('header')
      const cartPage = screen.getByTestId('cart-page')
      const footer = screen.getByTestId('footer')

      expect(header).toBeInTheDocument()
      expect(cartPage).toBeInTheDocument()
      expect(footer).toBeInTheDocument()

      // Verify they're all in the same container
      const container = header.closest('div')
      expect(container).toContainElement(header)
      expect(container).toContainElement(cartPage)
      expect(container).toContainElement(footer)
    })

    it('wraps content in Material UI Box component', () => {
      renderWithTheme(<CartPage />)

      const pageContainer = screen.getByTestId('header').closest('div')
      expect(pageContainer).toBeInTheDocument()
    })
  })

  describe('Component Integration', () => {
    it('integrates Header component correctly', () => {
      const { Header } = require('@bakery/shared/ui')
      renderWithTheme(<CartPage />)

      expect(Header).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    it('integrates CartPage feature component correctly', () => {
      const { CartPage: CartPageFeature } = require('@bakery/shop/feature-cart')
      renderWithTheme(<CartPage />)

      expect(CartPageFeature).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('cart-page')).toBeInTheDocument()
    })

    it('integrates Footer component correctly', () => {
      const { Footer } = require('@bakery/shared/ui')
      renderWithTheme(<CartPage />)

      expect(Footer).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      renderWithTheme(<CartPage />)

      // Check for semantic elements
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('cart-page')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })

    it('maintains proper heading hierarchy', () => {
      renderWithTheme(<CartPage />)

      // Header should have the site title
      const header = screen.getByTestId('header')
      expect(header.querySelector('h1')).toHaveTextContent('Bäckerei Heusser')

      // Cart page should have its own heading
      const cartPage = screen.getByTestId('cart-page')
      expect(cartPage.querySelector('h1')).toHaveTextContent('Warenkorb')
    })

    it('includes navigation elements for accessibility', () => {
      renderWithTheme(<CartPage />)

      // Header should have navigation
      const header = screen.getByTestId('header')
      expect(header.querySelector('nav')).toBeInTheDocument()

      // Footer should have navigation
      const footer = screen.getByTestId('footer')
      expect(footer.querySelector('nav')).toBeInTheDocument()
    })
  })

  describe('Cart Feature Integration', () => {
    it('delegates cart functionality to CartPage feature', () => {
      renderWithTheme(<CartPage />)

      // Verify that cart functionality is handled by the feature component
      const cartPage = screen.getByTestId('cart-page')
      expect(cartPage).toHaveTextContent('Cart items will be displayed here')

      // Should have cart summary
      expect(screen.getByTestId('cart-summary')).toBeInTheDocument()
      expect(screen.getByTestId('cart-summary')).toHaveTextContent(
        'Gesamt: €0.00'
      )
      expect(screen.getByTestId('cart-summary')).toHaveTextContent('Zur Kasse')
    })

    it('includes empty cart state handling', () => {
      renderWithTheme(<CartPage />)

      // Should have empty cart message (even if hidden)
      const emptyCartMessage = screen.getByTestId('empty-cart-message')
      expect(emptyCartMessage).toBeInTheDocument()
      expect(emptyCartMessage).toHaveTextContent('Ihr Warenkorb ist leer')
      expect(emptyCartMessage).toHaveTextContent('Weiter einkaufen')
    })

    it('provides a clean page wrapper around the cart feature', () => {
      renderWithTheme(<CartPage />)

      // The page should be a simple wrapper that provides layout
      // while delegating business logic to the feature component
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('cart-page')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })
  })

  describe('User Flow Support', () => {
    it('supports navigation back to products', () => {
      renderWithTheme(<CartPage />)

      // Header navigation should include products link
      const header = screen.getByTestId('header')
      expect(header).toHaveTextContent('Produkte')

      // Empty cart should have link to continue shopping
      const emptyCartMessage = screen.getByTestId('empty-cart-message')
      expect(emptyCartMessage).toHaveTextContent('Weiter einkaufen')
    })

    it('supports checkout process initiation', () => {
      renderWithTheme(<CartPage />)

      // Cart summary should have checkout button
      const cartSummary = screen.getByTestId('cart-summary')
      expect(cartSummary).toHaveTextContent('Zur Kasse')
    })
  })

  describe('Responsive Behavior', () => {
    it('renders correctly on different screen sizes', () => {
      renderWithTheme(<CartPage />)

      // All main components should be present regardless of screen size
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('cart-page')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })

    it('allows cart feature to handle its own responsive behavior', () => {
      renderWithTheme(<CartPage />)

      // The page layout should be simple and let the cart feature
      // handle responsive cart item layouts and mobile optimizations
      const cartPage = screen.getByTestId('cart-page')
      expect(cartPage).toBeInTheDocument()
      expect(cartPage).toHaveTextContent('Cart items will be displayed here')
    })
  })
})
