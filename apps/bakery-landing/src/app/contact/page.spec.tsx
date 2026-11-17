import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ContactPage from './page'
import { LEGAL } from '../../config/legal'

describe('Contact Page', () => {
  it('makes the whole phone, WhatsApp and e-mail rows links with LEGAL targets', () => {
    renderWithTheme(<ContactPage />)

    for (const [label, value, href] of [
      ['Telefon', LEGAL.phone, LEGAL.phoneHref],
      ['Mobil / WhatsApp', LEGAL.mobile, LEGAL.mobileHref],
      ['E-Mail', LEGAL.email, `mailto:${LEGAL.email}`],
    ]) {
      const link = screen.getByText(label).closest('a')
      expect(link).not.toBeNull()
      expect(link).toHaveAttribute('href', href)
      // Label and number are one tap target.
      expect(link).toHaveTextContent(value)
      // A list row, not a bare link inside the list.
      expect(link?.parentElement?.tagName).toBe('LI')
    }
  })

  it('links to the order page and does not show unverified parking claim', () => {
    renderWithTheme(<ContactPage />)

    expect(
      screen.getByRole('link', { name: 'Zur Bestellseite' })
    ).toHaveAttribute('href', '/bestellen')
    expect(
      screen.getByText(/telefonisch oder per WhatsApp/)
    ).toBeInTheDocument()
    expect(screen.queryByText(/Parkpl/)).not.toBeInTheDocument()
  })

  it('renders consent-gated map instead of placeholder', () => {
    renderWithTheme(<ContactPage />)

    expect(screen.queryByText('Standort Karte')).not.toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Kartenhinweis' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Karte laden/ })
    ).toBeInTheDocument()
  })
})
