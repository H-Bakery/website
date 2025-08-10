import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { AppNavigation, Breadcrumbs } from '@bakery/shared/ui'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/admin/orders',
    asPath: '/admin/orders',
  }),
  usePathname: () => '/admin/orders',
}))

// Mock Material UI useMediaQuery
jest.mock('@mui/material/useMediaQuery')
const mockUseMediaQuery = useMediaQuery as jest.MockedFunction<
  typeof useMediaQuery
>

// Test theme with dark mode support
const theme = createTheme({
  palette: {
    mode: 'dark',
  },
})

// Render helper with theme
function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

describe('Management App Navigation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseMediaQuery.mockReturnValue(false) // Default to desktop
  })

  describe('AppNavigation in Management Context', () => {
    it('should render management navigation with correct branding', () => {
      renderWithTheme(<AppNavigation app="management" />)

      expect(screen.getByText('Verwaltung')).toBeInTheDocument()
      expect(screen.getByTestId('BusinessIcon')).toBeInTheDocument()
    })

    it('should render management-specific navigation items', () => {
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

    it('should use primary color scheme for management app', () => {
      renderWithTheme(<AppNavigation app="management" />)

      const appBar = screen.getByRole('banner')
      expect(appBar).toHaveClass('MuiAppBar-colorPrimary')
    })

    it('should support custom title override', () => {
      renderWithTheme(
        <AppNavigation app="management" title="Admin Dashboard" />
      )

      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
      expect(screen.queryByText('Verwaltung')).not.toBeInTheDocument()
    })

    it('should handle mobile responsive behavior', () => {
      mockUseMediaQuery.mockReturnValue(true) // Mobile view
      renderWithTheme(<AppNavigation app="management" />)

      // Should show mobile menu button
      expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()

      // Navigation links should be hidden on mobile
      const navButtons = screen
        .queryAllByRole('link')
        .filter((button) => !button.closest('[role="menu"]'))
      expect(navButtons).toHaveLength(0)
    })

    it('should handle mobile menu for admin interface', async () => {
      mockUseMediaQuery.mockReturnValue(true) // Mobile view
      renderWithTheme(<AppNavigation app="management" />)

      const menuButton = screen.getByRole('button', { name: /menu/i })
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      // Check admin navigation items in mobile menu
      const menu = screen.getByRole('menu')
      expect(menu).toContainElement(
        screen.getByRole('menuitem', { name: 'Orders' })
      )
      expect(menu).toContainElement(
        screen.getByRole('menuitem', { name: 'Inventory' })
      )
      expect(menu).toContainElement(
        screen.getByRole('menuitem', { name: 'Production' })
      )
    })

    it('should work with minimal variant for focused admin views', () => {
      renderWithTheme(<AppNavigation app="management" variant="minimal" />)

      // Should show title but no navigation items
      expect(screen.getByText('Verwaltung')).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Orders' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Inventory' })
      ).not.toBeInTheDocument()
    })
  })

  describe('Breadcrumbs in Management Context', () => {
    it('should render breadcrumbs for admin order detail page', () => {
      renderWithTheme(
        <Breadcrumbs pathname="/admin/orders/123" app="management" />
      )

      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'href',
        '/admin'
      )
      expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute(
        'href',
        '/admin/orders'
      )
      expect(screen.getByText('Order #123')).toBeInTheDocument()
    })

    it('should render breadcrumbs for inventory management', () => {
      renderWithTheme(
        <Breadcrumbs pathname="/admin/inventory/products" app="management" />
      )

      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'href',
        '/admin'
      )
      expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute(
        'href',
        '/admin/inventory'
      )
      expect(screen.getByText('Products')).toBeInTheDocument()
    })

    it('should not render breadcrumbs for top-level admin page', () => {
      const { container } = renderWithTheme(
        <Breadcrumbs pathname="/admin" app="management" />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should show home icon in admin breadcrumbs', () => {
      renderWithTheme(<Breadcrumbs pathname="/admin/orders" app="management" />)

      expect(screen.getByTestId('HomeIcon')).toBeInTheDocument()
    })

    it('should support custom breadcrumbs for complex admin workflows', () => {
      const customBreadcrumbs = [
        { label: 'Dashboard', href: '/admin', current: false },
        { label: 'Reports', href: '/admin/reports', current: false },
        { label: 'Sales Report', href: '/admin/reports/sales', current: true },
      ]

      renderWithTheme(
        <Breadcrumbs
          pathname="/admin/reports/sales"
          app="management"
          customBreadcrumbs={customBreadcrumbs}
        />
      )

      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'href',
        '/admin'
      )
      expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute(
        'href',
        '/admin/reports'
      )
      expect(screen.getByText('Sales Report')).toBeInTheDocument()
    })
  })

  describe('Admin Layout Integration', () => {
    it('should work together in a complete admin layout', () => {
      const AdminLayout = () => (
        <div>
          <AppNavigation app="management">
            <button>Notifications (3)</button>
            <button>User Menu</button>
          </AppNavigation>
          <Breadcrumbs
            pathname="/admin/orders/123"
            app="management"
            showContainer={true}
          />
          <main>
            <h1>Order #123 Details</h1>
            <p>Order management interface</p>
          </main>
        </div>
      )

      renderWithTheme(<AdminLayout />)

      // Navigation should be present
      expect(screen.getByText('Verwaltung')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Orders' })).toBeInTheDocument()

      // Custom admin controls should be rendered
      expect(
        screen.getByRole('button', { name: 'Notifications (3)' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'User Menu' })
      ).toBeInTheDocument()

      // Breadcrumbs should be present
      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'href',
        '/admin'
      )
      expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute(
        'href',
        '/admin/orders'
      )
      expect(screen.getByText('Order #123')).toBeInTheDocument()

      // Main admin content should be present
      expect(
        screen.getByRole('heading', { name: 'Order #123 Details' })
      ).toBeInTheDocument()
      expect(screen.getByText('Order management interface')).toBeInTheDocument()
    })

    it('should support dark theme integration', () => {
      const AdminLayout = () => (
        <div>
          <AppNavigation app="management" />
          <Breadcrumbs pathname="/admin/orders" app="management" />
        </div>
      )

      renderWithTheme(<AdminLayout />)

      // Both components should render with dark theme
      expect(screen.getByRole('banner')).toBeInTheDocument() // AppBar
      expect(screen.getByRole('navigation')).toBeInTheDocument() // Breadcrumbs
    })

    it('should handle admin workflow navigation', () => {
      const WorkflowLayout = () => (
        <div>
          <AppNavigation app="management" variant="minimal" />
          <Breadcrumbs
            pathname="/admin/orders/123/edit"
            app="management"
            maxItems={4}
            showContainer={true}
          />
          <main>
            <h1>Edit Order</h1>
          </main>
        </div>
      )

      renderWithTheme(<WorkflowLayout />)

      // Minimal navigation should show only title
      expect(screen.getByText('Verwaltung')).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Orders' })
      ).not.toBeInTheDocument()

      // Breadcrumbs should provide context
      expect(screen.getByRole('navigation')).toBeInTheDocument()

      // Main content should be present
      expect(
        screen.getByRole('heading', { name: 'Edit Order' })
      ).toBeInTheDocument()
    })
  })

  describe('Accessibility in Admin Context', () => {
    it('should provide proper admin navigation landmarks', () => {
      const AdminLayout = () => (
        <div>
          <AppNavigation app="management" />
          <Breadcrumbs pathname="/admin/orders" app="management" />
          <main>Admin Content</main>
        </div>
      )

      renderWithTheme(<AdminLayout />)

      // Should have banner for main navigation
      expect(screen.getByRole('banner')).toBeInTheDocument()

      // Should have navigation for breadcrumbs
      expect(screen.getByRole('navigation')).toBeInTheDocument()

      // Should have main content area
      expect(screen.getByRole('main')).toBeInTheDocument()

      // Breadcrumbs should have proper aria-label
      expect(screen.getByLabelText('breadcrumb')).toBeInTheDocument()
    })

    it('should support keyboard navigation in admin interface', () => {
      renderWithTheme(<AppNavigation app="management" />)

      const ordersLink = screen.getByRole('link', { name: 'Orders' })
      const inventoryLink = screen.getByRole('link', { name: 'Inventory' })

      // Should be focusable
      ordersLink.focus()
      expect(document.activeElement).toBe(ordersLink)

      // Should support tab navigation
      inventoryLink.focus()
      expect(document.activeElement).toBe(inventoryLink)
    })
  })
})
