import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import NotFound, { metadata } from './not-found'
import { LEGAL } from '../config/legal'

describe('404-Seite', () => {
  it('bietet Startseite und Sortiment an', () => {
    renderWithTheme(<NotFound />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Seite nicht gefunden' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Zur Startseite' })
    ).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Zum Sortiment' })).toHaveAttribute(
      'href',
      '/products'
    )
  })

  it('verlinkt die Telefonnummer aus LEGAL', () => {
    renderWithTheme(<NotFound />)

    expect(
      screen.getByRole('link', { name: `Rufen Sie uns an: ${LEGAL.phone}` })
    ).toHaveAttribute('href', LEGAL.phoneHref)
  })

  it('hat einen eigenen Titel und nimmt das „index, follow“ des Layouts zurück', () => {
    expect(metadata.title).toBe('Seite nicht gefunden – Bäckerei Heusser')
    // Das noindex setzt Next für 404-Antworten selbst (siehe not-found.tsx).
    expect(metadata.robots).toBeNull()
  })
})
