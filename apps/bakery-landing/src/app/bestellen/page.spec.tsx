import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import BestellenPage from './page'
import { createPhoneLink } from '../../config/contact'
import { getCompactHoursSummary } from '../../utils/openingHours'

describe('Bestellen Page', () => {
  it('verlinkt Sortiment und Telefon und zeigt den Einstieg in den Korb', () => {
    renderWithTheme(<BestellenPage />)
    const phoneLink = screen.getByRole('link', { name: /Jetzt anrufen/ })
    expect(phoneLink).toHaveAttribute('href', createPhoneLink())
    expect(phoneLink.getAttribute('href')).not.toMatch(/\s/)
    expect(screen.getByRole('link', { name: 'Zum Sortiment' })).toHaveAttribute(
      'href',
      '/products'
    )
    expect(screen.getByRole('button', { name: 'Korb öffnen' })).toHaveAttribute(
      'aria-haspopup',
      'dialog'
    )
    expect(
      screen.getByText(/Wir bestätigen Ihre Vorbestellung/)
    ).toBeInTheDocument()
  })

  it('nennt die telefonischen Kontaktzeiten aus der Konfiguration', () => {
    renderWithTheme(<BestellenPage />)
    expect(screen.getByText(/Telefonisch erreichen Sie uns/)).toHaveTextContent(
      getCompactHoursSummary()
    )
  })
})
