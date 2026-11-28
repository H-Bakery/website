import * as fs from 'fs'
import * as path from 'path'
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import SocialMediaPage from './page'

jest.mock('@bakery/shared/ui', () => ({
  HeusserLogo: (props: { style?: React.CSSProperties }) => (
    <svg data-testid="heusser-logo" style={props.style} />
  ),
}))

const PLACEHOLDER = /Füllen Sie das Formular aus/

describe('Social-Media - Vorschau', () => {
  it('zeigt den Platzhalter im Textbereich der Karte, nicht darüber', () => {
    renderWithTheme(<SocialMediaPage />)

    const placeholder = screen.getByText(PLACEHOLDER)
    // Der Platzhalter steht in derselben weißen Karte wie die Vorlagen-
    // Überschrift - im Fluss, nicht absolut zentriert über der Karte (das lag
    // am Handy auf der Überschrift und war im Dark Mode hellgrau auf weiß).
    const heading = screen.getByText('TAGESANGEBOT', { selector: 'h6' })
    const card = heading.parentElement as HTMLElement
    expect(card).toContainElement(placeholder)
    expect(placeholder.compareDocumentPosition(heading)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING
    )
  })

  it('räumt den Platzhalter, sobald ein Titel eingegeben wird', () => {
    renderWithTheme(<SocialMediaPage />)

    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Dinkelbrot' },
    })

    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument()
    expect(screen.getByText('Dinkelbrot', { selector: 'h4' })).toBeVisible()
  })

  it('zeigt den Preis mit genau einem „ €“ (vorher „3,50€“ bzw. „3,50 €€“)', () => {
    renderWithTheme(<SocialMediaPage />)
    const price = screen.getByLabelText('Preis')

    fireEvent.change(price, { target: { value: '3,50' } })
    expect(screen.getByText('3,50 €', { selector: 'h3' })).toBeVisible()

    fireEvent.change(price, { target: { value: '3,50 €' } })
    expect(screen.getByText('3,50 €', { selector: 'h3' })).toBeVisible()
  })

  it('Seitenkopf aus dem Layout-Kit, ein Download-Knopf für das gewählte Format', () => {
    renderWithTheme(<SocialMediaPage />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Social Media' })
    ).toBeInTheDocument()
    // Keine Werbe-Chips und kein toter „Nur Text“-Schalter mehr.
    expect(screen.queryByText('Text-fokussierte Designs')).toBeNull()
    expect(screen.queryByLabelText('Nur Text (ohne Bilder)')).toBeNull()

    const download = screen.getByRole('button', { name: 'Bild herunterladen' })
    expect(download).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Dinkelbrot' },
    })
    expect(download).toBeEnabled()
    expect(
      screen.getAllByRole('button', {
        name: /herunterladen|1080x1080|optimiert/,
      })
    ).toHaveLength(1)
  })

  it('nennt das belegte Gründungsjahr 1933 (nicht 1952) - in Vorschau und Bild', () => {
    renderWithTheme(<SocialMediaPage />)
    expect(
      screen.getByText('Traditionelle Handwerkskunst seit 1933')
    ).toBeVisible()
    expect(document.body.textContent).not.toContain('1952')
    // Auch das heruntergeladene Bild (Canvas) nimmt den Text nur aus
    // BRAND_FACTS - im Quelltext steht kein festes Gründungsjahr mehr.
    const source = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf-8')
    expect(source).not.toContain('1952')
    expect(source).not.toMatch(/seit \d{4}/)
    expect(source).toContain('BRAND_FACTS.foundedYear')
  })
})
