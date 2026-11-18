import React from 'react'
import { screen } from '@testing-library/react'
import Hinweis, { HINWEIS_TEXT, HINWEIS_TEXT_MAUS } from './Hinweis'
import ThemeRegistry from './ThemeRegistry'
import { zeige } from './testdaten'

/** Alle CSS-Regeln, die MUI/Emotion bisher eingefügt hat. */
const regeln = () =>
  [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules])

/** Gilt die Regel für das Element? (jsdom kennt nicht jeden Selektor.) */
const giltFuer = (element: Element, regel: CSSStyleRule) => {
  try {
    return element.matches(regel.selectorText)
  } catch {
    return false
  }
}

describe('Hinweis', () => {
  it('zeigt den Bedienhinweis', () => {
    zeige(<Hinweis sichtbar />)
    expect(HINWEIS_TEXT).toBe('Ziehen zum Umschauen · Tippen für Infos')
    expect(screen.getByText(HINWEIS_TEXT)).toBeVisible()
    const hinweis = screen.getByTestId('hinweis')
    expect(hinweis).toHaveAttribute('data-sichtbar', 'true')
    expect(hinweis).not.toHaveAttribute('aria-hidden', 'true')
  })

  it('nennt mit Touch das Tippen, mit der Maus das Klicken', () => {
    zeige(<Hinweis sichtbar />)
    expect(HINWEIS_TEXT_MAUS).toBe('Ziehen zum Umschauen · Klicken für Infos')
    // jsdom hat keine Maus (die Medienabfrage gilt nicht): der Touch-Text.
    const touch = screen.getByText(HINWEIS_TEXT)
    const maus = screen.getByText(HINWEIS_TEXT_MAUS)
    expect(touch).toBeVisible()
    expect(maus).not.toBeVisible()
    // Mit Maus tauschen die beiden - allein per CSS, ohne Gerätespeicher.
    const mitMaus = regeln().filter(
      (regel) =>
        regel instanceof CSSMediaRule &&
        regel.conditionText === '(hover: hover) and (pointer: fine)'
    ) as CSSMediaRule[]
    const anzeige = (element: HTMLElement) =>
      mitMaus
        .flatMap((regel) => [...regel.cssRules] as CSSStyleRule[])
        .filter((regel) => giltFuer(element, regel))
        .map((regel) => regel.style.display)
    expect(new Set(anzeige(touch))).toEqual(new Set(['none']))
    expect(new Set(anzeige(maus))).toEqual(new Set(['inline']))
  })

  it('ein eigener Text gilt für alle Geräte', () => {
    zeige(<Hinweis sichtbar text="Hier gibt es nichts zum Antippen." />)
    expect(screen.getByTestId('hinweis')).toHaveTextContent(
      /^Hier gibt es nichts zum Antippen\.$/
    )
    expect(screen.queryByText(HINWEIS_TEXT)).not.toBeInTheDocument()
    expect(screen.queryByText(HINWEIS_TEXT_MAUS)).not.toBeInTheDocument()
  })

  it('steht über der gemessenen Höhe der Leiste', () => {
    zeige(<Hinweis sichtbar />)
    const unten = regeln()
      .filter((regel): regel is CSSStyleRule => regel instanceof CSSStyleRule)
      .filter((regel) => giltFuer(screen.getByTestId('hinweis'), regel))
      .map((regel) => regel.style.bottom)
      .filter(Boolean)
    expect(new Set(unten)).toEqual(
      new Set([
        'calc(max(8px, env(safe-area-inset-bottom)) + var(--leiste-hoehe, 104px) + 16px)',
      ])
    )
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
    const mitUebergang = regeln().filter((regel) =>
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
