import { screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import EnhancedHero from './EnhancedHero'

// Mock the openingHours utils; the state is mutable so each test can pick
// one of the four badge states.
const mockStatus = {
  open: true,
  todayHours: '6:00 - 13:30 Uhr',
  opensLater: false,
  openingTime: '6:00' as string | null,
  nextOpening: { day: 'Donnerstag', time: '6:00' } as {
    day: string
    time: string
  } | null,
}

jest.mock('../../../utils/openingHours', () => ({
  isCurrentlyOpen: () => mockStatus.open,
  getTodayHours: () => mockStatus.todayHours,
  opensLaterToday: () => mockStatus.opensLater,
  getTodayOpeningTime: () => mockStatus.openingTime,
  getNextOpening: () => mockStatus.nextOpening,
}))

describe('EnhancedHero Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStatus.open = true
    mockStatus.todayHours = '6:00 - 13:30 Uhr'
    mockStatus.opensLater = false
    mockStatus.openingTime = '6:00'
    mockStatus.nextOpening = { day: 'Donnerstag', time: '6:00' }
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

  it('displays opening status badge after hydration', async () => {
    renderWithTheme(<EnhancedHero />)

    await waitFor(() => {
      expect(screen.getByText(/Jetzt geöffnet/)).toBeInTheDocument()
    })
  })

  it('shows the opening time when the bakery opens later today', async () => {
    mockStatus.open = false
    mockStatus.opensLater = true

    renderWithTheme(<EnhancedHero />)

    await waitFor(() => {
      expect(screen.getByText('Öffnet um 6:00 Uhr')).toBeInTheDocument()
    })
  })

  it('after closing time on an open day it says "Jetzt geschlossen" and names the next opening', async () => {
    mockStatus.open = false
    mockStatus.opensLater = false

    renderWithTheme(<EnhancedHero />)

    await waitFor(() => {
      expect(
        screen.getByText('Jetzt geschlossen — öffnet Donnerstag 6:00 Uhr')
      ).toBeInTheDocument()
    })
    expect(screen.queryByText(/Heute geschlossen/)).not.toBeInTheDocument()
  })

  it('on the Ruhetag it says so and names the next opening', async () => {
    mockStatus.open = false
    mockStatus.opensLater = false
    mockStatus.openingTime = null
    mockStatus.nextOpening = { day: 'Dienstag', time: '6:00' }

    renderWithTheme(<EnhancedHero />)

    await waitFor(() => {
      expect(
        screen.getByText('Heute Ruhetag — öffnet Dienstag 6:00 Uhr')
      ).toBeInTheDocument()
    })
  })

  it('falls back to the plain closed label when no next opening is known', async () => {
    mockStatus.open = false
    mockStatus.opensLater = false
    mockStatus.nextOpening = null

    renderWithTheme(<EnhancedHero />)

    await waitFor(() => {
      expect(screen.getByText('Jetzt geschlossen')).toBeInTheDocument()
    })
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
