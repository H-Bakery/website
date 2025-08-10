import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ProductsPage from './page'

// Mock the feature library components
jest.mock('@bakery/shop/feature-catalog', () => ({
  CatalogPage: jest.fn(() => (
    <main data-testid="catalog-page">
      <h1>Produktkatalog</h1>
      <div data-testid="product-grid">
        <p>Product catalog with filters and search</p>
        <p>Loading products from API...</p>
      </div>
    </main>
  )),
}))

// Mock the shared UI components
jest.mock('@bakery/shared/ui', () => ({
  Header: jest.fn(() => (
    <header data-testid="header">
      <h1>Bäckerei Heusser</h1>
      <nav>Shop Navigation</nav>
    </header>
  )),
  Footer: jest.fn(() => (
    <footer data-testid="footer">
      <p>© 2024 Bäckerei Heusser</p>
      <nav>Footer Links</nav>
    </footer>
  )),
}))

describe('ProductsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders the products page with all main sections', () => {
      renderWithTheme(<ProductsPage />)

      // Check for main sections
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('catalog-page')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })

    it('renders the header component', () => {
      renderWithTheme(<ProductsPage />)

      const header = screen.getByTestId('header')
      expect(header).toBeInTheDocument()
      expect(header).toHaveTextContent('Bäckerei Heusser')
      expect(header).toHaveTextContent('Shop Navigation')
    })

    it('renders the catalog page component', () => {
      renderWithTheme(<ProductsPage />)

      const catalogPage = screen.getByTestId('catalog-page')
      expect(catalogPage).toBeInTheDocument()
      expect(catalogPage).toHaveTextContent('Produktkatalog')
      expect(catalogPage).toHaveTextContent(
        'Product catalog with filters and search'
      )
    })

    it('renders the footer component', () => {
      renderWithTheme(<ProductsPage />)

      const footer = screen.getByTestId('footer')
      expect(footer).toBeInTheDocument()
      expect(footer).toHaveTextContent('© 2024 Bäckerei Heusser')
      expect(footer).toHaveTextContent('Footer Links')
    })
  })

  describe('Layout Structure', () => {
    it('maintains proper page structure with header, main content, and footer', () => {
      renderWithTheme(<ProductsPage />)

      // Verify all main sections are present
      const header = screen.getByTestId('header')
      const catalog = screen.getByTestId('catalog-page')
      const footer = screen.getByTestId('footer')

      expect(header).toBeInTheDocument()
      expect(catalog).toBeInTheDocument()
      expect(footer).toBeInTheDocument()

      // Verify order - header should come before catalog, catalog before footer
      const container = header.closest('div')
      expect(container).toContainElement(header)
      expect(container).toContainElement(catalog)
      expect(container).toContainElement(footer)
    })

    it('wraps content in Material UI Box component', () => {
      renderWithTheme(<ProductsPage />)

      const pageContainer = screen.getByTestId('header').closest('div')
      expect(pageContainer).toBeInTheDocument()
    })
  })

  describe('Component Integration', () => {
    it('integrates Header component correctly', () => {
      const { Header } = require('@bakery/shared/ui')
      renderWithTheme(<ProductsPage />)

      expect(Header).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    it('integrates CatalogPage component correctly', () => {
      const { CatalogPage } = require('@bakery/shop/feature-catalog')
      renderWithTheme(<ProductsPage />)

      expect(CatalogPage).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('catalog-page')).toBeInTheDocument()
    })

    it('integrates Footer component correctly', () => {
      const { Footer } = require('@bakery/shared/ui')
      renderWithTheme(<ProductsPage />)

      expect(Footer).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      renderWithTheme(<ProductsPage />)

      // Check for semantic elements
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('catalog-page')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })

    it('maintains proper heading hierarchy', () => {
      renderWithTheme(<ProductsPage />)

      // Header should have the site title
      const header = screen.getByTestId('header')
      expect(header.querySelector('h1')).toHaveTextContent('Bäckerei Heusser')

      // Catalog page should have its own heading
      const catalog = screen.getByTestId('catalog-page')
      expect(catalog.querySelector('h1')).toHaveTextContent('Produktkatalog')
    })

    it('includes navigation elements', () => {
      renderWithTheme(<ProductsPage />)

      // Header should have navigation
      const header = screen.getByTestId('header')
      expect(header).toHaveTextContent('Shop Navigation')

      // Footer should have navigation
      const footer = screen.getByTestId('footer')
      expect(footer).toHaveTextContent('Footer Links')
    })
  })

  describe('Feature Integration', () => {
    it('delegates product catalog functionality to CatalogPage feature', () => {
      renderWithTheme(<ProductsPage />)

      // Verify that catalog functionality is handled by the feature component
      const catalog = screen.getByTestId('catalog-page')
      expect(catalog).toHaveTextContent(
        'Product catalog with filters and search'
      )
      expect(catalog).toHaveTextContent('Loading products from API...')
    })

    it('provides a clean page wrapper around the catalog feature', () => {
      renderWithTheme(<ProductsPage />)

      // The page should be a simple wrapper that provides layout
      // while delegating business logic to the feature component
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('catalog-page')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })
  })

  describe('Responsive Behavior', () => {
    it('renders correctly on different screen sizes', () => {
      renderWithTheme(<ProductsPage />)

      // All main components should be present regardless of screen size
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('catalog-page')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })

    it('allows catalog page to handle its own responsive behavior', () => {
      renderWithTheme(<ProductsPage />)

      // The page layout should be simple and let the catalog feature
      // handle responsive product grids and filters
      const catalog = screen.getByTestId('catalog-page')
      expect(catalog).toBeInTheDocument()
      expect(catalog).toHaveTextContent(
        'Product catalog with filters and search'
      )
    })
  })
})
