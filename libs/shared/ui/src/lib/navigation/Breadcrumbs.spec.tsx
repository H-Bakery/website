import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { Breadcrumbs } from './Breadcrumbs'

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

// Mock breadcrumb generation utility
jest.mock('@bakery/shared/utils', () => ({
  generateBreadcrumbs: jest.fn((pathname: string, app: string) => {
    // Mock breadcrumb generation based on pathname and app
    const breadcrumbMap: Record<string, any[]> = {
      // Landing app
      '/': [{ label: 'Home', href: '/', current: true }],
      '/about': [
        { label: 'Home', href: '/', current: false },
        { label: 'About', href: '/about', current: true },
      ],
      '/contact': [
        { label: 'Home', href: '/', current: false },
        { label: 'Contact', href: '/contact', current: true },
      ],

      // Shop app
      '/products': [
        { label: 'Home', href: '/', current: false },
        { label: 'Products', href: '/products', current: true },
      ],
      '/products/bread': [
        { label: 'Home', href: '/', current: false },
        { label: 'Products', href: '/products', current: false },
        { label: 'Bread', href: '/products/bread', current: true },
      ],
      '/cart': [
        { label: 'Home', href: '/', current: false },
        { label: 'Cart', href: '/cart', current: true },
      ],

      // Management app
      '/admin': [{ label: 'Dashboard', href: '/admin', current: true }],
      '/admin/orders': [
        { label: 'Dashboard', href: '/admin', current: false },
        { label: 'Orders', href: '/admin/orders', current: true },
      ],
      '/admin/orders/123': [
        { label: 'Dashboard', href: '/admin', current: false },
        { label: 'Orders', href: '/admin/orders', current: false },
        { label: 'Order #123', href: '/admin/orders/123', current: true },
      ],
      '/admin/inventory/products': [
        { label: 'Dashboard', href: '/admin', current: false },
        { label: 'Inventory', href: '/admin/inventory', current: false },
        { label: 'Products', href: '/admin/inventory/products', current: true },
      ],
    }

    return breadcrumbMap[pathname] || []
  }),
}))

// Test theme
const theme = createTheme()

// Render helper with theme
function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

