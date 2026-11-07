'use client'
import React from 'react'

/**
 * Fokus nie unter einer klebenden Leiste (Layout-Kit, Review r2, WCAG 2.4.11
 * „Focus Not Obscured“).
 *
 * Der Browser scrollt ein fokussiertes Feld nur, wenn es außerhalb des
 * Fensters liegt - nicht, wenn eine `position: sticky`/`fixed`-Leiste es
 * zudeckt. Mit Tab (Bluetooth-Tastatur am Backschrank) oder den
 * „nächstes Feld“-Pfeilen von iOS landete der Fokus so unter „Besuch
 * speichern“, „Vorbestellung speichern“ oder der Vorlagen-Leiste (22
 * verdeckte Stopps bei 390 px), rückwärts unter der AppBar.
 *
 * Statt in jeder Seite die Höhe ihrer Leiste nachzutragen, prüft die
 * App-Hülle nach jedem Fokuswechsel, was an der Stelle des Feldes ganz oben
 * liegt. Ist das eine klebende Leiste (oder liegt in einer), wird das
 * Fenster so weit geschoben, dass das Feld mit `FOCUS_CLEARANCE` Abstand
 * daneben steht. Leisten in Dialogen, Menüs und Schubladen, die das Feld
 * selbst enthalten, zählen nicht.
 */
export const FOCUS_CLEARANCE = 16

/** Selbst klebend oder fest positioniert - auf `document`-Ebene. */
function isPinned(element: Element): boolean {
  const position = window.getComputedStyle(element).position
  return position === 'sticky' || position === 'fixed'
}

/** Nächster klebende Vorfahr (inkl. selbst), oder `null`. */
export function findPinnedAncestor(start: Element | null): Element | null {
  let node: Element | null = start
  while (node && node !== document.body && node !== document.documentElement) {
    if (isPinned(node)) return node
    node = node.parentElement
  }
  return null
}

/**
 * Klebt die Leiste im Fenster - oder in einem eigenen Scroll-Container
 * (Tabellenkopf der Grundmengen)? Nur im Fenster hilft `window.scrollBy`.
 */
function sticksToViewport(cover: Element): boolean {
  let node = cover.parentElement
  while (node && node !== document.body && node !== document.documentElement) {
    const { overflowX, overflowY } = window.getComputedStyle(node)
    if (/(auto|scroll)/.test(overflowX + overflowY)) return false
    node = node.parentElement
  }
  return true
}

/** Das sichtbare Bedienelement um den Fokus (Switch-Input ist unsichtbar). */
function visibleTarget(element: Element): Element {
  return (
    element.closest(
      '.MuiInputBase-root, .MuiSwitch-root, .MuiCheckbox-root, .MuiRadio-root'
    ) ?? element
  )
}

function topElementAt(x: number, y: number): Element | null {
  if (typeof document.elementFromPoint !== 'function') return null
  const cx = Math.min(Math.max(x, 0), window.innerWidth - 1)
  const cy = Math.min(Math.max(y, 0), window.innerHeight - 1)
  return document.elementFromPoint(cx, cy)
}

/**
 * Wie weit muss das Fenster scrollen, damit `focused` frei steht? Positiv =
 * nach unten (Leiste unten), negativ = nach oben (AppBar), 0 = frei.
 */
export function obscuredScrollDelta(focused: Element): number {
  const target = visibleTarget(focused)
  const rect = target.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return 0
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) return 0

  const x = rect.left + rect.width / 2
  // Mitte und unterer/oberer Rand: auch ein halb verdecktes Feld zählt.
  const probes = [rect.top + rect.height / 2, rect.bottom - 2, rect.top + 2]
  for (const y of probes) {
    const hit = topElementAt(x, y)
    if (!hit || target.contains(hit) || hit.contains(target)) continue
    const cover = findPinnedAncestor(hit)
    // Das Feld steckt selbst in der Leiste (Speichern-Knopf, Dialog, Menü).
    if (!cover || cover.contains(target)) continue
    if (!sticksToViewport(cover)) continue
    const bar = cover.getBoundingClientRect()
    // Unten klebende Leiste (Speichern) oder oben (AppBar)? Entscheidet die
    // Lage der Leiste im Fenster, nicht die zum Feld: ein Feld, das unten
    // schon halb aus dem Fenster ragt, liegt mit seiner Mitte unter der
    // Mitte der Leiste - und wurde sonst nach oben „befreit“.
    const barIsBelow = bar.top + bar.height / 2 > window.innerHeight / 2
    if (barIsBelow) {
      return Math.ceil(rect.bottom - bar.top + FOCUS_CLEARANCE)
    }
    return -Math.ceil(bar.bottom - rect.top + FOCUS_CLEARANCE)
  }
  return 0
}

/**
 * Hängt die Prüfung an `focusin` des Dokuments. Gemessen wird nach dem
 * nächsten Frame, wenn der Browser sein eigenes Scrollen erledigt hat.
 */
export function useFocusNotObscured(enabled = true): void {
  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined
    let frame = 0
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof Element) || target === document.body) return
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (document.activeElement !== target) return
        const delta = obscuredScrollDelta(target)
        if (delta !== 0) {
          // sofort, nicht weich (`html { scroll-behavior: smooth }`): sonst
          // steht das Feld beim nächsten Tab noch unter der Leiste
          window.scrollBy({
            top: delta,
            behavior: 'instant' as ScrollBehavior,
          })
        }
      })
    }
    document.addEventListener('focusin', onFocusIn)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [enabled])
}
