/**
 * Zeiger, Mausrad und Tasten der Nahansicht: Ziehen dreht, zwei Finger oder
 * das Mausrad zoomen, Pfeiltasten und +/- tun dasselbe. Ohne three; die
 * Rechnung steht in drehteller.ts (drehtellerControls.spec.ts).
 */
import { drehe, zoome, type Drehteller } from './drehteller'

export interface DrehtellerControls {
  dispose: () => void
}

export interface DrehtellerControlsOptions {
  element: HTMLElement
  /** Der aktuelle Zustand und die untere Zoomgrenze (ändert sich mit der Bildgröße). */
  lies: () => { zustand: Drehteller; zoomMin: number }
  /** Ein neuer Zustand nach einer Geste. */
  setze: (zustand: Drehteller) => void
  /** Vor jeder Bedienung - beendet die Runde vom Öffnen. */
  onGeste?: () => void
}

/** Schritt der Pfeiltasten in Pixeln Ziehen (≈ 9°). */
export const TASTEN_SCHRITT_PX = 20
/** Zoomfaktor je Tastendruck auf + oder -. */
export const TASTEN_ZOOM = 0.85
/** Zoom des Mausrads je Pixel Rollen. */
export const RAD_JE_PX = 0.0015

export function createDrehtellerControls(
  o: DrehtellerControlsOptions
): DrehtellerControls {
  const { element } = o
  /** Aktive Zeiger mit ihrer letzten Position. */
  const zeiger = new Map<number, { x: number; y: number }>()
  /** Abstand der zwei Finger beim letzten Ereignis. */
  let spanne = 0

  const aendere = (f: (s: Drehteller, zoomMin: number) => Drehteller) => {
    o.onGeste?.()
    const { zustand, zoomMin } = o.lies()
    o.setze(f(zustand, zoomMin))
  }

  const abstand = () => {
    const [a, b] = [...zeiger.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  const onDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    zeiger.set(event.pointerId, { x: event.clientX, y: event.clientY })
    try {
      element.setPointerCapture(event.pointerId)
    } catch {
      /* Zeiger schon weg */
    }
    spanne = abstand()
    o.onGeste?.()
  }

  const onMove = (event: PointerEvent) => {
    const vorher = zeiger.get(event.pointerId)
    if (!vorher) return
    const jetzt = { x: event.clientX, y: event.clientY }
    zeiger.set(event.pointerId, jetzt)
    if (zeiger.size === 1) {
      const dx = jetzt.x - vorher.x
      const dy = jetzt.y - vorher.y
      if (dx !== 0 || dy !== 0) aendere((s, min) => drehe(s, dx, dy, min))
      return
    }
    // Zwei Finger: Auseinanderziehen holt das Produkt näher.
    const neu = abstand()
    if (spanne > 0 && neu > 0) {
      const faktor = spanne / neu
      aendere((s, min) => zoome(s, faktor, min))
    }
    spanne = neu
  }

  const onUp = (event: PointerEvent) => {
    if (!zeiger.delete(event.pointerId)) return
    try {
      element.releasePointerCapture(event.pointerId)
    } catch {
      /* nicht mehr gefangen */
    }
    spanne = abstand()
  }

  const onWheel = (event: WheelEvent) => {
    // Sonst scrollt oder zoomt die Seite mit.
    event.preventDefault()
    const pixel = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    const faktor = Math.exp(Math.max(-200, Math.min(200, pixel)) * RAD_JE_PX)
    aendere((s, min) => zoome(s, faktor, min))
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const p = TASTEN_SCHRITT_PX
    const tat: Record<string, (s: Drehteller, min: number) => Drehteller> = {
      ArrowLeft: (s, min) => drehe(s, -p, 0, min),
      ArrowRight: (s, min) => drehe(s, p, 0, min),
      ArrowUp: (s, min) => drehe(s, 0, -p, min),
      ArrowDown: (s, min) => drehe(s, 0, p, min),
      '+': (s, min) => zoome(s, TASTEN_ZOOM, min),
      '=': (s, min) => zoome(s, TASTEN_ZOOM, min),
      '-': (s, min) => zoome(s, 1 / TASTEN_ZOOM, min),
    }
    const f = tat[event.key]
    if (!f) return
    event.preventDefault()
    aendere(f)
  }

  // Der Browser darf auf dem Bild weder scrollen noch selbst zoomen.
  element.style.touchAction = 'none'
  element.addEventListener('pointerdown', onDown)
  element.addEventListener('pointermove', onMove)
  element.addEventListener('pointerup', onUp)
  element.addEventListener('pointercancel', onUp)
  element.addEventListener('wheel', onWheel, { passive: false })
  element.addEventListener('keydown', onKey)

  return {
    dispose: () => {
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
      element.removeEventListener('pointercancel', onUp)
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('keydown', onKey)
      zeiger.clear()
    },
  }
}
