import React from 'react'
import { act, render } from '@testing-library/react'
import {
  FOCUS_CLEARANCE,
  obscuredScrollDelta,
  useFocusNotObscured,
} from './focusNotObscured'

/**
 * Review r2 (WCAG 2.4.11): beim Tabben landete der Fokus unter der klebenden
 * Speichern-Leiste („Besuch speichern“, 22 Stopps bei 390 px). jsdom kennt
 * kein Layout - Lage und Trefferprüfung werden hier nachgestellt.
 */

const VIEWPORT = 844

function rect(top: number, height: number, left = 0, width = 300) {
  return {
    top,
    bottom: top + height,
    left,
    right: left + width,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function setup() {
  document.body.innerHTML = `
    <main>
      <input id="field" aria-label="Neu Musterbrot" />
      <div id="bar" style="position: sticky; bottom: 0">
        <button id="save">Besuch speichern</button>
      </div>
    </main>
    <header id="appbar" style="position: fixed; top: 0"><button id="logout">Abmelden</button></header>
  `
  const field = document.getElementById('field') as HTMLElement
  const bar = document.getElementById('bar') as HTMLElement
  const appbar = document.getElementById('appbar') as HTMLElement
  const save = document.getElementById('save') as HTMLElement
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: VIEWPORT,
  })
  bar.getBoundingClientRect = () => rect(764, 80, 0, 390)
  appbar.getBoundingClientRect = () => rect(0, 56, 0, 390)
  save.getBoundingClientRect = () => rect(780, 48)
  return { field, bar, appbar, save }
}

/** Was liegt bei y ganz oben? Leiste unten ab 764, AppBar oben bis 56. */
function hitTest(field: HTMLElement, bar: HTMLElement, appbar: HTMLElement) {
  document.elementFromPoint = ((_x: number, y: number) => {
    if (y >= 764) return bar
    if (y < 56) return appbar
    return field
  }) as typeof document.elementFromPoint
}

describe('obscuredScrollDelta', () => {
  it('Feld unter der Speichern-Leiste: so weit nach unten, dass es mit Abstand darüber steht', () => {
    const { field, bar, appbar } = setup()
    hitTest(field, bar, appbar)
    field.getBoundingClientRect = () => rect(770, 44)
    expect(obscuredScrollDelta(field)).toBe(770 + 44 - 764 + FOCUS_CLEARANCE)
  })

  it('Feld ragt unten aus dem Fenster und liegt halb unter der Leiste: trotzdem nach unten', () => {
    // Review r2, Vorlagen bei 1180 × 820: die Mitte des Feldes lag unter der
    // Mitte der Leiste - es wurde nach oben „befreit“ (und dabei verdeckt).
    const { field, bar, appbar } = setup()
    hitTest(field, bar, appbar)
    field.getBoundingClientRect = () => rect(820, 44)
    expect(obscuredScrollDelta(field)).toBeGreaterThan(0)
  })

  it('Feld unter der AppBar (Shift+Tab): nach oben', () => {
    const { field, bar, appbar } = setup()
    hitTest(field, bar, appbar)
    field.getBoundingClientRect = () => rect(20, 44)
    expect(obscuredScrollDelta(field)).toBe(-(56 - 20 + FOCUS_CLEARANCE))
  })

  it('freies Feld und Knöpfe in der Leiste selbst: nichts tun', () => {
    const { field, bar, appbar, save } = setup()
    hitTest(field, bar, appbar)
    field.getBoundingClientRect = () => rect(300, 44)
    expect(obscuredScrollDelta(field)).toBe(0)
    expect(obscuredScrollDelta(save)).toBe(0)
  })

  it('Leiste in einem eigenen Scroll-Container (Tabellenkopf): nicht das Fenster schieben', () => {
    const { field, bar, appbar } = setup()
    const box = document.createElement('div')
    box.style.overflowY = 'auto'
    bar.parentElement?.insertBefore(box, bar)
    box.appendChild(bar)
    hitTest(field, bar, appbar)
    field.getBoundingClientRect = () => rect(770, 44)
    expect(obscuredScrollDelta(field)).toBe(0)
  })
})

function Harness() {
  useFocusNotObscured()
  return null
}

describe('useFocusNotObscured', () => {
  it('schiebt das Fenster nach einem Fokuswechsel unter die Leiste', () => {
    const { field, bar, appbar } = setup()
    hitTest(field, bar, appbar)
    field.getBoundingClientRect = () => rect(770, 44)
    const scrollBy = jest.fn()
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy
    const raf = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb(0)
        return 1
      })
    const host = document.createElement('div')
    document.body.appendChild(host)
    render(<Harness />, { container: host })
    act(() => field.focus())
    expect(scrollBy).toHaveBeenCalledWith({
      top: 770 + 44 - 764 + FOCUS_CLEARANCE,
      behavior: 'instant',
    })
    raf.mockRestore()
  })
})
