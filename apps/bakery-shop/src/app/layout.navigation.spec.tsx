import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { AppNavigation, Breadcrumbs } from '@bakery/shared/ui'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/products',
    asPath: '/products',
  }),
  usePathname: () => '/products',
}))

// Mock Material UI useMediaQuery
jest.mock('@mui/material/useMediaQuery')
const mockUseMediaQuery = useMediaQuery as jest.MockedFunction<
  typeof useMediaQuery
>

// Test theme
const theme = createTheme()

// Render helper with theme
function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

describe('Shop App Navigation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseMediaQuery.mockReturnValue(false) // Default to desktop
  })

  describe('AppNavigation in Shop Context', () => {
    it('should render shop navigation with correct branding', () => {
      renderWithTheme(<AppNavigation app="shop" />)

      expect(screen.getByText('Online Shop')).toBeInTheDocument()
      expect(screen.getByTestId('StoreIcon')).toBeInTheDocument()
    })

    it('should render shop-specific navigation items', () => {
      renderWithTheme(<AppNavigation app="shop" />)

      expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
        'href',
        '/products'
      )
      expect(screen.getByRole('link', { name: 'Cart' })).toHaveAttribute(
        'href',
        '/cart'
      )
      expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute(
        'href',
        '/account'
      )
    })

    it('should use secondary color scheme for shop app', () => {
      renderWithTheme(<AppNavigation app="shop" />)

      const appBar = screen.getByRole('banner')
      expect(appBar).toHaveClass('MuiAppBar-colorSecondary')
    })

    it('should work with mobile responsive behavior', () => {
      mockUseMediaQuery.mockReturnValue(true) // Mobile view
      renderWithTheme(<AppNavigation app="shop" />)

      // Should show mobile menu button
      expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()

      // Navigation links should not be directly visible
      const navButtons = screen
        .queryAllByRole('link')
        .filter((button) => !button.closest('[role="menu"]'))
      expect(navButtons).toHaveLength(0)
    })

    it('should handle mobile menu interactions', async () => {
      mockUseMediaQuery.mockReturnValue(true) // Mobile view
      renderWithTheme(<AppNavigation app="shop" />)

      const menuButton = screen.getByRole('button', { name: /menu/i })
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      // Check navigation items in mobile menu
      const menu = screen.getByRole('menu')
      expect(menu).toContainElement(
        screen.getByRole('menuitem', { name: 'Products' })
      )
      expect(menu).toContainElement(
        screen.getByRole('menuitem', { name: 'Cart' })
      )
      expect(menu).toContainElement(
        screen.getByRole('menuitem', { name: 'Account' })
      )
    })
  })

  describe('Breadcrumbs in Shop Context', () => {
    it('should render breadcrumbs for shop product page', () => {
      renderWithTheme(<Breadcrumbs pathname="/products/bread" app="shop" />)

      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
        'href',
        '/'
      )
      expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
        'href',
        '/products'
      )
      expect(screen.getByText('Bread')).toBeInTheDocument()
    })

    it('should not render breadcrumbs for simple paths', () => {
      const { container } = renderWithTheme(
        <Breadcrumbs pathname="/" app="shop" />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should show home icon in breadcrumbs', () => {
      renderWithTheme(<Breadcrumbs pathname="/products" app="shop" />)

      expect(screen.getByTestId('HomeIcon')).toBeInTheDocument()
    })

    it('should work with container styling', () => {
      renderWithTheme(
        <Breadcrumbs pathname="/products" app="shop" showContainer={true} />
      )

      const navigation = screen.getByRole('navigation')
      expect(navigation).toBeInTheDocument()
    })
  })

  describe('Navigation Components Integration', () => {
    it('should work together in a complete shop layout', () => {
      const ShopLayout = () => (
        <div>
          <AppNavigation app="shop">
            <button>Cart (2)</button>
          </AppNavigation>
          <Breadcrumbs
            pathname="/products/bread"
            app="shop"
            showContainer={true}
          />
          <main>
            <h1>Product Page</h1>
          </main>
        </div>
      )

      renderWithTheme(<ShopLayout />)

      // Navigation should be present
      expect(screen.getByText('Online Shop')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Products' })).toBeInTheDocument()

      // Custom content should be rendered
      expect(
        screen.getByRole('button', { name: 'Cart (2)' })
      ).toBeInTheDocument()

      // Breadcrumbs should be present
      expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
        'href',
        '/products'
      )
      expect(screen.getByText('Bread')).toBeInTheDocument()

      // Main content should be present
      expect(
        screen.getByRole('heading', { name: 'Product Page' })
      ).toBeInTheDocument()
    })

    it('should maintain consistent theme across navigation components', () => {
      const ShopLayout = () => (
        <div>
          <AppNavigation app="shop" />
          <Breadcrumbs pathname="/products" app="shop" />
        </div>
      )

      renderWithTheme(<ShopLayout />)

      // Both components should be rendered without theme conflicts
      expect(screen.getByRole('banner')).toBeInTheDocument() // AppBar
      expect(screen.getByRole('navigation')).toBeInTheDocument() // Breadcrumbs
    })
  })

  describe('Accessibility Integration', () => {
    it('should provide proper navigation landmarks', () => {
      const ShopLayout = () => (
        <div>
          <AppNavigation app="shop" />
          <Breadcrumbs pathname="/products" app="shop" />
        </div>
      )

      renderWithTheme(<ShopLayout />)

      // Should have banner for main navigation
      expect(screen.getByRole('banner')).toBeInTheDocument()

      // Should have navigation for breadcrumbs
      expect(screen.getByRole('navigation')).toBeInTheDocument()

      // Breadcrumbs should have proper aria-label
      expect(screen.getByLabelText('breadcrumb')).toBeInTheDocument()
    })

    it('should handle keyboard navigation properly', () => {
      renderWithTheme(<AppNavigation app="shop" />)

      const productsLink = screen.getByRole('link', { name: 'Products' })

      // Should be focusable
      productsLink.focus()
      expect(document.activeElement).toBe(productsLink)
    })
  })
})
