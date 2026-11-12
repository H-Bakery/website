import React from 'react'
import { screen } from '@testing-library/react'
import Hinweis, { HINWEIS_TEXT } from './Hinweis'
import ThemeRegistry from './ThemeRegistry'
import { zeige } from './testdaten'

describe('Hinweis', () => {
  it('zeigt den Bedienhinweis', () => {
    zeige(<Hinweis sichtbar />)
    expect(HINWEIS_TEXT).toBe('Ziehen zum Umschauen · Tippen für Infos')
    const hinweis = screen.getByText(HINWEIS_TEXT)
    expect(hinweis).toBeVisible()
    expect(hinweis).toHaveAttribute('data-sichtbar', 'true')
    expect(hinweis).not.toHaveAttribute('aria-hidden', 'true')
  })

  it('blendet aus, bleibt aber im DOM (für den Übergang)', () => {
    const view = zeige(<Hinweis sichtbar />)
    view.rerender(
      <ThemeRegistry>
        <Hinweis sichtbar={false} />
      </ThemeRegistry>
    )
    const hinweis = screen.getByTestId('hinweis')
    expect(hinweis).toHaveAttribute('data-sichtbar', 'false')
    expect(hinweis).toHaveAttribute('aria-hidden', 'true')
    expect(hinweis).not.toBeVisible()
    expect(hinweis).toHaveStyle({ opacity: '0' })
  })

  it('fängt keine Berührungen ab und bewegt sich nur, wenn das Gerät es erlaubt', () => {
    zeige(<Hinweis sichtbar />)
    const hinweis = screen.getByTestId('hinweis')
    expect(hinweis).toHaveStyle({ pointerEvents: 'none' })
    // Der Übergang steht nur hinter der Abfrage - ohne sie gibt es keinen.
    const regeln = [...document.styleSheets].flatMap((sheet) => [
      ...sheet.cssRules,
    ])
    const mitUebergang = regeln.filter((regel) =>
      /transition:\s*opacity/.test(regel.cssText)
    )
    expect(mitUebergang.length).toBeGreaterThan(0)
    for (const regel of mitUebergang) {
      expect(regel.cssText).toMatch(
        /^@media \(prefers-reduced-motion: no-preference\)/
      )
    }
  })
})
