import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import { FOOTER_WAPPEN_SRC, LocalFooter } from './LocalFooter'
import { LEGAL } from '../config/legal'
import { createWhatsAppLink } from '../config/contact'

jest.mock('../config/contact', () => {
  const contact = jest.requireActual('../config/contact')
  contact.contactConfig.whatsapp.number = '15550100000'
  return contact
})

describe('LocalFooter', () => {
  it('renders clickable phone and mobile numbers', () => {
    renderWithTheme(<LocalFooter />)

    expect(
      screen.getByRole('link', { name: `Tel: ${LEGAL.phone}` })
    ).toHaveAttribute('href', LEGAL.phoneHref)
    expect(
      screen.getByRole('link', { name: `Mobil / WhatsApp: ${LEGAL.mobile}` })
    ).toHaveAttribute('href', LEGAL.mobileHref)
    expect(screen.getByRole('link', { name: LEGAL.email })).toHaveAttribute(
      'href',
      `mailto:${LEGAL.email}`
    )
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
      createWhatsAppLink(null)
    )
  })

  it('is the page footer landmark', () => {
    renderWithTheme(<LocalFooter />)

    const footer = screen.getByRole('contentinfo')
    expect(footer.tagName).toBe('FOOTER')
  })

  it('addresses customers with "Sie"', () => {
    renderWithTheme(<LocalFooter />)

    expect(
      screen.getByText('Wir backen mit Herz, nach Tradition und nur für Sie.')
    ).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).not.toHaveTextContent(/euch/)
  })

  it('adds no headings to the page outline', () => {
    renderWithTheme(<LocalFooter />)

    expect(screen.queryAllByRole('heading')).toHaveLength(0)
    for (const title of [
      'Bäckerei Heusser',
      'Navigation',
      'Kontakt',
      'Öffnungszeiten',
    ]) {
      expect(screen.getByText(title, { selector: 'p' })).toBeInTheDocument()
    }
  })

  it('links the pages and the legal notes', () => {
    renderWithTheme(<LocalFooter />)

    for (const [name, href] of [
      ['Sortiment', '/products'],
      ['Neuigkeiten', '/news'],
      ['Über uns', '/about'],
      ['Kontakt', '/contact'],
      ['Impressum', '/imprint'],
      ['Datenschutz', '/datenschutz'],
    ]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
    }
  })

  it('loads the crest as a decorative image instead of inline path data', () => {
    const { container } = renderWithTheme(<LocalFooter />)

    const crest = container.querySelector('img')
    expect(crest).not.toBeNull()
    expect(crest).toHaveAttribute('alt', '')
    expect(crest).toHaveAttribute('src', FOOTER_WAPPEN_SRC)
    expect(FOOTER_WAPPEN_SRC).toBe('/assets/images/brand/wappen.svg')
    expect(crest).toHaveAttribute('loading', 'lazy')
    expect(crest).toHaveAttribute('aria-hidden', 'true')

    // The first path of the crest - it must not be in the HTML any more.
    expect(container.innerHTML).not.toContain('M322.147 236.334')
    expect(container.querySelectorAll('path').length).toBeLessThan(10)
  })
})
