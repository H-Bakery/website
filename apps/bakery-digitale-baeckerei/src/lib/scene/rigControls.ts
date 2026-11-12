/**
 * Kamera-Rig, der bedienende Teil: Zeiger, Finger, Mausrad und Tasten am
 * Canvas → rig.ts (Rechnung) → Kamera. Gerendert wird nur bei Bedarf: Ein
 * Animation-Frame-Takt läuft allein, solange etwas gleitet oder zurückfedert.
 *
 * - Ziehen dreht (das Bild folgt dem Finger), an den Grenzen mit Gummiband.
 * - Pinch, Mausrad und `+`/`-` ändern den Öffnungswinkel, nie den Standort.
 * - Tipp und Doppeltipp werden gemeldet (Picking macht der Aufrufer); der
 *   erste Tipp kommt sofort als `onTap`, der zweite nur als `onDoubleTap`.
 * - Zwei Finger waagerecht wischen und die Pfeiltasten melden einen Wechsel
 *   des Blickpunkts (`onWechselGeste`).
 *
 * Nutzt von three nur die Kamera, die es bekommt (Typ-Import).
 */
import type { PerspectiveCamera } from 'three'
import type { Blickpunkt, Vec3 } from '../../config/raeume'
import {
  TIPP_MAX_PX,
  blickziel,
  createRigKern,
  istDoppeltipp,
  istTipp,
  zweiFingerWisch,
  type Schwenkrest,
} from './rig'

export interface Rig {
  setBlickpunkt(bp: Blickpunkt, opts?: { animate?: boolean }): void
  /** Doppeltipp-Zoom auf einen Punkt (Öffnungswinkel + Drehung, in den Grenzen). */
  zoomTo(world: Vec3): void
  /** Wählt die Hochformat-Werte, wenn aspect < 1. */
  resize(aspect: number): void
  /** Näher als in der Startweite? */
  istGezoomt(): boolean
  /** Zurück zur Startweite (zweiter Doppeltipp). */
  zoomZurueck(): void
  /**
   * Den Blick weich drehen (Bogenmaß; + = Bild nach rechts / unten), in den
   * Grenzen. Liefert, was die Grenze abgeschnitten hat (rad), oder `null`,
   * wenn der Schwenk gerade ruht (Wechsel des Blickpunkts).
   */
  schwenken(dYaw: number, dPitch: number): Schwenkrest | null
  /** Ein Tipp, der kein Ziehen war. `zeiger` = `PointerEvent.pointerType`. */
  onTap(cb: TippCallback): void
  onDoubleTap(cb: TippCallback): void
  /** Einmal, bei der ersten Bedienung (Hinweis ausblenden). */
  onFirstGesture(cb: () => void): void
  /** Zwei Finger gewischt oder Pfeiltaste: −1 = voriger, +1 = nächster Blickpunkt. */
  onWechselGeste(cb: (richtung: -1 | 1) => void): void
  /** Angekommen (nach dem Gleiten, beim Schneiden sofort). */
  onAnkunft(cb: (bp: Blickpunkt) => void): void
  /** Eine Fahrt oder das Zurückfedern ist zu Ende - die Kamera steht wieder. */
  onRuhe(cb: () => void): void
  /** Läuft gerade eine Fahrt oder federt der Blick zurück? */
  bewegt(): boolean
  dispose(): void
}

export type TippCallback = (
  clientX: number,
  clientY: number,
  zeiger: string
) => void

/** Mausrad: Öffnungswinkel je Pixel Raddrehung (Exponent). */
const RAD_JE_PX = 0.0015
/** Pinch auf dem Trackpad kommt als Rad mit Strg und kleinen Werten. */
const RAD_JE_PX_PINCH = 0.01
const TASTEN_ZOOM = 0.85
/** Längster Zeitschritt, damit ein Hänger keinen Sprung macht. */
const MAX_DT_MS = 64
/** Hier gehören die Pfeiltasten jemand anderem. */
const TASTEN_FREMD =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], [role="slider"], [role="tablist"], [role="listbox"], [role="menu"]'

interface Finger {
  x: number
  y: number
}

