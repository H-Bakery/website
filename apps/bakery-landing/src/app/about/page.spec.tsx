import { render, screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import AboutPage from './page'

describe('About Page', () => {
  it('renders page title and subtitle', () => {
    renderWithTheme(<AboutPage />)

    expect(screen.getByText('Über uns')).toBeInTheDocument()
    expect(screen.getByText(/Fast 90 Jahre Bäckerhandwerk/)).toBeInTheDocument()
  })

  it('renders header with bakery name and back button', () => {
    renderWithTheme(<AboutPage />)

    expect(screen.getByText('Bäckerei Heusser')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /zurück/i })).toBeInTheDocument()
  })

  it('renders family business story section', () => {
    renderWithTheme(<AboutPage />)

    expect(screen.getByText('Familienbetrieb seit 1933')).toBeInTheDocument()
    expect(screen.getByText(/Heinrich Heusser/)).toBeInTheDocument()
    expect(screen.getByText(/Karl-Heinrich Heusser/)).toBeInTheDocument()
  })

  it('renders current operations section', () => {
    renderWithTheme(<AboutPage />)

    expect(screen.getByText('Für Sie vor Ort')).toBeInTheDocument()
    expect(screen.getByText(/Tante Emma Laden/)).toBeInTheDocument()
  })

  it('renders vision and mission sections', () => {
    renderWithTheme(<AboutPage />)

    expect(screen.getByText('Unsere Vision')).toBeInTheDocument()
    expect(screen.getByText('Unsere Mission')).toBeInTheDocument()
  })

  it('renders company values with icons', () => {
    renderWithTheme(<AboutPage />)

    expect(screen.getByText('Unsere Werte')).toBeInTheDocument()
    expect(screen.getByText('Qualität')).toBeInTheDocument()
    expect(screen.getByText('Nachhaltigkeit')).toBeInTheDocument()
    expect(screen.getByText('Gemeinschaft')).toBeInTheDocument()
  })

  it('renders team section with members', () => {
    renderWithTheme(<AboutPage />)

    expect(screen.getByText('Unser Team')).toBeInTheDocument()
    expect(screen.getByText('Karl Heinrich Heusser')).toBeInTheDocument()
    expect(screen.getByText('Florian Hein')).toBeInTheDocument()
    expect(screen.getByText('Daniela Fricke')).toBeInTheDocument()
  })

  it('renders call-to-action section', () => {
    renderWithTheme(<AboutPage />)

    expect(screen.getByText('Besuchen Sie uns')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Kontakt aufnehmen/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Unser Angebot entdecken/i })
    ).toBeInTheDocument()
  })

  it('renders footer with contact information', () => {
    renderWithTheme(<AboutPage />)

    expect(screen.getByText(/Eckstraße 3/)).toBeInTheDocument()
    expect(screen.getByText(/66424 Homburg\/Kirrberg/)).toBeInTheDocument()
    expect(screen.getByText(/06841 2229/)).toBeInTheDocument()
  })

  it('includes proper layout structure', () => {
    const { container } = renderWithTheme(<AboutPage />)

    // Check for header
    const header = container.querySelector('header')
    expect(header).toBeInTheDocument()

    // Check for footer
    const footer = container.querySelector('footer')
    expect(footer).toBeInTheDocument()

    // Check for main content containers
    const containers = container.querySelectorAll('[maxWidth="lg"]')
    expect(containers.length).toBeGreaterThan(0)
  })

  it('includes back navigation to home', () => {
    renderWithTheme(<AboutPage />)

    const backButton = screen.getByRole('button', { name: /zurück/i })
    expect(backButton).toBeInTheDocument()
    expect(backButton).toHaveAttribute('href', '/')
  })

  it('has proper semantic structure', () => {
    const { container } = renderWithTheme(<AboutPage />)

    // Check for proper heading hierarchy
    const h1 = container.querySelector('h1')
    expect(h1).toBeInTheDocument()

    const h2Elements = container.querySelectorAll('h2')
    expect(h2Elements.length).toBeGreaterThan(0)

    const h3Elements = container.querySelectorAll('h3')
    expect(h3Elements.length).toBeGreaterThan(0)
  })
})
