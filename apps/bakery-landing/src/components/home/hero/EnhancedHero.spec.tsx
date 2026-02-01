import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import EnhancedHero from './EnhancedHero'

// Mock the openingHours utils
jest.mock('../../../utils/openingHours', () => ({
  isCurrentlyOpen: () => true,
  getTodayHours: () => '6:00 - 13:30 Uhr',
}))

describe('EnhancedHero Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders bakery name as headline', () => {
    renderWithTheme(<EnhancedHero />)

    expect(screen.getByText('Bäckerei Heusser')).toBeInTheDocument()
  })

  it('renders tagline', () => {
    renderWithTheme(<EnhancedHero />)

    expect(
      screen.getByText(/Täglich frisch aus der Backstube/)
    ).toBeInTheDocument()
  })

  it('displays opening status badge', () => {
    renderWithTheme(<EnhancedHero />)

    expect(screen.getByText(/Jetzt geöffnet/)).toBeInTheDocument()
  })

  it('displays phone number', () => {
    renderWithTheme(<EnhancedHero />)

    expect(screen.getByText('06841 2229')).toBeInTheDocument()
  })

  it('renders CTA buttons', () => {
    renderWithTheme(<EnhancedHero />)

    expect(screen.getByText('Jetzt bestellen')).toBeInTheDocument()
    expect(screen.getByText('So finden Sie uns')).toBeInTheDocument()
  })

  it('has proper heading structure', () => {
    renderWithTheme(<EnhancedHero />)

    const mainHeading = screen.getByRole('heading', { level: 1 })
    expect(mainHeading).toBeInTheDocument()
    expect(mainHeading).toHaveTextContent('Bäckerei Heusser')
  })

  it('handles image loading gracefully', () => {
    const { container } = renderWithTheme(<EnhancedHero />)

    expect(container.firstChild).toBeInTheDocument()
  })

  it('phone number links to tel: URI', () => {
    renderWithTheme(<EnhancedHero />)

    const phoneLink = screen.getByText('06841 2229')
    expect(phoneLink).toHaveAttribute('href', 'tel:068412229')
  })
})
