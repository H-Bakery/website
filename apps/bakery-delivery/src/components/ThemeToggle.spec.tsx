import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeToggle } from './ThemeToggle'
import { THEME_STORAGE_KEY } from '../lib/theme'

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  /**
   * Regression-Schutz: liest die Komponente den Speicher schon *waehrend* des
   * Renderns, weicht das Server-Markup vom hydrierten ab und React verwirft den
   * Baum (im Repo aktenkundig, siehe TASK-040). `renderToStaticMarkup` fuehrt
   * keine Effects aus - was hier trotzdem an `localStorage` ginge, ginge im
   * Render-Durchlauf daneben.
   */
  it('liest beim ersten Render nichts aus localStorage', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    // jsdom laesst `localStorage` nicht ausspionieren - also wird die
    // Eigenschaft fuer die Dauer des Renders durch einen Zaehler ersetzt.
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    const reads: string[] = []
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem(key: string) {
          reads.push(key)
          return 'dark'
        },
        setItem() {
          /* nicht Thema dieses Tests */
        },
      },
      configurable: true,
    })

    let markup: string
    try {
      markup = renderToStaticMarkup(<ThemeToggle />)
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original)
    }

    expect(reads).toEqual([])
    // Serverseitig steht immer "System" auf aktiv - genau das rendert der
    // Client im ersten Durchlauf ebenfalls.
    expect(markup).toContain('aria-pressed="true"')
    expect(markup.indexOf('aria-pressed="true"')).toBeLessThan(
      markup.indexOf('Hell')
    )
  })

  it('uebernimmt die gespeicherte Wahl erst im Effect', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    render(<ThemeToggle />)

    expect(
      screen
        .getByRole('button', { name: 'Farbschema dunkel' })
        .getAttribute('aria-pressed')
    ).toBe('true')
    expect(
      screen
        .getByRole('button', { name: 'Farbschema wie im Betriebssystem' })
        .getAttribute('aria-pressed')
    ).toBe('false')
  })

  it('zeigt drei Zustaende in einer beschrifteten Gruppe', () => {
    render(<ThemeToggle />)

    const group = screen.getByRole('group', { name: 'Farbschema der App' })
    const labels = Array.from(group.querySelectorAll('button')).map(
      (button) => button.textContent
    )
    expect(labels).toEqual(['System', 'Hell', 'Dunkel'])
  })

  it('speichert die Wahl und setzt data-theme auf <html>', () => {
    render(<ThemeToggle />)

    fireEvent.click(screen.getByRole('button', { name: 'Farbschema dunkel' }))
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // "Hell" muss auch auf einem dunkel eingestellten Geraet gewinnen - dafuer
    // braucht es das Attribut, nicht nur dessen Fehlen.
    fireEvent.click(screen.getByRole('button', { name: 'Farbschema hell' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    fireEvent.click(
      screen.getByRole('button', { name: 'Farbschema wie im Betriebssystem' })
    )
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})
