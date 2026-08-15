import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ContactPage from './page'
import { LEGAL } from '../../config/legal'

describe('Contact Page', () => {
  it('renders phone and mobile/WhatsApp contact links', () => {
    renderWithTheme(<ContactPage />)

    expect(screen.getByRole('link', { name: LEGAL.phone })).toHaveAttribute(
      'href',
      LEGAL.phoneHref
    )
    expect(screen.getByText('Mobil / WhatsApp')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: LEGAL.mobile })).toHaveAttribute(
      'href',
      LEGAL.mobileHref
    )
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
