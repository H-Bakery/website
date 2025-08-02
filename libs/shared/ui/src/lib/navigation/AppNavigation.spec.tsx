import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { AppNavigation } from './AppNavigation'

// Mock Next.js Link
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

// Mock Material UI useMediaQuery
jest.mock('@mui/material/useMediaQuery')
const mockUseMediaQuery = useMediaQuery as jest.MockedFunction<
  typeof useMediaQuery
>

// Mock navigation utility
jest.mock('@bakery/shared/utils', () => ({
  getNavigationForApp: jest.fn((app: string) => {
    const navigationMap = {
      landing: [
        { label: 'Home', href: '/', external: false },
        { label: 'About', href: '/about', external: false },
        { label: 'Contact', href: '/contact', external: false },
      ],
      shop: [
        { label: 'Products', href: '/products', external: false },
        { label: 'Cart', href: '/cart', external: false },
        { label: 'Account', href: '/account', external: false },
      ],
      management: [
        { label: 'Orders', href: '/admin/orders', external: false },
        { label: 'Inventory', href: '/admin/inventory', external: false },
        { label: 'Production', href: '/admin/production', external: false },
      ],
    }
    return navigationMap[app as keyof typeof navigationMap] || []
  }),
}))

// Test theme
const theme = createTheme()

// Render helper with theme
function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

