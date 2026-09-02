import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import BestellenPage from './page'
import { LEGAL } from '../../config/legal'
import { getCompactHoursSummary } from '../../utils/openingHours'

describe('Bestellen Page', () => {
  it('renders a valid tel: link without whitespace', () => {
    renderWithTheme(<BestellenPage />)

    const phoneLink = screen.getByRole('link', { name: /Jetzt anrufen/ })
    expect(phoneLink).toHaveAttribute('href', LEGAL.phoneHref)
    expect(phoneLink.getAttribute('href')).not.toMatch(/\s/)
    expect(screen.getByText(LEGAL.phone)).toBeInTheDocument()
  })

  it('renders WhatsApp link and list outside of a paragraph', () => {
    renderWithTheme(<BestellenPage />)

    const waLink = screen.getByRole('link', { name: /WhatsApp öffnen/ })
    expect(waLink.getAttribute('href')).toMatch(
      /^https:\/\/wa\.me\/491706133279/
    )
    expect(screen.getByText(LEGAL.mobile)).toBeInTheDocument()

    const list = screen.getByRole('list')
    expect(list.closest('p')).toBeNull()
  })

  it('nennt als Bestellzeiten die Öffnungszeiten aus der Konfiguration', () => {
    renderWithTheme(<BestellenPage />)

    const note = screen.getByText(/Bestellungen nehmen wir/)
    expect(note).toHaveTextContent(
      `während unserer Öffnungszeiten entgegen: ${getCompactHoursSummary()}.`
    )
    // Die alte Hardcodierung versprach Bestellannahme an Tagen und zu Zeiten,
    // an denen die Bäckerei laut Footer geschlossen ist.
    expect(note).not.toHaveTextContent(/täglich|14:00/)
  })
})
