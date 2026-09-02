import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import LandingPage from './page'

// Mock the openingHours utils
jest.mock('../utils/openingHours', () => ({
  ...jest.requireActual('../utils/openingHours'),
  isCurrentlyOpen: () => true,
  getTodayHours: () => '6:00 - 13:30 Uhr',
  getNextOpening: () => ({ day: 'Dienstag', time: '6:00' }),
  getEarliestOpeningTime: () => '6:00',
  getFooterHours: () => [
    { label: 'Mo', value: 'Geschlossen' },
    { label: 'Di-Fr', value: '6:00 - 13:30 Uhr' },
    { label: 'Sa', value: '6:00 - 12:30 Uhr' },
    { label: 'So', value: '8:00 - 11:00 Uhr' },
  ],
  getSeoOpeningHours: () => [],
  getMapDisplayHours: () => [
    { label: 'Mo', value: 'Geschlossen' },
    { label: 'Di, Mi, Do, Fr', value: '6:00 - 13:30 Uhr' },
    { label: 'Sa', value: '6:00 - 12:30 Uhr' },
    { label: 'So und Feiertage', value: '08:00 - 11:00 Uhr' },
  ],
}))

// Mock testimonials
jest.mock('../mocks/testimonials', () => ({
  TESTIMONIALS: [
    { name: 'Anna M.', stars: 5, text: 'Tolles Brot!' },
    { name: 'Peter K.', stars: 5, text: 'Beste Brötchen!' },
    { name: 'Maria S.', stars: 4, text: 'Sehr lecker!' },
  ],
}))

describe('Landing Page', () => {
  it('renders the hero with bakery name', () => {
    renderWithTheme(<LandingPage />)

    expect(screen.getByText('Bäckerei Heusser')).toBeInTheDocument()
  })

  it('displays opening status', () => {
    renderWithTheme(<LandingPage />)

    const openElements = screen.getAllByText(/Jetzt geöffnet/)
    expect(openElements.length).toBeGreaterThan(0)
  })

  it('shows phone number', () => {
    renderWithTheme(<LandingPage />)

    const phoneElements = screen.getAllByText('06841 2229')
    expect(phoneElements.length).toBeGreaterThan(0)
  })

  it('renders featured products section', () => {
    renderWithTheme(<LandingPage />)

    expect(screen.getByText('Frisch aus der Backstube')).toBeInTheDocument()
    expect(screen.getByText('Alle Produkte ansehen')).toBeInTheDocument()
  })

  it('renders testimonials section', () => {
    renderWithTheme(<LandingPage />)

    expect(screen.getByText('Was unsere Kunden sagen')).toBeInTheDocument()
  })

  it('renders location section', () => {
    renderWithTheme(<LandingPage />)

    expect(screen.getByText('Besuchen Sie uns')).toBeInTheDocument()
    expect(screen.getByText('Eckstraße 3')).toBeInTheDocument()
  })

  it('has proper heading structure', () => {
    const { container } = renderWithTheme(<LandingPage />)

    const h1 = container.querySelector('h1')
    expect(h1).toBeInTheDocument()
    expect(h1).toHaveTextContent('Bäckerei Heusser')

    const h2Elements = container.querySelectorAll('h2')
    expect(h2Elements.length).toBeGreaterThan(0)
  })

  it('includes quick info bar with key cards', () => {
    renderWithTheme(<LandingPage />)

    const openingElements = screen.getAllByText('Öffnungszeiten')
    expect(openingElements.length).toBeGreaterThan(0)
    expect(screen.getByText('Telefon')).toBeInTheDocument()
    expect(screen.getByText('Bestellen')).toBeInTheDocument()
    const addressElements = screen.getAllByText(/Adresse/)
    expect(addressElements.length).toBeGreaterThan(0)
  })
})