describe('AppNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default to desktop view
    mockUseMediaQuery.mockReturnValue(false)
  })

  describe('Landing App Configuration', () => {
    it('should render landing app with correct title and icon', () => {
      renderWithTheme(<AppNavigation app="landing" />)

      expect(screen.getByText('Bäckerei Heusser')).toBeInTheDocument()
      expect(screen.getByTestId('HomeIcon')).toBeInTheDocument()
    })

    it('should render landing navigation items', () => {
      renderWithTheme(<AppNavigation app="landing" />)

      expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
        'href',
        '/'
      )
      expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute(
        'href',
        '/about'
      )
      expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute(
        'href',
        '/contact'
      )
    })

    it('should use custom title when provided', () => {
      renderWithTheme(<AppNavigation app="landing" title="Custom Landing" />)

      expect(screen.getByText('Custom Landing')).toBeInTheDocument()
      expect(screen.queryByText('Bäckerei Heusser')).not.toBeInTheDocument()
    })
  })

  describe('Shop App Configuration', () => {
    it('should render shop app with correct title and icon', () => {
      renderWithTheme(<AppNavigation app="shop" />)

      expect(screen.getByText('Online Shop')).toBeInTheDocument()
      expect(screen.getByTestId('StoreIcon')).toBeInTheDocument()
    })

    it('should render shop navigation items', () => {
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
  })

  describe('Management App Configuration', () => {
    it('should render management app with correct title and icon', () => {
      renderWithTheme(<AppNavigation app="management" />)

      expect(screen.getByText('Verwaltung')).toBeInTheDocument()
      expect(screen.getByTestId('BusinessIcon')).toBeInTheDocument()
    })

    it('should render management navigation items', () => {
      renderWithTheme(<AppNavigation app="management" />)

      expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute(
        'href',
        '/admin/orders'
      )
      expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute(
        'href',
        '/admin/inventory'
      )
      expect(screen.getByRole('link', { name: 'Production' })).toHaveAttribute(
        'href',
        '/admin/production'
      )
    })
  })

  describe('Custom Navigation', () => {
    it('should render custom navigation items when provided', () => {
      const customNavigation = [
        { label: 'Custom Page', href: '/custom', external: false },
        {
          label: 'External Link',
          href: 'https://external.com',
          external: true,
        },
      ]

      renderWithTheme(
        <AppNavigation app="landing" customNavigation={customNavigation} />
      )

      expect(screen.getByRole('link', { name: 'Custom Page' })).toHaveAttribute(
        'href',
        '/custom'
      )

      const externalLink = screen.getByRole('link', { name: 'External Link' })
      expect(externalLink).toHaveAttribute('href', 'https://external.com')
      expect(externalLink).toHaveAttribute('target', '_blank')
      expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('should override default navigation with custom navigation', () => {
      const customNavigation = [
        { label: 'Only Custom', href: '/only-custom', external: false },
      ]

      renderWithTheme(
        <AppNavigation app="landing" customNavigation={customNavigation} />
      )

      expect(
        screen.getByRole('link', { name: 'Only Custom' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Home' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'About' })
      ).not.toBeInTheDocument()
    })
  })

  describe('Mobile Responsiveness', () => {
    beforeEach(() => {
      // Mock mobile view
      mockUseMediaQuery.mockReturnValue(true)
    })

    it('should hide desktop navigation on mobile', () => {
      renderWithTheme(<AppNavigation app="landing" />)

      // Navigation links should not be visible directly (they're in mobile menu)
      const navButtons = screen.queryAllByRole('link')
      const visibleNavButtons = navButtons.filter(
        (button) => !button.closest('[role="menu"]')
      )
      expect(visibleNavButtons).toHaveLength(0)
    })

    it('should show mobile menu button on mobile', () => {
      renderWithTheme(<AppNavigation app="landing" />)

      const menuButton = screen.getByRole('button', { name: /menu/i })
      expect(menuButton).toBeInTheDocument()
      expect(screen.getByTestId('MenuIcon')).toBeInTheDocument()
    })

    it('should open mobile menu when menu button is clicked', async () => {
      renderWithTheme(<AppNavigation app="landing" />)

      const menuButton = screen.getByRole('button', { name: /menu/i })
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      // Check that navigation items are in the mobile menu
      const menu = screen.getByRole('menu')
      expect(menu).toContainElement(
        screen.getByRole('menuitem', { name: 'Home' })
      )
      expect(menu).toContainElement(
        screen.getByRole('menuitem', { name: 'About' })
      )
      expect(menu).toContainElement(
        screen.getByRole('menuitem', { name: 'Contact' })
      )
    })

    it('should close mobile menu when menu item is clicked', async () => {
      renderWithTheme(<AppNavigation app="landing" />)

      // Open menu
      const menuButton = screen.getByRole('button', { name: /menu/i })
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      // Click a menu item
      const homeMenuItem = screen.getByRole('menuitem', { name: 'Home' })
      fireEvent.click(homeMenuItem)

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      })
    })

    it('should not show mobile menu button when showMobileMenu is false', () => {
      renderWithTheme(<AppNavigation app="landing" showMobileMenu={false} />)

      expect(
        screen.queryByRole('button', { name: /menu/i })
      ).not.toBeInTheDocument()
    })
  })

  describe('Navigation Variants', () => {
    it('should render default variant with navigation items', () => {
      renderWithTheme(<AppNavigation app="landing" variant="default" />)

      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument()
    })

    it('should render minimal variant without navigation items', () => {
      renderWithTheme(<AppNavigation app="landing" variant="minimal" />)

      expect(screen.getByText('Bäckerei Heusser')).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Home' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'About' })
      ).not.toBeInTheDocument()
    })

    it('should not show mobile menu in minimal variant', () => {
      mockUseMediaQuery.mockReturnValue(true) // Mobile view
      renderWithTheme(<AppNavigation app="landing" variant="minimal" />)

      expect(
        screen.queryByRole('button', { name: /menu/i })
      ).not.toBeInTheDocument()
    })

    it('should render mobile-friendly variant correctly on mobile', () => {
      mockUseMediaQuery.mockReturnValue(true) // Mobile view
      renderWithTheme(<AppNavigation app="landing" variant="mobile-friendly" />)

      expect(screen.getByText('Bäckerei Heusser')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
    })

    it('should render normally on desktop even with mobile-friendly variant', () => {
      mockUseMediaQuery.mockReturnValue(false) // Desktop view
      renderWithTheme(<AppNavigation app="landing" variant="mobile-friendly" />)

      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument()
    })
  })

  describe('Additional Content', () => {
    it('should render children content in toolbar', () => {
      renderWithTheme(
        <AppNavigation app="landing">
          <div data-testid="custom-content">Custom Content</div>
        </AppNavigation>
      )

      expect(screen.getByTestId('custom-content')).toBeInTheDocument()
      expect(screen.getByText('Custom Content')).toBeInTheDocument()
    })

    it('should position children correctly in desktop layout', () => {
      renderWithTheme(
        <AppNavigation app="landing">
          <button>Action Button</button>
        </AppNavigation>
      )

      const actionButton = screen.getByRole('button', { name: 'Action Button' })
      expect(actionButton).toBeInTheDocument()
    })

    it('should position children correctly in mobile layout', () => {
      mockUseMediaQuery.mockReturnValue(true) // Mobile view
      renderWithTheme(
        <AppNavigation app="landing">
          <button>Mobile Action</button>
        </AppNavigation>
      )

      const actionButton = screen.getByRole('button', { name: 'Mobile Action' })
      expect(actionButton).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for mobile menu', async () => {
      mockUseMediaQuery.mockReturnValue(true) // Mobile view
      renderWithTheme(<AppNavigation app="landing" />)

      const menuButton = screen.getByRole('button', { name: /menu/i })
      fireEvent.click(menuButton)

      await waitFor(() => {
        const menu = screen.getByRole('menu')
        expect(menu).toBeInTheDocument()

        const menuItems = screen.getAllByRole('menuitem')
        expect(menuItems).toHaveLength(3) // Home, About, Contact
      })
    })

    it('should have proper link attributes for external links', () => {
      const customNavigation = [
        { label: 'External', href: 'https://external.com', external: true },
      ]

      renderWithTheme(
        <AppNavigation app="landing" customNavigation={customNavigation} />
      )

      const externalLink = screen.getByRole('link', { name: 'External' })
      expect(externalLink).toHaveAttribute('target', '_blank')
      expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('should not have target/rel attributes for internal links', () => {
      renderWithTheme(<AppNavigation app="landing" />)

      const internalLink = screen.getByRole('link', { name: 'Home' })
      expect(internalLink).not.toHaveAttribute('target')
      expect(internalLink).not.toHaveAttribute('rel')
    })
  })

  describe('Theme Integration', () => {
    it('should apply correct color scheme for each app', () => {
      const { rerender } = renderWithTheme(<AppNavigation app="landing" />)

      // Landing uses primary color
      let appBar = screen.getByRole('banner')
      expect(appBar).toHaveClass('MuiAppBar-colorPrimary')

      // Shop uses secondary color
      rerender(
        <ThemeProvider theme={theme}>
          <AppNavigation app="shop" />
        </ThemeProvider>
      )
      appBar = screen.getByRole('banner')
      expect(appBar).toHaveClass('MuiAppBar-colorSecondary')

      // Management uses primary color
      rerender(
        <ThemeProvider theme={theme}>
          <AppNavigation app="management" />
        </ThemeProvider>
      )
      appBar = screen.getByRole('banner')
      expect(appBar).toHaveClass('MuiAppBar-colorPrimary')
    })
  })

  describe('Navigation Styling', () => {
    it('should apply correct styling to navigation buttons', () => {
      renderWithTheme(<AppNavigation app="landing" />)

      const homeLink = screen.getByRole('link', { name: 'Home' })
      expect(homeLink).toHaveStyle({
        textTransform: 'none',
      })
    })

    it('should show icons with correct styling', () => {
      renderWithTheme(<AppNavigation app="landing" />)

      const homeIcon = screen.getByTestId('HomeIcon')
      expect(homeIcon).toBeInTheDocument()
    })
  })
})
