import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { AppNavigation, Breadcrumbs } from '@bakery/shared/ui'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/about',
    asPath: '/about',
  }),
  usePathname: () => '/about',
}))

// Mock Material UI useMediaQuery
jest.mock('@mui/material/useMediaQuery')
const mockUseMediaQuery = useMediaQuery as jest.MockedFunction<
  typeof useMediaQuery
>

// Test theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#8B4513', // Bakery brown
    },
  },
})

// Render helper with theme
function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

describe('Landing App Navigation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseMediaQuery.mockReturnValue(false) // Default to desktop
  })

  describe('AppNavigation in Landing Context', () => {
    it('should render landing navigation with correct branding', () => {
      renderWithTheme(<AppNavigation app="landing" />)

      expect(screen.getByText('Bäckerei Heusser')).toBeInTheDocument()
      expect(screen.getByTestId('HomeIcon')).toBeInTheDocument()
    })

    it('should render landing-specific navigation items', () => {
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

    it('should use primary color scheme for landing app', () => {
      renderWithTheme(<AppNavigation app="landing" />)

      const appBar = screen.getByRole('banner')
      expect(appBar).toHaveClass('MuiAppBar-colorPrimary')
    })

    it('should support custom branding for marketing campaigns', () => {
      renderWithTheme(
        <AppNavigation app="landing" title="Handwerksbäckerei seit 1933" />
      )

      expect(
        screen.getByText('Handwerksbäckerei seit 1933')
      ).toBeInTheDocument()
      expect(screen.queryByText('Bäckerei Heusser')).not.toBeInTheDocument()
    })

    it('should handle mobile responsive behavior for marketing site', () => {
      mockUseMediaQuery.mockReturnValue(true) // Mobile view
      renderWithTheme(<AppNavigation app="landing" />)

      // Should show mobile menu button
      expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()

      // Navigation links should be hidden on mobile
      const navButtons = screen
        .queryAllByRole('link')
        .filter((button) => !button.closest('[role="menu"]'))
      expect(navButtons).toHaveLength(0)
    })

    it('should handle mobile menu for landing site', async () => {
      mockUseMediaQuery.mockReturnValue(true) // Mobile view
      renderWithTheme(<AppNavigation app="landing" />)

      const menuButton = screen.getByRole('button', { name: /menu/i })
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      // Check landing navigation items in mobile menu
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

    it('should support custom navigation for special landing pages', () => {
      const customNavigation = [
        { label: 'Produkte', href: '/products', external: false },
        { label: 'Online Shop', href: '/shop', external: false },
        { label: 'Kontakt', href: '/contact', external: false },
      ]

      renderWithTheme(
        <AppNavigation app="landing" customNavigation={customNavigation} />
      )

      expect(screen.getByRole('link', { name: 'Produkte' })).toHaveAttribute(
        'href',
        '/products'
      )
      expect(screen.getByRole('link', { name: 'Online Shop' })).toHaveAttribute(
        'href',
        '/shop'
      )
      expect(screen.getByRole('link', { name: 'Kontakt' })).toHaveAttribute(
        'href',
        '/contact'
      )

      // Default navigation should not be present
      expect(
        screen.queryByRole('link', { name: 'Home' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'About' })
      ).not.toBeInTheDocument()
    })

    it('should work with mobile-friendly variant for landing campaigns', () => {
      mockUseMediaQuery.mockReturnValue(true) // Mobile view
      renderWithTheme(<AppNavigation app="landing" variant="mobile-friendly" />)

      // Should show title and mobile menu
      expect(screen.getByText('Bäckerei Heusser')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
    })
  })

  describe('Breadcrumbs in Landing Context', () => {
    it('should render breadcrumbs for about page', () => {
      renderWithTheme(<Breadcrumbs pathname="/about" app="landing" />)

      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
        'href',
        '/'
      )
      expect(screen.getByText('About')).toBeInTheDocument()
    })

    it('should render breadcrumbs for contact page', () => {
      renderWithTheme(<Breadcrumbs pathname="/contact" app="landing" />)

      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
        'href',
        '/'
      )
      expect(screen.getByText('Contact')).toBeInTheDocument()
    })

    it('should not render breadcrumbs for home page', () => {
      const { container } = renderWithTheme(
        <Breadcrumbs pathname="/" app="landing" />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should show home icon in landing breadcrumbs', () => {
      renderWithTheme(<Breadcrumbs pathname="/about" app="landing" />)

      expect(screen.getByTestId('HomeIcon')).toBeInTheDocument()
    })

    it('should support hiding home icon for minimal design', () => {
      renderWithTheme(
        <Breadcrumbs pathname="/about" app="landing" showHomeIcon={false} />
      )

      expect(screen.queryByTestId('HomeIcon')).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    })

    it('should support custom breadcrumbs for marketing pages', () => {
      const customBreadcrumbs = [
        { label: 'Start', href: '/', current: false },
        { label: 'Über uns', href: '/about', current: false },
        { label: 'Unsere Geschichte', href: '/about/history', current: true },
      ]

      renderWithTheme(
        <Breadcrumbs
          pathname="/about/history"
          app="landing"
          customBreadcrumbs={customBreadcrumbs}
        />
      )

      expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute(
        'href',
        '/'
      )
      expect(screen.getByRole('link', { name: 'Über uns' })).toHaveAttribute(
        'href',
        '/about'
      )
      expect(screen.getByText('Unsere Geschichte')).toBeInTheDocument()
    })
  })

  describe('Landing Page Layout Integration', () => {
    it('should work together in a complete landing layout', () => {
      const LandingLayout = () => (
        <div>
          <AppNavigation app="landing">
            <button>Termin buchen</button>
          </AppNavigation>
          <Breadcrumbs pathname="/about" app="landing" />
          <main>
            <h1>Über die Bäckerei Heusser</h1>
            <p>Traditionelle Handwerkskunst seit 1933</p>
          </main>
        </div>
      )

      renderWithTheme(<LandingLayout />)

      // Navigation should be present
      expect(screen.getByText('Bäckerei Heusser')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()

      // Custom CTA should be rendered
      expect(
        screen.getByRole('button', { name: 'Termin buchen' })
      ).toBeInTheDocument()

      // Breadcrumbs should be present
      expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
        'href',
        '/'
      )
      expect(screen.getByText('About')).toBeInTheDocument()

      // Main content should be present
      expect(
        screen.getByRole('heading', { name: 'Über die Bäckerei Heusser' })
      ).toBeInTheDocument()
      expect(
        screen.getByText('Traditionelle Handwerkskunst seit 1933')
      ).toBeInTheDocument()
    })

    it('should support marketing campaign layouts', () => {
      const CampaignLayout = () => (
        <div>
          <AppNavigation
            app="landing"
            title="Osteraktion 2024"
            customNavigation={[
              { label: 'Osterbrote', href: '/easter/bread', external: false },
              {
                label: 'Süße Leckereien',
                href: '/easter/sweets',
                external: false,
              },
              { label: 'Bestellung', href: '/order', external: false },
            ]}
          >
            <button>Jetzt bestellen</button>
          </AppNavigation>
          <main>
            <h1>Osteraktion 2024</h1>
          </main>
        </div>
      )

      renderWithTheme(<CampaignLayout />)

      // Campaign navigation should be present
      expect(screen.getByText('Osteraktion 2024')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Osterbrote' })).toHaveAttribute(
        'href',
        '/easter/bread'
      )
      expect(
        screen.getByRole('link', { name: 'Süße Leckereien' })
      ).toHaveAttribute('href', '/easter/sweets')
      expect(screen.getByRole('link', { name: 'Bestellung' })).toHaveAttribute(
        'href',
        '/order'
      )

      // Campaign CTA should be rendered
      expect(
        screen.getByRole('button', { name: 'Jetzt bestellen' })
      ).toBeInTheDocument()

      // Main content should be present
      expect(
        screen.getByRole('heading', { name: 'Osteraktion 2024' })
      ).toBeInTheDocument()
    })

    it('should work with minimal navigation for focused landing pages', () => {
      const MinimalLayout = () => (
        <div>
          <AppNavigation app="landing" variant="minimal" />
          <main>
            <h1>Willkommen</h1>
            <p>Entdecken Sie unsere handwerklichen Backwaren</p>
          </main>
        </div>
      )

      renderWithTheme(<MinimalLayout />)

      // Minimal navigation should show only title
      expect(screen.getByText('Bäckerei Heusser')).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Home' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'About' })
      ).not.toBeInTheDocument()

      // Main content should be present
      expect(
        screen.getByRole('heading', { name: 'Willkommen' })
      ).toBeInTheDocument()
    })
  })

  describe('SEO and Marketing Integration', () => {
    it('should provide proper navigation structure for SEO', () => {
      const SEOLayout = () => (
        <div>
          <AppNavigation app="landing" />
          <Breadcrumbs pathname="/about" app="landing" />
          <main>Content</main>
        </div>
      )

      renderWithTheme(<SEOLayout />)

      // Should have banner for main navigation
      expect(screen.getByRole('banner')).toBeInTheDocument()

      // Should have navigation for breadcrumbs
      expect(screen.getByRole('navigation')).toBeInTheDocument()

      // Should have main content area
      expect(screen.getByRole('main')).toBeInTheDocument()

      // Breadcrumbs should have proper aria-label for accessibility
      expect(screen.getByLabelText('breadcrumb')).toBeInTheDocument()
    })

    it('should support keyboard navigation for accessibility', () => {
      renderWithTheme(<AppNavigation app="landing" />)

      const homeLink = screen.getByRole('link', { name: 'Home' })
      const aboutLink = screen.getByRole('link', { name: 'About' })
      const contactLink = screen.getByRole('link', { name: 'Contact' })

      // Should be focusable
      homeLink.focus()
      expect(document.activeElement).toBe(homeLink)

      // Should support tab navigation
      aboutLink.focus()
      expect(document.activeElement).toBe(aboutLink)

      contactLink.focus()
      expect(document.activeElement).toBe(contactLink)
    })

    it('should maintain consistent theme across landing components', () => {
      const LandingLayout = () => (
        <div>
          <AppNavigation app="landing" />
          <Breadcrumbs pathname="/about" app="landing" showContainer={true} />
        </div>
      )

      renderWithTheme(<LandingLayout />)

      // Both components should be rendered without theme conflicts
      expect(screen.getByRole('banner')).toBeInTheDocument() // AppBar
      expect(screen.getByRole('navigation')).toBeInTheDocument() // Breadcrumbs
    })
  })
})
