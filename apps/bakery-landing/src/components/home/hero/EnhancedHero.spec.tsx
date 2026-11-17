import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import { LEGAL } from '../../../config/legal'
import type { OpenStatus } from '../../../utils/openingHours'
import EnhancedHero from './EnhancedHero'

// Each badge test picks a status (synthetic times). Without one the real
// getOpenStatus runs against the fake clock set in the test - never against
// the real date.
let mockStatus: OpenStatus | null = null

jest.mock('../../../utils/openingHours', () => {
  const actual = jest.requireActual('../../../utils/openingHours')
  return {
    ...actual,
    getOpenStatus: (now?: Date) => mockStatus ?? actual.getOpenStatus(now),
  }
})

const NEXT = { day: 'Donnerstag', time: '6:00' }

describe('EnhancedHero Component', () => {
  beforeEach(() => {
    mockStatus = {
      kind: 'open',
      todayHours: '6:00 - 13:30 Uhr',
      opens: '6:00',
      next: NEXT,
    }
  })

  afterEach(() => {
    jest.useRealTimers()
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

  it('displays opening status badge after hydration', () => {
    renderWithTheme(<EnhancedHero />)

    expect(
      screen.getByText('Jetzt geöffnet — 6:00 - 13:30 Uhr')
    ).toBeInTheDocument()
  })

  it('shows the opening time when the bakery opens later today', () => {
    mockStatus = {
      kind: 'opens-later',
      todayHours: '6:00 - 13:30 Uhr',
      opens: '6:00',
      next: { day: 'Heute', time: '6:00' },
    }

    renderWithTheme(<EnhancedHero />)

    expect(screen.getByText('Öffnet um 6:00 Uhr')).toBeInTheDocument()
  })

  it('after closing time on an open day it says "Jetzt geschlossen" and names the next opening', () => {
    mockStatus = {
      kind: 'closed-for-today',
      todayHours: '6:00 - 13:30 Uhr',
      opens: '6:00',
      next: NEXT,
    }

    renderWithTheme(<EnhancedHero />)

    expect(
      screen.getByText('Jetzt geschlossen — öffnet Donnerstag 6:00 Uhr')
    ).toBeInTheDocument()
    expect(screen.queryByText(/Heute geschlossen/)).not.toBeInTheDocument()
  })

  it('on the Ruhetag it says so and names the next opening', () => {
    mockStatus = { kind: 'ruhetag', next: { day: 'Dienstag', time: '6:00' } }

    renderWithTheme(<EnhancedHero />)

    expect(
      screen.getByText('Heute Ruhetag — öffnet Dienstag 6:00 Uhr')
    ).toBeInTheDocument()
  })

  it('falls back to the plain closed label when no next opening is known', () => {
    mockStatus = {
      kind: 'closed-for-today',
      todayHours: '6:00 - 13:30 Uhr',
      opens: '6:00',
      next: null,
    }

    renderWithTheme(<EnhancedHero />)

    expect(screen.getByText('Jetzt geschlossen')).toBeInTheDocument()
  })

  it('on a holiday it names the holiday and claims neither open nor closed', () => {
    mockStatus = { kind: 'feiertag', name: 'Testfeiertag', next: NEXT }

    renderWithTheme(<EnhancedHero />)

    expect(
      screen.getByText(
        'Heute Feiertag (Testfeiertag) — Öffnungszeiten bitte telefonisch erfragen'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/geöffnet|geschlossen/i)).not.toBeInTheDocument()
  })

  it('on 2026-12-25 at 09:00 German time (real status) it does not say "Jetzt geöffnet"', () => {
    mockStatus = null
    jest.useFakeTimers().setSystemTime(new Date('2026-12-25T08:00:00Z'))

    renderWithTheme(<EnhancedHero />)

    expect(
      screen.getByText(
        'Heute Feiertag (1. Weihnachtstag) — Öffnungszeiten bitte telefonisch erfragen'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/Jetzt geöffnet/)).not.toBeInTheDocument()
  })

  it('on a normal Tuesday at 09:00 German time (real status) it is open', () => {
    mockStatus = null
    jest.useFakeTimers().setSystemTime(new Date('2026-11-17T08:00:00Z'))

    renderWithTheme(<EnhancedHero />)

    expect(screen.getByText(/^Jetzt geöffnet — /)).toBeInTheDocument()
  })

  it('displays phone number', () => {
    renderWithTheme(<EnhancedHero />)

    expect(screen.getByText(LEGAL.phone)).toBeInTheDocument()
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

  it('phone number and order button call the shop number from LEGAL', () => {
    renderWithTheme(<EnhancedHero />)

    expect(screen.getByText(LEGAL.phone).closest('a')).toHaveAttribute(
      'href',
      LEGAL.phoneHref
    )
    expect(
      screen.getByRole('link', { name: 'Jetzt bestellen' })
    ).toHaveAttribute('href', LEGAL.phoneHref)
  })
})
