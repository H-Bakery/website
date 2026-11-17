import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { CONTENT_WIDE_MIN, useContentWide } from './useContentWide'

/** Seitenleiste ab `md` (admin/layout.tsx) und Seitenrand ab `sm` (2 × 24 px). */
const DRAWER = 280
const GUTTER = 24

function Probe({ minWidth }: { minWidth?: number }) {
  return <span data-testid="wide">{String(useContentWide(minWidth))}</span>
}

const shown = () => screen.getByTestId('wide').textContent

/** `matchMedia` wie ein Fenster mit `width` px (nur `min-width`-Abfragen). */
function viewport(width: number) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => {
    const min = /min-width:\s*([\d.]+)px/.exec(query)
    return {
      matches: min ? width >= Number(min[1]) : false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }
  }) as unknown as typeof window.matchMedia
}

const originalMatchMedia = window.matchMedia
const originalResizeObserver = global.ResizeObserver
const clientWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'clientWidth'
)

afterEach(() => {
  window.matchMedia = originalMatchMedia
  global.ResizeObserver = originalResizeObserver
  if (clientWidth) {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth)
  }
})

describe('useContentWide', () => {
  describe('ohne Messung (Server, erster Render, kein <main>): Fenster ab lg', () => {
    it.each([
      [1024, 'false'],
      [1180, 'false'],
      [1280, 'true'],
      [1440, 'true'],
    ])('%i px → %s', (width, expected) => {
      viewport(width)
      render(<Probe />)
      expect(shown()).toBe(expected)
    })
  })

  describe('misst die Inhaltsfläche neben der Seitenleiste (<main>)', () => {
    let observed: ResizeObserverCallback[] = []

    /** Fenster `width` px: <main> ist so breit minus Seitenleiste ab md. */
    function screenOf(width: number) {
      viewport(width)
      const main = width - (width >= 900 ? DRAWER : 0)
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get() {
          return this.tagName === 'MAIN' ? main : 0
        },
      })
    }

    function renderInMain(minWidth?: number) {
      return render(
        <main style={{ padding: GUTTER }}>
          <Probe minWidth={minWidth} />
        </main>
      )
    }

    beforeEach(() => {
      observed = []
      global.ResizeObserver = jest.fn().mockImplementation((callback) => {
        observed.push(callback)
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        }
      }) as unknown as typeof ResizeObserver
    })

    it.each([
      // 1024 - 280 - 48 = 696 px Inhalt: Summe, Status und Stornieren lagen
      // seitlich außer Sicht.
      [1024, 'false'],
      [1180, 'false'],
      // 1200 px ist schon `lg`, neben der Leiste bleiben aber nur 872 px.
      [1200, 'false'],
      [1280, 'true'],
      [1440, 'true'],
    ])('Tablet/PC mit %i px → %s', (width, expected) => {
      screenOf(width)
      renderInMain()
      expect(shown()).toBe(expected)
    })

    it('folgt dem Drehen des Tablets (ResizeObserver)', () => {
      screenOf(1440)
      renderInMain()
      expect(shown()).toBe('true')
      act(() => {
        observed[0](
          [{ contentRect: { width: 1024 - DRAWER - 2 * GUTTER } }] as never,
          {} as ResizeObserver
        )
      })
      expect(shown()).toBe('false')
      act(() => {
        observed[0](
          [{ contentRect: { width: CONTENT_WIDE_MIN } }] as never,
          {} as ResizeObserver
        )
      })
      expect(shown()).toBe('true')
    })

    it('nimmt eine eigene Mindestbreite', () => {
      screenOf(1180)
      renderInMain(800)
      expect(shown()).toBe('true')
    })
  })
})
