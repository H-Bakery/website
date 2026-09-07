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

  it('führt die Legenden-Chips als Seiten-Chrome ohne Markenfarben', () => {
    renderWithTheme(<SocialMediaPage />)

    for (const label of ['Text-fokussierte Designs', 'Mit Firmen-Logo']) {
      const chip = screen.getByText(label).closest('.MuiChip-root')
      expect(chip).toHaveClass('MuiChip-outlined')
      // Die Markenfarben (#D038BA, #1ADA67) erreichen auf background.paper
      // keinen Lesekontrast; die Chips folgen der Palette.
      const color = getComputedStyle(chip as Element).color
      expect(color).not.toMatch(/208, 56, 186|26, 218, 103/)
    }
  })
})
