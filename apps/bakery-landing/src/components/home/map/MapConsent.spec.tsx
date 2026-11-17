import { fireEvent, screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import { MAP_CONSENT_KEY, MapConsent } from './MapConsent'

describe('MapConsent', () => {
  beforeEach(() => window.localStorage.clear())

  it('asks first and loads nothing before consent', () => {
    renderWithTheme(
      <MapConsent height={300}>
        <div data-testid="karte" />
      </MapConsent>
    )

    expect(
      screen.getByRole('region', { name: 'Kartenhinweis' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Datenschutzerklärung' })
    ).toHaveAttribute('href', '/datenschutz')
    expect(
      screen.getByText(
        'Ihre Entscheidung wird lokal in Ihrem Browser gespeichert.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByTestId('karte')).not.toBeInTheDocument()
  })

  it('grows with its content before consent: minimum height, no fixed height', () => {
    renderWithTheme(
      <MapConsent height={300}>
        <div />
      </MapConsent>
    )

    const region = screen.getByRole('region', { name: 'Kartenhinweis' })
    const style = window.getComputedStyle(region)
    expect(style.minHeight).toBe('300px')
    expect(style.height).not.toBe('300px')
    expect(style.overflow).not.toBe('hidden')
  })

  it('loads the map in a box of the given height after consent and remembers it', () => {
    renderWithTheme(
      <MapConsent height={300}>
        <div data-testid="karte" />
      </MapConsent>
    )

    fireEvent.click(screen.getByRole('button', { name: /Karte laden/ }))

    const karte = screen.getByTestId('karte')
    expect(window.getComputedStyle(karte.parentElement as Element).height).toBe(
      '300px'
    )
    expect(
      screen.queryByRole('region', { name: 'Kartenhinweis' })
    ).not.toBeInTheDocument()
    expect(window.localStorage.getItem(MAP_CONSENT_KEY)).toBe('true')
  })

  it('shows the map at once when consent is stored', () => {
    window.localStorage.setItem(MAP_CONSENT_KEY, 'true')
    renderWithTheme(
      <MapConsent>
        <div data-testid="karte" />
      </MapConsent>
    )

    expect(screen.getByTestId('karte')).toBeInTheDocument()
  })
})
