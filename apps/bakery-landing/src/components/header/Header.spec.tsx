import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import { usePathname } from 'next/navigation'
import { Header } from './index'
import { LEGAL } from '../../config/legal'

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
}))

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>

const LINKS = [
  ['Sortiment', '/products'],
  ['Neuigkeiten', '/news'],
  ['Über uns', '/about'],
  ['Kontakt', '/contact'],
  ['Bestellen', '/bestellen'],
] as const

/**
 * Die Desktop-Leiste ist per Media Query nur ab `md` sichtbar; jsdom wertet
 * Media Queries nicht aus und sieht sie deshalb als `display: none`. Die
 * Abfragen nehmen darum versteckte Elemente mit (`hidden: true`).
 */
function desktopNav() {
  const banner = screen.getByRole('banner', { hidden: true })
  return within(banner).getByRole('navigation', {
    name: 'Hauptnavigation',
    hidden: true,
  })
}

describe('Header', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/')
  })

  it('führt alle Ziele samt Kontakt in einer Navigation „Hauptnavigation“ im Kopfbereich', () => {
    renderWithTheme(<Header />)

    const nav = desktopNav()
    for (const [label, path] of LINKS) {
      expect(
        within(nav).getByRole('link', { name: label, hidden: true })
      ).toHaveAttribute('href', path)
    }
    // Das Logo führt zur Startseite und steht ebenfalls im Kopfbereich.
    expect(
      within(screen.getByRole('banner', { hidden: true })).getByRole('link', {
        name: 'Bäckerei Heusser – Startseite',
        hidden: true,
      })
    ).toHaveAttribute('href', '/')
  })

  it('markiert die aktuelle Seite mit aria-current und ohne „false“ im Klassennamen', () => {
    mockUsePathname.mockReturnValue('/contact')
    const { container } = renderWithTheme(<Header />)

    const nav = desktopNav()
    expect(
      within(nav).getByRole('link', { name: 'Kontakt', hidden: true })
    ).toHaveAttribute('aria-current', 'page')
    for (const label of ['Sortiment', 'Neuigkeiten', 'Über uns', 'Bestellen']) {
      expect(
        within(nav).getByRole('link', { name: label, hidden: true })
      ).not.toHaveAttribute('aria-current')
    }

    const items = container.querySelectorAll('.menu-item')
    expect(items.length).toBeGreaterThan(0)
    items.forEach((item) => {
      expect(item.className).not.toMatch(/\b(false|undefined)\b/)
    })
    expect(within(nav).getByText('Kontakt').closest('.menu-item')).toHaveClass(
      'active'
    )
  })

  it('hat einen Hamburger mit mindestens 44x44 Trefferfläche', () => {
    renderWithTheme(<Header />)

    const hamburger = screen.getByRole('button', { name: 'Menü öffnen' })
    expect(hamburger).toHaveStyle({ minWidth: '44px', minHeight: '44px' })
    expect(hamburger).toHaveAttribute('aria-expanded', 'false')
  })

  it('öffnet das mobile Menü als Dialog, der sich mit „Menü schließen“ schließt', async () => {
    mockUsePathname.mockReturnValue('/about')
    renderWithTheme(<Header />)

    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))

    const dialog = await screen.findByRole('dialog', { name: 'Hauptmenü' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    const nav = within(dialog).getByRole('navigation', {
      name: 'Hauptnavigation',
    })
    for (const [label, path] of LINKS) {
      expect(within(nav).getByRole('link', { name: label })).toHaveAttribute(
        'href',
        path
      )
    }
    expect(within(nav).getByRole('link', { name: 'Über uns' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(within(nav).getByRole('link', { name: 'Bestellen' })).toHaveClass(
      'cta'
    )
    expect(
      within(dialog).getByRole('link', { name: `Anrufen: ${LEGAL.phone}` })
    ).toHaveAttribute('href', LEGAL.phoneHref)

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Menü schließen' })
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Hauptmenü' })
      ).not.toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'Menü öffnen' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })
})
