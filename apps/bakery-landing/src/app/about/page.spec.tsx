import { screen, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import AboutPage from './page'

describe('About Page', () => {
  it('renders page title and subtitle', () => {
    renderWithTheme(<AboutPage />)

    expect(
      screen.getByRole('heading', { name: 'Über uns' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Über 90 Jahre Bäckerhandwerk und Familientradition')
    ).toBeInTheDocument()
  })

  it('renders breadcrumb navigation with link to home', () => {
    renderWithTheme(<AboutPage />)

    const breadcrumbs = screen.getByLabelText('breadcrumb')
    const homeLink = within(breadcrumbs).getByRole('link', {
      name: /Startseite/,
    })
    expect(homeLink).toHaveAttribute('href', '/')
    expect(within(breadcrumbs).getByText('Über uns')).toBeInTheDocument()
  })

  it('renders family business story section', () => {
    renderWithTheme(<AboutPage />)

    expect(screen.getByText('Familienbetrieb seit 1933')).toBeInTheDocument()
    expect(screen.getByText(/über neun Jahrzehnten/)).toBeInTheDocument()
    expect(screen.getAllByText(/Heinrich Heusser/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Karl-Heinrich Heusser/).length).toBeGreaterThan(
      0
    )
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

  it('renders history timeline with all milestones', () => {
    renderWithTheme(<AboutPage />)

    expect(
      screen.getByRole('heading', { name: 'Unsere Geschichte' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Über 90 Jahre Bäckerhandwerk und Familientradition in Kirrberg.'
      )
    ).toBeInTheDocument()

    const years = ['1933', '1968', '1985', '2000', '2022', 'Heute']
    years.forEach((year) => {
      expect(screen.getByText(year)).toBeInTheDocument()
    })

    const titles = [
      'Gründung der Bäckerei',
      'Übernahme durch die zweite Generation',
      'Ausbau der Backstube',
      'Renovierung des Verkaufsraums',
      'Übergang zur dritten Generation',
      'Tradition bewahren, Zukunft gestalten',
    ]
    titles.forEach((title) => {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    })
  })

  it('renders team section with members', () => {
    renderWithTheme(<AboutPage />)

    expect(screen.getByText('Unser Team')).toBeInTheDocument()
    expect(screen.getByText('Karl Heinrich Heusser')).toBeInTheDocument()
    expect(screen.getByText('Florian Hein')).toBeInTheDocument()
    expect(screen.getByText('Daniela Fricke')).toBeInTheDocument()
  })

  it('renders call-to-action section with working links', () => {
    renderWithTheme(<AboutPage />)

    expect(screen.getByText('Besuchen Sie uns')).toBeInTheDocument()

    const contactLink = screen.getByRole('link', {
      name: /Kontakt aufnehmen/i,
    })
    expect(contactLink).toHaveAttribute('href', '/contact')

    const productsLink = screen.getByRole('link', {
      name: /Unser Angebot entdecken/i,
    })
    expect(productsLink).toHaveAttribute('href', '/products')
  })

  it('lazy-loads below-the-fold images', () => {
    renderWithTheme(<AboutPage />)

    const images = screen.getAllByRole('img')
    expect(images.length).toBeGreaterThanOrEqual(2)
    images.forEach((img) => {
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('decoding', 'async')
    })
  })

  it('has proper semantic heading structure', () => {
    const { container } = renderWithTheme(<AboutPage />)

    const h2Elements = container.querySelectorAll('h2')
    expect(h2Elements.length).toBeGreaterThan(0)

    const h3Elements = container.querySelectorAll('h3')
    expect(h3Elements.length).toBeGreaterThan(0)
  })
})
