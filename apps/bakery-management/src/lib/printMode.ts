'use client'
import React from 'react'
import { flushSync } from 'react-dom'

/**
 * Druckt die App gerade? (Review r2, Druck aus dem Dunkelmodus)
 *
 * MUI rechnet Farben beim Rendern aus der Palette aus - `color-scheme: light`
 * in `global.css` ändert daran nichts. Eine Seite ohne eigene Druckansicht
 * (Kassentag, Analysen, Partner) kam aus dem Dunkelmodus deshalb mit heller
 * Schrift aufs Papier: ohne „Hintergrundgrafiken“ hellgrau auf Weiß, mit
 * ihnen ein schwarzes Blatt. `MuiThemeBridge` (Providers.tsx) rendert
 * darum, solange gedruckt wird, mit dem hellen Theme.
 *
 * `beforeprint` (Strg+P, `window.print()`, Playwright `page.pdf()`) kommt
 * vor dem Layout für den Druck; `flushSync` rendert sofort, damit die
 * hellen Stile schon im Druckbild stehen. `matchMedia('print')` fängt die
 * Fälle ohne `beforeprint` (Druckemulation in den Entwicklerwerkzeugen).
 * Die gespeicherte Wahl hell/dunkel bleibt unberührt.
 */
export function useIsPrinting(): boolean {
  const [printing, setPrinting] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const start = () => {
      try {
        flushSync(() => setPrinting(true))
      } catch {
        // flushSync mitten in einem Render (sollte nicht vorkommen): dann
        // eben im nächsten Durchlauf.
        setPrinting(true)
      }
    }
    const stop = () => setPrinting(false)
    window.addEventListener('beforeprint', start)
    window.addEventListener('afterprint', stop)

    const query =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('print')
        : null
    const onChange = (event: MediaQueryListEvent) =>
      event.matches ? start() : stop()
    query?.addEventListener?.('change', onChange)

    return () => {
      window.removeEventListener('beforeprint', start)
      window.removeEventListener('afterprint', stop)
      query?.removeEventListener?.('change', onChange)
    }
  }, [])

  return printing
}