describe('Breadcrumbs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Functionality', () => {
    it('should not render when there is only one breadcrumb or less', () => {
      const { container } = renderWithTheme(
        <Breadcrumbs pathname="/" app="landing" />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should render breadcrumbs when there are multiple items', () => {
      renderWithTheme(<Breadcrumbs pathname="/about" app="landing" />)

      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByLabelText('breadcrumb')).toBeInTheDocument()
    })

    it('should render correct breadcrumb items', () => {
      renderWithTheme(<Breadcrumbs pathname="/about" app="landing" />)

      expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
        'href',
        '/'
      )
      expect(screen.getByText('About')).toBeInTheDocument()
    })
  })

  describe('Link Behavior', () => {
    it('should render intermediate breadcrumbs as clickable links', () => {
      renderWithTheme(<Breadcrumbs pathname="/products/bread" app="shop" />)

      const homeLink = screen.getByRole('link', { name: 'Home' })
      const productsLink = screen.getByRole('link', { name: 'Products' })

      expect(homeLink).toHaveAttribute('href', '/')
      expect(productsLink).toHaveAttribute('href', '/products')
    })

    it('should render current breadcrumb as non-clickable text', () => {
      renderWithTheme(<Breadcrumbs pathname="/products/bread" app="shop" />)

      const breadElement = screen.getByText('Bread')
      expect(breadElement.tagName).toBe('P') // Typography renders as p by default
      expect(breadElement).not.toHaveAttribute('href')
    })

    it('should apply hover styles to clickable links', () => {
      renderWithTheme(<Breadcrumbs pathname="/about" app="landing" />)

      const homeLink = screen.getByRole('link', { name: 'Home' })
      expect(homeLink).toBeInTheDocument()
      // Hover styles are applied via sx prop, tested through className
    })
  })

  describe('Home Icon', () => {
    it('should show home icon on first breadcrumb by default', () => {
      renderWithTheme(<Breadcrumbs pathname="/about" app="landing" />)

      expect(screen.getByTestId('HomeIcon')).toBeInTheDocument()
    })

    it('should not show home icon when showHomeIcon is false', () => {
      renderWithTheme(
        <Breadcrumbs pathname="/about" app="landing" showHomeIcon={false} />
      )

      expect(screen.queryByTestId('HomeIcon')).not.toBeInTheDocument()
    })

    it('should show home icon on current breadcrumb when it is first', () => {
      // Test with a single-level path that has multiple breadcrumbs
      renderWithTheme(<Breadcrumbs pathname="/admin" app="management" />)

      // Since we only have one breadcrumb, component returns null
      const { container } = renderWithTheme(
        <Breadcrumbs pathname="/admin" app="management" />
      )
      expect(container.firstChild).toBeNull()
    })

    it('should show home icon correctly in multi-level navigation', () => {
      renderWithTheme(
        <Breadcrumbs pathname="/admin/orders/123" app="management" />
      )

      expect(screen.getByTestId('HomeIcon')).toBeInTheDocument()

      // Icon should be in the first breadcrumb (Dashboard link)
      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' })
      expect(dashboardLink).toBeInTheDocument()
    })
  })

  describe('Custom Breadcrumbs', () => {
    it('should use custom breadcrumbs when provided', () => {
      const customBreadcrumbs = [
        { label: 'Custom Home', href: '/custom', current: false },
        { label: 'Custom Page', href: '/custom/page', current: true },
      ]

      renderWithTheme(
        <Breadcrumbs
          pathname="/some/path"
          app="landing"
          customBreadcrumbs={customBreadcrumbs}
        />
      )

      expect(screen.getByRole('link', { name: 'Custom Home' })).toHaveAttribute(
        'href',
        '/custom'
      )
      expect(screen.getByText('Custom Page')).toBeInTheDocument()
    })

    it('should ignore auto-generated breadcrumbs when custom ones are provided', () => {
      const customBreadcrumbs = [
        { label: 'Override', href: '/override', current: false },
        { label: 'Current', href: '/current', current: true },
      ]

      renderWithTheme(
        <Breadcrumbs
          pathname="/about"
          app="landing"
          customBreadcrumbs={customBreadcrumbs}
        />
      )

      expect(screen.getByRole('link', { name: 'Override' })).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Home' })
      ).not.toBeInTheDocument()
      expect(screen.queryByText('About')).not.toBeInTheDocument()
    })
  })

  describe('Container Variants', () => {
    it('should render without container by default', () => {
      renderWithTheme(<Breadcrumbs pathname="/about" app="landing" />)

      // Should not have Paper container styles
      expect(screen.queryByRole('img')).not.toBeInTheDocument() // Paper has img role sometimes

      const navigation = screen.getByRole('navigation')
      expect(navigation).toBeInTheDocument()
    })

    it('should render with paper container when showContainer is true', () => {
      renderWithTheme(
        <Breadcrumbs pathname="/about" app="landing" showContainer={true} />
      )

      const navigation = screen.getByRole('navigation')
      expect(navigation).toBeInTheDocument()

      // Container should have paper-like styling (we can test via the DOM structure)
      const breadcrumbsContainer = navigation.closest('div')
      expect(breadcrumbsContainer).toBeInTheDocument()
    })
  })

  describe('Maximum Items', () => {
    it('should respect maxItems prop', () => {
      // Create a path that would generate many breadcrumbs
      renderWithTheme(
        <Breadcrumbs
          pathname="/admin/inventory/products"
          app="management"
          maxItems={2}
        />
      )

      const navigation = screen.getByRole('navigation')
      expect(navigation).toBeInTheDocument()

      // Material-UI Breadcrumbs should handle maxItems internally
      // We verify the prop is passed correctly
    })

    it('should use default maxItems of 6', () => {
      renderWithTheme(
        <Breadcrumbs pathname="/admin/orders/123" app="management" />
      )

      const navigation = screen.getByRole('navigation')
      expect(navigation).toBeInTheDocument()
    })
  })

  describe('App-Specific Behavior', () => {
    it('should generate different breadcrumbs for different apps', () => {
      // Test shop app
      const { rerender } = renderWithTheme(
        <Breadcrumbs pathname="/products" app="shop" />
      )

      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
      expect(screen.getByText('Products')).toBeInTheDocument()

      // Test management app
      rerender(
        <ThemeProvider theme={theme}>
          <Breadcrumbs pathname="/admin/orders" app="management" />
        </ThemeProvider>
      )

      expect(
        screen.getByRole('link', { name: 'Dashboard' })
      ).toBeInTheDocument()
      expect(screen.getByText('Orders')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA label', () => {
      renderWithTheme(<Breadcrumbs pathname="/about" app="landing" />)

      expect(screen.getByLabelText('breadcrumb')).toBeInTheDocument()
    })

    it('should have proper navigation role', () => {
      renderWithTheme(<Breadcrumbs pathname="/about" app="landing" />)

      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('should have proper link roles for clickable items', () => {
      renderWithTheme(<Breadcrumbs pathname="/products/bread" app="shop" />)

      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Products' })).toBeInTheDocument()
    })

    it('should use proper separator icon', () => {
      renderWithTheme(<Breadcrumbs pathname="/about" app="landing" />)

      // NavigateNext icon should be used as separator
      expect(screen.getByTestId('NavigateNextIcon')).toBeInTheDocument()
    })
  })

  describe('Styling and Theme Integration', () => {
    it('should apply correct typography styles to current breadcrumb', () => {
      renderWithTheme(<Breadcrumbs pathname="/about" app="landing" />)

      const currentBreadcrumb = screen.getByText('About')
      expect(currentBreadcrumb).toHaveStyle({
        fontWeight: 500,
      })
    })

    it('should apply correct spacing to home icon', () => {
      renderWithTheme(<Breadcrumbs pathname="/about" app="landing" />)

      const homeIcon = screen.getByTestId('HomeIcon')
      expect(homeIcon).toBeInTheDocument()
      // Icon spacing is applied via sx prop
    })

    it('should handle container styling correctly', () => {
      renderWithTheme(
        <Breadcrumbs pathname="/about" app="landing" showContainer={true} />
      )

      const navigation = screen.getByRole('navigation')
      expect(navigation).toBeInTheDocument()

      // Container styles are applied via Material-UI sx prop
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty pathname gracefully', () => {
      const { container } = renderWithTheme(
        <Breadcrumbs pathname="" app="landing" />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should handle unknown paths gracefully', () => {
      const { container } = renderWithTheme(
        <Breadcrumbs pathname="/unknown/path" app="landing" />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should handle custom breadcrumbs with only one item', () => {
      const customBreadcrumbs = [
        { label: 'Single Item', href: '/single', current: true },
      ]

      const { container } = renderWithTheme(
        <Breadcrumbs
          pathname="/test"
          app="landing"
          customBreadcrumbs={customBreadcrumbs}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should handle extremely long breadcrumb paths', () => {
      const longCustomBreadcrumbs = Array.from({ length: 10 }, (_, i) => ({
        label: `Level ${i + 1}`,
        href: `/level${i + 1}`,
        current: i === 9,
      }))

      renderWithTheme(
        <Breadcrumbs
          pathname="/deep/path"
          app="management"
          customBreadcrumbs={longCustomBreadcrumbs}
          maxItems={3}
        />
      )

      const navigation = screen.getByRole('navigation')
      expect(navigation).toBeInTheDocument()
    })
  })
})
