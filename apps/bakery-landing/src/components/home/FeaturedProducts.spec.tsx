import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import FeaturedProducts, { AUTOPLAY_MS } from './FeaturedProducts'
import { Product } from '../../types/product'

/** Erfundene Produkte - nur Name und Kategorie zählen hier. */
const PRODUCTS: Product[] = [
  { id: 101, name: 'Testbrot Alpha', category: 'Brot', price: 1 },
  { id: 102, name: 'Testbrötchen Beta', category: 'Brötchen', price: 1 },
  { id: 103, name: 'Testkuchen Gamma', category: 'Kuchen', price: 1 },
  { id: 104, name: 'Testteilchen Delta', category: 'Teilchen', price: 1 },
]

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion: reduce'),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }))
}

function dot(n: number) {
  return screen.getByRole('button', {
    name: `Produkt ${n} von ${PRODUCTS.length}`,
  })
}

/** Nummer des Punkts mit aria-current (1-basiert), sonst 0. */
function currentDot() {
  return (
    PRODUCTS.findIndex(
      (_, i) => dot(i + 1).getAttribute('aria-current') === 'true'
    ) + 1
  )
}

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
}

describe('FeaturedProducts', () => {
  const originalMatchMedia = window.matchMedia
  const originalScrollTo = Element.prototype.scrollTo

  beforeEach(() => {
    jest.useFakeTimers()
    // jsdom kennt Element.scrollTo nicht.
    Element.prototype.scrollTo = jest.fn()
    mockReducedMotion(false)
  })

  afterEach(() => {
    jest.useRealTimers()
    window.matchMedia = originalMatchMedia
    Element.prototype.scrollTo = originalScrollTo
  })

  it('blättert bei „Bewegung reduzieren“ nicht von selbst weiter', () => {
    mockReducedMotion(true)
    renderWithTheme(<FeaturedProducts products={PRODUCTS} />)

    expect(currentDot()).toBe(1)
    advance(15_000)
    expect(currentDot()).toBe(1)
    expect(
      screen.getByRole('button', {
        name: 'Automatisches Weiterblättern starten',
      })
    ).toBeInTheDocument()
  })

  it('blättert ohne Einstellung weiter - bis jemand ins Karussell tippt', () => {
    renderWithTheme(<FeaturedProducts products={PRODUCTS} />)

    advance(AUTOPLAY_MS)
    expect(currentDot()).toBe(2)
    advance(AUTOPLAY_MS)
    expect(currentDot()).toBe(3)

    fireEvent.pointerDown(screen.getByText('Testbrot Alpha'))
    advance(15_000)
    expect(currentDot()).toBe(3)
  })

  it('bleibt nach einer Berührung (touchstart) stehen', () => {
    renderWithTheme(<FeaturedProducts products={PRODUCTS} />)

    fireEvent.touchStart(screen.getByText('Testkuchen Gamma'))
    advance(15_000)
    expect(currentDot()).toBe(1)
  })

  it('bleibt nach seitlichem Scrollen stehen, nicht aber, wenn die Seite daran vorbei scrollt', () => {
    renderWithTheme(<FeaturedProducts products={PRODUCTS} />)
    const card = screen.getByText('Testbrot Alpha')

    // Mausrad senkrecht: Die Seite scrollt am Karussell vorbei.
    fireEvent.wheel(card, { deltaX: 0, deltaY: 120 })
    advance(AUTOPLAY_MS)
    expect(currentDot()).toBe(2)

    // Trackpad seitlich: Das ist Blättern im Karussell.
    fireEvent.wheel(card, { deltaX: 80, deltaY: 4 })
    advance(15_000)
    expect(currentDot()).toBe(2)
  })

  it('bleibt nach Mausrad mit Umschalttaste (seitlich) stehen', () => {
    renderWithTheme(<FeaturedProducts products={PRODUCTS} />)

    fireEvent.wheel(screen.getByText('Testbrot Alpha'), {
      deltaY: 120,
      shiftKey: true,
    })
    advance(15_000)
    expect(currentDot()).toBe(1)
  })

  it('hält mit dem Knopf an und startet wieder', () => {
    renderWithTheme(<FeaturedProducts products={PRODUCTS} />)

    const pause = screen.getByRole('button', {
      name: 'Automatisches Weiterblättern anhalten',
    })
    // Wie ein echter Klick: pointerdown, dann click.
    fireEvent.pointerDown(pause)
    fireEvent.click(pause)
    advance(15_000)
    expect(currentDot()).toBe(1)

    const play = screen.getByRole('button', {
      name: 'Automatisches Weiterblättern starten',
    })
    fireEvent.pointerDown(play)
    fireEvent.click(play)
    // Bewusst gestartet: blättert auch, solange die Maus darüber steht.
    fireEvent.mouseEnter(play)
    advance(AUTOPLAY_MS)
    expect(currentDot()).toBe(2)
  })

  it('pausiert nur vorübergehend, solange die Maus darüber steht', () => {
    renderWithTheme(<FeaturedProducts products={PRODUCTS} />)
    const heading = screen.getByRole('heading', {
      name: 'Frisch aus der Backstube',
    })

    fireEvent.mouseEnter(heading)
    advance(15_000)
    expect(currentDot()).toBe(1)

    fireEvent.mouseLeave(heading)
    advance(AUTOPLAY_MS)
    expect(currentDot()).toBe(2)
  })

  it('hat Punkte als Knöpfe; Enter auf Punkt 3 wählt ihn aus', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderWithTheme(<FeaturedProducts products={PRODUCTS} />)

    PRODUCTS.forEach((_, i) => {
      expect(dot(i + 1).tagName).toBe('BUTTON')
    })
    expect(currentDot()).toBe(1)

    act(() => dot(3).focus())
    await user.keyboard('{Enter}')

    expect(currentDot()).toBe(3)
    expect(dot(1)).not.toHaveAttribute('aria-current')
    expect(Element.prototype.scrollTo).toHaveBeenCalled()

    // Die Tastatur hat das Weiterblättern beendet - auch ohne Fokus darin.
    act(() => dot(3).blur())
    advance(15_000)
    expect(currentDot()).toBe(3)
  })
})
