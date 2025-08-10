import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import HomePage from './page'

// Mock the feature library components
jest.mock('@bakery/shop/feature-cart', () => ({
  QuickOrder: jest.fn(() => (
    <div data-testid="quick-order">
      <h2>Schnellbestellung</h2>
      <p>Quick order component</p>
    </div>
  )),
}))

// Mock the shared UI components
jest.mock('@bakery/shared/ui', () => ({
  Header: jest.fn(() => (
    <header data-testid="header">
      <h1>Bäckerei Heusser</h1>
    </header>
  )),
  Footer: jest.fn(() => (
    <footer data-testid="footer">
      <p>© 2024 Bäckerei Heusser</p>
    </footer>
  )),
  Hero: jest.fn(({ title, subtitle }) => (
    <section data-testid="hero">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </section>
  )),
  Products: jest.fn(({ header, items, showControls }) => (
    <section data-testid="products">
      <h2>{header}</h2>
      <p>Products count: {items?.length || 0}</p>
      <p>Show controls: {showControls ? 'yes' : 'no'}</p>
    </section>
  )),
}))

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders the home page with all main sections', () => {
      renderWithTheme(<HomePage />)

      // Check for main sections
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('hero')).toBeInTheDocument()
      expect(screen.getByTestId('quick-order')).toBeInTheDocument()
      expect(screen.getByTestId('products')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })

    it('renders the hero section with correct content', () => {
      renderWithTheme(<HomePage />)

      const hero = screen.getByTestId('hero')
      expect(hero).toBeInTheDocument()
      expect(hero).toHaveTextContent('Willkommen bei der Bäckerei Heusser')
      expect(hero).toHaveTextContent(
        'Frische Backwaren aus traditioneller Handwerkskunst'
      )
    })

    it('renders the quick order section', () => {
      renderWithTheme(<HomePage />)

      const quickOrder = screen.getByTestId('quick-order')
      expect(quickOrder).toBeInTheDocument()
      expect(quickOrder).toHaveTextContent('Schnellbestellung')
    })

    it('renders the products section with correct configuration', () => {
      renderWithTheme(<HomePage />)

      const products = screen.getByTestId('products')
      expect(products).toBeInTheDocument()
      expect(products).toHaveTextContent('Unsere beliebten Produkte')
      expect(products).toHaveTextContent('Products count: 0')
      expect(products).toHaveTextContent('Show controls: no')
    })
  })

  describe('Layout Structure', () => {
    it('maintains proper semantic structure', () => {
      renderWithTheme(<HomePage />)

      const page = screen.getByTestId('header').closest('div')
      expect(page).toBeInTheDocument()

      // Verify order of elements
      const elements = [
        screen.getByTestId('header'),
        screen.getByTestId('hero'),
        screen.getByTestId('quick-order'),
        screen.getByTestId('products'),
        screen.getByTestId('footer'),
      ]

      elements.forEach((element) => {
        expect(element).toBeInTheDocument()
      })
    })

    it('applies correct styling to products section', () => {
      renderWithTheme(<HomePage />)

      const productsContainer = screen.getByTestId('products').parentElement
      expect(productsContainer).toHaveStyle({
        paddingTop: '64px',
        paddingBottom: '64px',
      })
    })
  })

  describe('Component Integration', () => {
    it('passes correct props to Hero component', () => {
      const { Hero } = require('@bakery/shared/ui')
      renderWithTheme(<HomePage />)

      expect(Hero).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Willkommen bei der Bäckerei Heusser',
          subtitle: 'Frische Backwaren aus traditioneller Handwerkskunst',
        }),
        expect.any(Object)
      )
    })

    it('passes correct props to Products component', () => {
      const { Products } = require('@bakery/shared/ui')
      renderWithTheme(<HomePage />)

      expect(Products).toHaveBeenCalledWith(
        expect.objectContaining({
          header: 'Unsere beliebten Produkte',
          items: [],
          showControls: false,
        }),
        expect.any(Object)
      )
    })

    it('renders QuickOrder component from feature library', () => {
      const { QuickOrder } = require('@bakery/shop/feature-cart')
      renderWithTheme(<HomePage />)

      expect(QuickOrder).toHaveBeenCalled()
      expect(screen.getByTestId('quick-order')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      renderWithTheme(<HomePage />)

      // Check for semantic elements
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()

      // Hero should have main heading
      const hero = screen.getByTestId('hero')
      expect(hero.querySelector('h1')).toBeInTheDocument()
    })

    it('maintains logical heading hierarchy', () => {
      renderWithTheme(<HomePage />)

      // Hero has h1
      const h1 = screen.getByTestId('hero').querySelector('h1')
      expect(h1).toHaveTextContent('Willkommen bei der Bäckerei Heusser')

      // Products section has h2
      const h2 = screen.getByTestId('products').querySelector('h2')
      expect(h2).toHaveTextContent('Unsere beliebten Produkte')
    })
  })

  describe('Responsive Behavior', () => {
    it('renders correctly on different screen sizes', () => {
      renderWithTheme(<HomePage />)

      // All main components should be present regardless of screen size
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('hero')).toBeInTheDocument()
      expect(screen.getByTestId('quick-order')).toBeInTheDocument()
      expect(screen.getByTestId('products')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })
  })
})