export function createRig(o: {
  camera: PerspectiveCamera
  element: HTMLElement
  requestRender: () => void
  reducedMotion: boolean
}): Rig {
  const { camera, element, requestRender } = o
  const kern = createRigKern({ reducedMotion: o.reducedMotion })
  kern.resize(camera.aspect)

  let disposed = false
  let raf = 0
  let zuletzt = 0
  let tap: TippCallback | null = null
  let doubleTap: TippCallback | null = null
  let firstGesture: (() => void) | null = null
  let wechselGeste: ((richtung: -1 | 1) => void) | null = null
  let ankunftCb: ((bp: Blickpunkt) => void) | null = null
  let ruheCb: (() => void) | null = null
  let ersteGesteGemeldet = false

  const finger = new Map<number, Finger>()
  /** Ein Finger: Start, letzter Stand, ob schon gezogen wird. */
  let start: { x: number; y: number; zeit: number } | null = null
  let letzter: Finger | null = null
  let ziehtGerade = false
  /** In dieser Berührung waren zwei Finger im Spiel - kein Tipp, kein Ziehen mehr. */
  let mehrfinger = false
  let zwei: {
    abstand: number
    mx: number
    my: number
    fov: number
    letzterAbstand: number
    letztesMx: number
    letztesMy: number
  } | null = null
  let letzterTipp: { x: number; y: number; zeit: number } | null = null

  const vorherTouchAction = element.style.touchAction
  element.style.touchAction = 'none'

  const anwenden = () => {
    const pose = kern.pose()
    if (pose) {
      const ziel = blickziel(pose.eye, pose.yaw, pose.pitch)
      camera.position.set(pose.eye[0], pose.eye[1], pose.eye[2])
      camera.up.set(0, 1, 0)
      camera.lookAt(ziel[0], ziel[1], ziel[2])
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
      requestRender()
    }
    const angekommen = kern.nimmAnkunft()
    if (angekommen) ankunftCb?.(angekommen)
  }

  const takt = (jetzt: number) => {
    raf = 0
    if (disposed) return
    const dt = Math.min(Math.max(jetzt - zuletzt, 0), MAX_DT_MS)
    zuletzt = jetzt
    const weiter = kern.schritt(dt)
    anwenden()
    if (weiter) raf = requestAnimationFrame(takt)
    else ruheCb?.()
  }

  /** Kamera nachführen und den Takt nur starten, wenn sich noch etwas bewegt. */
  const aktualisieren = () => {
    if (disposed) return
    anwenden()
    if (kern.bewegt() && !raf) {
      zuletzt = performance.now()
      raf = requestAnimationFrame(takt)
    }
  }

  const meldeErsteGeste = () => {
    if (ersteGesteGemeldet) return
    ersteGesteGemeldet = true
    firstGesture?.()
  }

  /** Bogenmaß je Pixel: Das Bild folgt dem Finger (genau in der Bildmitte). */
  const jePixel = () =>
    (camera.fov * Math.PI) / 180 / Math.max(element.clientHeight, 1)

  const zweiFinger = (): [Finger, Finger] | null => {
    if (finger.size !== 2) return null
    const [a, b] = Array.from(finger.values())
    return [a, b]
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    meldeErsteGeste()
    finger.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try {
      element.setPointerCapture?.(e.pointerId)
    } catch {
      /* Zeiger schon weg */
    }
    if (finger.size === 1) {
      start = { x: e.clientX, y: e.clientY, zeit: e.timeStamp }
      letzter = { x: e.clientX, y: e.clientY }
      ziehtGerade = false
      mehrfinger = false
      return
    }
    mehrfinger = true
    if (ziehtGerade) {
      ziehtGerade = false
      kern.loslassen()
      aktualisieren()
    }
    const paar = zweiFinger()
    if (paar) {
      const [a, b] = paar
      const abstand = Math.hypot(a.x - b.x, a.y - b.y)
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      zwei = {
        abstand,
        mx,
        my,
        fov: camera.fov,
        letzterAbstand: abstand,
        letztesMx: mx,
        letztesMy: my,
      }
    } else {
      zwei = null
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    const f = finger.get(e.pointerId)
    if (!f) return
    f.x = e.clientX
    f.y = e.clientY
    if (zwei) {
      const paar = zweiFinger()
      if (!paar) return
      const [a, b] = paar
      zwei.letzterAbstand = Math.hypot(a.x - b.x, a.y - b.y)
      zwei.letztesMx = (a.x + b.x) / 2
      zwei.letztesMy = (a.y + b.y) / 2
      if (zwei.abstand > 0 && zwei.letzterAbstand > 0) {
        kern.setzeFov((zwei.fov * zwei.abstand) / zwei.letzterAbstand)
        aktualisieren()
      }
      return
    }
    if (mehrfinger || !start || !letzter || finger.size !== 1) return
    if (!ziehtGerade) {
      const weg = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      if (weg <= TIPP_MAX_PX) return
      // Ab hier wird gezogen - ohne Sprung um den Weg bis zur Schwelle.
      ziehtGerade = true
      letzter = { x: e.clientX, y: e.clientY }
      return
    }
    const k = jePixel()
    kern.ziehen((e.clientX - letzter.x) * k, (e.clientY - letzter.y) * k)
    letzter = { x: e.clientX, y: e.clientY }
    aktualisieren()
  }

  const beenden = (e: PointerEvent, abgebrochen: boolean) => {
    if (!finger.has(e.pointerId)) return
    finger.delete(e.pointerId)
    try {
      element.releasePointerCapture?.(e.pointerId)
    } catch {
      /* Zeiger schon weg */
    }
    if (zwei) {
      const z = zwei
      zwei = null
      const wisch = abgebrochen
        ? null
        : zweiFingerWisch({
            dx: z.letztesMx - z.mx,
            dy: z.letztesMy - z.my,
            abstandStart: z.abstand,
            abstandEnde: z.letzterAbstand,
          })
      if (wisch) {
        // Das war kein Pinch: den nebenbei verstellten Winkel zurücknehmen.
        kern.setzeFov(z.fov)
        aktualisieren()
        wechselGeste?.(wisch)
      } else {
        aktualisieren()
      }
      return
    }
    if (finger.size > 0) return
    const s = start
    start = null
    letzter = null
    if (ziehtGerade) {
      ziehtGerade = false
      kern.loslassen()
      aktualisieren()
      return
    }
    if (abgebrochen || !s) return
    const gilt = istTipp({
      wegPx: Math.hypot(e.clientX - s.x, e.clientY - s.y),
      dauerMs: e.timeStamp - s.zeit,
      mehrfinger,
    })
    if (!gilt) return
    const jetzt = { x: e.clientX, y: e.clientY, zeit: e.timeStamp }
    if (istDoppeltipp(letzterTipp, jetzt)) {
      letzterTipp = null
      doubleTap?.(e.clientX, e.clientY, e.pointerType)
    } else {
      letzterTipp = jetzt
      tap?.(e.clientX, e.clientY, e.pointerType)
    }
  }
  const onPointerUp = (e: PointerEvent) => beenden(e, false)
  const onPointerCancel = (e: PointerEvent) => beenden(e, true)

  const onWheel = (e: WheelEvent) => {
    // Nur über dem Canvas: dort zoomt das Rad, die Seite scrollt nicht mit.
    e.preventDefault()
    meldeErsteGeste()
    const pixel =
      e.deltaMode === 1
        ? e.deltaY * 16
        : e.deltaMode === 2
        ? e.deltaY * 400
        : e.deltaY
    // Seitwärts gescrollt (Trackpad): kein Zoom - und nichts, was eine
    // laufende Fahrt anfasst.
    if (pixel === 0) return
    kern.zoomen(Math.exp(pixel * (e.ctrlKey ? RAD_JE_PX_PINCH : RAD_JE_PX)))
    aktualisieren()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    const ziel = e.target
    if (ziel instanceof Element && ziel.closest(TASTEN_FREMD)) return
    switch (e.key) {
      case 'ArrowLeft':
        wechselGeste?.(-1)
        break
      case 'ArrowRight':
        wechselGeste?.(1)
        break
      case '+':
      case '=':
        kern.zoomen(TASTEN_ZOOM)
        aktualisieren()
        break
      case '-':
      case '_':
        kern.zoomen(1 / TASTEN_ZOOM)
        aktualisieren()
        break
      default:
        return
    }
    e.preventDefault()
    meldeErsteGeste()
  }

  element.addEventListener('pointerdown', onPointerDown)
  element.addEventListener('pointermove', onPointerMove)
  element.addEventListener('pointerup', onPointerUp)
  element.addEventListener('pointercancel', onPointerCancel)
  element.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown)

  return {
    setBlickpunkt(bp, opts) {
      if (disposed) return
      kern.setBlickpunkt(bp, opts)
      aktualisieren()
    },
    zoomTo(world) {
      if (disposed) return
      kern.zoomTo(world)
      aktualisieren()
    },
    istGezoomt() {
      return !disposed && kern.istGezoomt()
    },
    zoomZurueck() {
      if (disposed) return
      kern.zoomZurueck()
      aktualisieren()
    },
    schwenken(dYaw, dPitch) {
      if (disposed) return null
      const rest = kern.schwenken(dYaw, dPitch)
      aktualisieren()
      return rest
    },
    resize(aspect) {
      if (disposed) return
      kern.resize(aspect)
      aktualisieren()
    },
    onTap(cb) {
      tap = cb
    },
    onDoubleTap(cb) {
      doubleTap = cb
    },
    onFirstGesture(cb) {
      firstGesture = cb
    },
    onWechselGeste(cb) {
      wechselGeste = cb
    },
    onAnkunft(cb) {
      ankunftCb = cb
    },
    onRuhe(cb) {
      ruheCb = cb
    },
    bewegt() {
      return !disposed && kern.bewegt()
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('pointercancel', onPointerCancel)
      element.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      for (const id of finger.keys()) {
        try {
          element.releasePointerCapture?.(id)
        } catch {
          /* Zeiger schon weg */
        }
      }
      finger.clear()
      element.style.touchAction = vorherTouchAction
      tap = doubleTap = firstGesture = wechselGeste = ankunftCb = null
      ruheCb = null
    },
  }
}
