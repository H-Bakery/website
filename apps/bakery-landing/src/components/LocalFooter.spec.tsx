import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import { LocalFooter } from './LocalFooter'
import { LEGAL } from '../config/legal'

describe('LocalFooter', () => {
  it('renders clickable phone and mobile numbers', () => {
    renderWithTheme(<LocalFooter />)

    expect(
      screen.getByRole('link', { name: `Tel: ${LEGAL.phone}` })
    ).toHaveAttribute('href', LEGAL.phoneHref)
    expect(
      screen.getByRole('link', { name: `Mobil / WhatsApp: ${LEGAL.mobile}` })
    ).toHaveAttribute('href', LEGAL.mobileHref)
  })

  it('renders social links with accessible labels', () => {
    renderWithTheme(<LocalFooter />)

    for (const name of ['Facebook', 'Instagram', 'WhatsApp']) {
      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/491706133279'
    )
  })
})
