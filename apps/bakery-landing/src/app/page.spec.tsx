import { render, screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import LandingPage from './page'

// Mock the LANDING_NAVIGATION constant
jest.mock('@bakery/shared/utils', () => ({
  LANDING_NAVIGATION: [
    { href: '/about', label: 'Über uns', external: false },
    { href: '/imprint', label: 'Impressum', external: false },
    {
      href: 'https://shop.baeckerei-heusser.de',
      label: 'Online Shop',
      external: true,
    },
  ],
}))

describe('Landing Page', () => {
  it('renders the page title in header', () => {
    renderWithTheme(<LandingPage />)

    expect(screen.getByText('Bäckerei Heusser')).toBeInTheDocument()
  })

  it('displays hero section with main headline', () => {
    renderWithTheme(<LandingPage />)

    expect(
      screen.getByText('Traditionelle Handwerksbäckerei')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Frische Backwaren aus traditioneller Handwerkskunst seit 1933/
      )
    ).toBeInTheDocument()
  })

  it('shows main call-to-action buttons', () => {
    renderWithTheme(<LandingPage />)

    expect(
      screen.getByRole('button', { name: /Online Shop besuchen/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Standort anzeigen/i })
    ).toBeInTheDocument()
  })

  it('displays quick info cards', () => {
    renderWithTheme(<LandingPage />)

    expect(screen.getByText('Öffnungszeiten')).toBeInTheDocument()
    expect(screen.getByText('Standort')).toBeInTheDocument()
    expect(screen.getByText('Seit 1933')).toBeInTheDocument()
  })

  it('shows opening hours information', () => {
    renderWithTheme(<LandingPage />)

    expect(screen.getByText(/Mo-Fr: 06:00-12:30/)).toBeInTheDocument()
    expect(screen.getByText(/Sa: 06:00-12:00/)).toBeInTheDocument()
    expect(screen.getByText(/So: Geschlossen/)).toBeInTheDocument()
  })

  it('displays location information', () => {
    renderWithTheme(<LandingPage />)

    expect(screen.getByText(/Eckstraße 3/)).toBeInTheDocument()
    expect(screen.getByText(/66424 Homburg\/Kirrberg/)).toBeInTheDocument()
    expect(screen.getByText(/Saarland/)).toBeInTheDocument()
  })

  it('includes family business story', () => {
    renderWithTheme(<LandingPage />)

    expect(screen.getByText('Familienbetrieb seit 1933')).toBeInTheDocument()
    expect(screen.getByText(/Heinrich Heusser/)).toBeInTheDocument()
    expect(screen.getByText(/Karl-Heinrich Heusser/)).toBeInTheDocument()
  })

  it('shows product categories', () => {
    renderWithTheme(<LandingPage />)

    expect(screen.getByText('Unser Sortiment')).toBeInTheDocument()
    expect(screen.getByText('Brot & Brötchen')).toBeInTheDocument()
    expect(screen.getByText('Kuchen & Gebäck')).toBeInTheDocument()
    expect(screen.getByText('Saisonale Spezialitäten')).toBeInTheDocument()
  })

  it('displays contact call-to-action section', () => {
    renderWithTheme(<LandingPage />)

    expect(screen.getByText('Besuchen Sie uns heute!')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Anrufen: 06841 2229/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Online bestellen/i })
    ).toBeInTheDocument()
  })

  it('includes contact section with full details', () => {
    renderWithTheme(<LandingPage />)

    expect(screen.getByText('So finden Sie uns')).toBeInTheDocument()
    expect(screen.getByText('Kontakt & Anfahrt')).toBeInTheDocument()
    expect(screen.getByText(/info@baeckerei-heusser.de/)).toBeInTheDocument()
  })

  it('renders footer with company information', () => {
    renderWithTheme(<LandingPage />)

    expect(
      screen.getByText(/Traditionelle Handwerksbäckerei seit 1933/)
    ).toBeInTheDocument()
    expect(screen.getByText(/© 2024 Bäckerei Heusser/)).toBeInTheDocument()
  })

  it('includes navigation links', () => {
    renderWithTheme(<LandingPage />)

    expect(screen.getByRole('button', { name: 'Über uns' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Impressum' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Online Shop' })
    ).toBeInTheDocument()
  })

  it('has proper semantic structure', () => {
    const { container } = renderWithTheme(<LandingPage />)

    // Check for AppBar (acts as header)
    const appBar =
      container.querySelector('[role="banner"]') ||
      container.querySelector('header')
    expect(
      appBar || container.querySelector('.MuiAppBar-root')
    ).toBeInTheDocument()

    // Check for footer
    const footer = container.querySelector('footer')
    expect(footer).toBeInTheDocument()

    // Check for main content headings
    const h1 = container.querySelector('h1')
    expect(h1).toBeInTheDocument()

    const h2Elements = container.querySelectorAll('h2')
    expect(h2Elements.length).toBeGreaterThan(0)
  })

  it('includes phone number links', () => {
    renderWithTheme(<LandingPage />)

    const phoneLinks = screen.getAllByText(/06841 2229/)
    expect(phoneLinks.length).toBeGreaterThan(0)
  })
})
