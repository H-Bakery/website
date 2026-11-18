import type { PerspectiveCamera } from 'three'
import type { Blickpunkt, Vec3 } from '../../config/raeume'
import { WECHSEL_MS } from './rig'
import { createRig, type Rig } from './rigControls'

const GRAD = Math.PI / 180

const regal: Blickpunkt = {
  id: 'testregal',
  name: 'Testregal',
  eye: [0, 2, 0],
  look: [0, 2, 4],
  fov: 60,
  yawDeg: 20,
  pitchDeg: 12,
  fovMin: 24,
  fovMax: 60,
  portrait: { eye: [1, 2, 1], look: [5, 2, 1], fov: 70 },
  moebel: ['testregal/'],
}

const korb: Blickpunkt = {
  id: 'testkorb',
  name: 'Testkorb',
  eye: [4, 2, -3],
  look: [4, 2, -7],
  fov: 50,
  yawDeg: 20,
  pitchDeg: 12,
  fovMin: 24,
  fovMax: 50,
  moebel: ['testkorb/'],
}

/** Kamera-Attrappe: merkt sich, was das Rig setzt (kein three, kein WebGL). */
function kameraAttrappe(aspect = 1.6) {
  const kamera = {
    aspect,
    fov: 0,
    eye: [0, 0, 0] as number[],
    ziel: [0, 0, 0] as number[],
    projektionen: 0,
    position: {
      set: (x: number, y: number, z: number) => {
        kamera.eye = [x, y, z]
      },
    },
    up: { set: jest.fn() },
    lookAt: (x: number, y: number, z: number) => {
      kamera.ziel = [x, y, z]
    },
    updateProjectionMatrix: () => {
      kamera.projektionen += 1
    },
    /** Blickrichtung um die Hochachse, wie rig.ts sie zählt. */
    yaw: () =>
      Math.atan2(
        kamera.ziel[0] - kamera.eye[0],
        kamera.ziel[2] - kamera.eye[2]
      ),
    pitch: () => Math.asin(kamera.ziel[1] - kamera.eye[1]),
  }
  return kamera
}

interface Aufbau {
  rig: Rig
  kamera: ReturnType<typeof kameraAttrappe>
  element: HTMLElement
  requestRender: jest.Mock
  taps: string[]
  doppelt: string[]
  wechsel: number[]
  erste: jest.Mock
  ankunft: string[]
}

let offen: Rig[] = []

/** Größe des Canvas, wenn ein Test sie braucht (passend zu aspect 1,6). */
const BREITE = 960
const HOEHE = 600

function aufbau(
  opts: { reducedMotion?: boolean; aspect?: number; mitRahmen?: boolean } = {}
): Aufbau {
  const element = document.createElement('canvas')
  Object.defineProperty(element, 'clientHeight', { value: HOEHE })
  if (opts.mitRahmen) {
    // jsdom rechnet kein Layout: Das Canvas liegt bei (20, 10) im Fenster.
    element.getBoundingClientRect = () =>
      ({
        left: 20,
        top: 10,
        right: 20 + BREITE,
        bottom: 10 + HOEHE,
        width: BREITE,
        height: HOEHE,
        x: 20,
        y: 10,
        toJSON: () => ({}),
      } as DOMRect)
  }
  document.body.appendChild(element)
  const kamera = kameraAttrappe(opts.aspect)
  const requestRender = jest.fn()
  const rig = createRig({
    camera: kamera as unknown as PerspectiveCamera,
    element,
    requestRender,
    reducedMotion: opts.reducedMotion ?? false,
  })
  offen.push(rig)
  const a: Aufbau = {
    rig,
    kamera,
    element,
    requestRender,
    taps: [],
    doppelt: [],
    wechsel: [],
    erste: jest.fn(),
    ankunft: [],
  }
  rig.onTap((x, y) => a.taps.push(`${x},${y}`))
  rig.onDoubleTap((x, y) => a.doppelt.push(`${x},${y}`))
  rig.onWechselGeste((r) => a.wechsel.push(r))
  rig.onFirstGesture(a.erste)
  rig.onAnkunft((bp) => a.ankunft.push(bp.id))
  rig.setBlickpunkt(regal)
  return a
}

/** jsdom kennt kein PointerEvent: ein MouseEvent mit den nötigen Feldern. */
function zeiger(
  element: HTMLElement,
  typ: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  x: number,
  y: number,
  o: { id?: number; zeit?: number; pointerType?: string; button?: number } = {}
) {
  const e = new MouseEvent(typ, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: o.button ?? 0,
  })
  Object.defineProperty(e, 'pointerId', { value: o.id ?? 1 })
  Object.defineProperty(e, 'pointerType', { value: o.pointerType ?? 'touch' })
  Object.defineProperty(e, 'timeStamp', { value: o.zeit ?? 0 })
  element.dispatchEvent(e)
  return e
}

function taste(key: string, ziel: EventTarget = document.body) {
  const e = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  })
  ziel.dispatchEvent(e)
  return e
}

function rad(
  element: HTMLElement,
  deltaY: number,
  o: { x?: number; y?: number; ctrlKey?: boolean } = {}
) {
  const e = new WheelEvent('wheel', {
    deltaY,
    bubbles: true,
    cancelable: true,
    clientX: o.x ?? 0,
    clientY: o.y ?? 0,
    ctrlKey: o.ctrlKey ?? false,
  })
  element.dispatchEvent(e)
  return e
}

function fingerWeg(element: HTMLElement, cancelable = true) {
  // jsdom: TouchEvent ohne Touch-Liste genügt - es geht nur um die Standardaktion.
  const e = new Event('touchend', { bubbles: true, cancelable })
  element.dispatchEvent(e)
  return e
}

/**
 * Wo ein Weltpunkt im Bild der Kamera-Attrappe liegt, in Fenster-Pixeln (das
 * Canvas `mitRahmen`: 960×600 bei 20/10) - wie three projiziert.
 */
function imBild(
  kamera: ReturnType<typeof kameraAttrappe>,
  punkt: Vec3
): { x: number; y: number } {
  const { r, u, f } = achsen(kamera)
  const v = [0, 1, 2].map((i) => punkt[i] - kamera.eye[i])
  const tief = v[0] * f[0] + v[1] * f[1] + v[2] * f[2]
  const t = Math.tan((kamera.fov * GRAD) / 2)
  const nx =
    (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / (tief * t * kamera.aspect)
  const ny = (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / (tief * t)
  return { x: 20 + ((nx + 1) / 2) * BREITE, y: 10 + ((1 - ny) / 2) * HOEHE }
}

/** Der Weltpunkt 4 m hinter dem Bildpunkt (x, y) in Fenster-Pixeln. */
function hinterBildpunkt(
  kamera: ReturnType<typeof kameraAttrappe>,
  x: number,
  y: number
): Vec3 {
  const { r, u, f } = achsen(kamera)
  const t = Math.tan((kamera.fov * GRAD) / 2)
  const nx = (((x - 20) / BREITE) * 2 - 1) * t * kamera.aspect
  const ny = (1 - ((y - 10) / HOEHE) * 2) * t
  const d = [0, 1, 2].map((i) => f[i] + r[i] * nx + u[i] * ny)
  const l = Math.hypot(d[0], d[1], d[2])
  const [x0, y0, z0] = kamera.eye
  return [x0 + (d[0] / l) * 4, y0 + (d[1] / l) * 4, z0 + (d[2] / l) * 4]
}

/** Blick, Bild-rechts und Bild-oben der Attrappe (wie `camera.lookAt`). */
function achsen(kamera: ReturnType<typeof kameraAttrappe>) {
  const f = [0, 1, 2].map((i) => kamera.ziel[i] - kamera.eye[i])
  const lf = Math.hypot(f[0], f[1], f[2])
  for (let i = 0; i < 3; i += 1) f[i] /= lf
  // rechts = Blick × oben(0, 1, 0), oben = rechts × Blick
  const lr = Math.hypot(f[2], f[0])
  const r = [-f[2] / lr, 0, f[0] / lr]
  const u = [
    r[1] * f[2] - r[2] * f[1],
    r[2] * f[0] - r[0] * f[2],
    r[0] * f[1] - r[1] * f[0],
  ]
  return { r, u, f }
}

/** Lässt die Animation-Frames laufen (16 ms je Bild, sonst `schritt`). */
let jetzt = 0
let frames: Map<number, FrameRequestCallback>
let naechsteId = 1
function laufen(ms: number, schritt = 16) {
  const ende = jetzt + ms
  while (jetzt < ende) {
    jetzt += schritt
    const faellig = Array.from(frames.entries())
    frames.clear()
    for (const [, cb] of faellig) cb(jetzt)
  }
}

beforeEach(() => {
  jetzt = 0
  naechsteId = 1
  frames = new Map()
  offen = []
  jest.spyOn(performance, 'now').mockImplementation(() => jetzt)
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      const id = naechsteId
      naechsteId += 1
      frames.set(id, cb)
      return id
    })
  jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation((id: number) => {
      frames.delete(id)
    })
})

afterEach(() => {
  for (const rig of offen) rig.dispose()
  document.body.innerHTML = ''
  jest.restoreAllMocks()
})

describe('createRig: Kamera', () => {
  it('setzt die Kamera auf die Ruhelage des Blickpunkts und rendert einmal', () => {
    const { kamera, requestRender, ankunft } = aufbau()
    expect(kamera.eye).toEqual([0, 2, 0])
    expect(kamera.yaw()).toBeCloseTo(0, 9)
    expect(kamera.fov).toBe(60)
    expect(kamera.projektionen).toBeGreaterThan(0)
    expect(requestRender).toHaveBeenCalled()
    expect(ankunft).toEqual(['testregal'])
    // Nichts bewegt sich: kein Takt.
    expect(frames.size).toBe(0)
  })

  it('touch-action: none am Canvas, beim Abbauen wie vorher', () => {
    const element = document.createElement('canvas')
    element.style.touchAction = 'pan-y'
    const rig = createRig({
      camera: kameraAttrappe() as unknown as PerspectiveCamera,
      element,
      requestRender: jest.fn(),
      reducedMotion: false,
    })
    expect(element.style.touchAction).toBe('none')
    rig.dispose()
    expect(element.style.touchAction).toBe('pan-y')
  })

  it('resize: Hochformat nimmt die eigenen Werte', () => {
    const { rig, kamera } = aufbau()
    rig.resize(390 / 844)
    expect(kamera.eye).toEqual([1, 2, 1])
    expect(kamera.fov).toBe(70)
    expect(kamera.yaw()).toBeCloseTo(Math.PI / 2, 9)
  })

  it('nimmt das Seitenverhältnis der Kamera als Start', () => {
    const { kamera } = aufbau({ aspect: 0.5 })
    expect(kamera.eye).toEqual([1, 2, 1])
  })
})

describe('createRig: Tipp oder Ziehen', () => {
  it('Tipp: gemeldet mit den Koordinaten, die Kamera bleibt', () => {
    const { element, taps, doppelt, kamera, erste } = aufbau()
    zeiger(element, 'pointerdown', 100, 200, { zeit: 0 })
    zeiger(element, 'pointermove', 103, 202, { zeit: 40 })
    zeiger(element, 'pointerup', 103, 202, { zeit: 90 })
    expect(taps).toEqual(['103,202'])
    expect(doppelt).toEqual([])
    expect(kamera.yaw()).toBeCloseTo(0, 9)
    expect(erste).toHaveBeenCalledTimes(1)
  })

  it('Ziehen über die Schwelle: kein Tipp, die Kamera dreht mit dem Finger', () => {
    const { element, taps, kamera } = aufbau()
    zeiger(element, 'pointerdown', 100, 200, { zeit: 0 })
    zeiger(element, 'pointermove', 120, 200, { zeit: 30 })
    zeiger(element, 'pointermove', 220, 230, { zeit: 60 })
    // 100 px nach der Schwelle bei 60° auf 600 px Höhe = 10° nach links.
    expect(kamera.yaw()).toBeCloseTo(10 * GRAD, 6)
    // Finger nach unten: der Blick geht nach oben.
    expect(kamera.pitch()).toBeCloseTo(3 * GRAD, 6)
    expect(kamera.eye).toEqual([0, 2, 0])
    zeiger(element, 'pointerup', 220, 230, { zeit: 90 })
    expect(taps).toEqual([])
    expect(frames.size).toBe(0)
  })

  it('lange gehalten ist kein Tipp', () => {
    const { element, taps } = aufbau()
    zeiger(element, 'pointerdown', 100, 200, { zeit: 0 })
    zeiger(element, 'pointerup', 100, 200, { zeit: 900 })
    expect(taps).toEqual([])
  })

  it('abgebrochen (pointercancel) ist kein Tipp', () => {
    const { element, taps } = aufbau()
    zeiger(element, 'pointerdown', 100, 200, { zeit: 0 })
    zeiger(element, 'pointercancel', 100, 200, { zeit: 50 })
    expect(taps).toEqual([])
  })

  it('Doppeltipp: erst Tipp, dann nur Doppeltipp', () => {
    const { element, taps, doppelt } = aufbau()
    zeiger(element, 'pointerdown', 100, 200, { zeit: 0 })
    zeiger(element, 'pointerup', 100, 200, { zeit: 60 })
    zeiger(element, 'pointerdown', 104, 203, { zeit: 200 })
    zeiger(element, 'pointerup', 104, 203, { zeit: 260 })
    expect(taps).toEqual(['100,200'])
    expect(doppelt).toEqual(['104,203'])
    // Der dritte Tipp beginnt neu.
    zeiger(element, 'pointerdown', 104, 203, { zeit: 400 })
    zeiger(element, 'pointerup', 104, 203, { zeit: 450 })
    expect(taps).toEqual(['100,200', '104,203'])
  })

  it('zwei langsame Tipps sind zwei Tipps', () => {
    const { element, taps, doppelt } = aufbau()
    zeiger(element, 'pointerdown', 100, 200, { zeit: 0 })
    zeiger(element, 'pointerup', 100, 200, { zeit: 60 })
    zeiger(element, 'pointerdown', 100, 200, { zeit: 1000 })
    zeiger(element, 'pointerup', 100, 200, { zeit: 1060 })
    expect(taps).toHaveLength(2)
    expect(doppelt).toEqual([])
  })

  it('rechte Maustaste zählt nicht', () => {
    const { element, taps, erste } = aufbau()
    zeiger(element, 'pointerdown', 100, 200, {
      pointerType: 'mouse',
      button: 2,
    })
    zeiger(element, 'pointerup', 100, 200, { pointerType: 'mouse', button: 2 })
    expect(taps).toEqual([])
    expect(erste).not.toHaveBeenCalled()
  })
})

describe('createRig: Finger ohne Geisterklick', () => {
  it('touchend am Canvas verliert seine Standardaktion (kein Klick danach), nach dispose nicht mehr', () => {
    const { rig, element } = aufbau()
    expect(fingerWeg(element).defaultPrevented).toBe(true)
    // Nicht abbrechbar (der Browser scrollt schon): nichts zu tun.
    expect(fingerWeg(element, false).defaultPrevented).toBe(false)
    rig.dispose()
    expect(fingerWeg(element).defaultPrevented).toBe(false)
  })

  it('auch gesperrt (Flug zum Start): Der Tipp, der überspringt, klickt nichts an', () => {
    const { rig, element } = aufbau()
    rig.sperren(true)
    expect(fingerWeg(element).defaultPrevented).toBe(true)
  })

  it('ein Finger holt den Fokus ins Canvas, ohne zu scrollen - auch gesperrt', () => {
    const { rig, element } = aufbau()
    element.tabIndex = 0
    const knopf = document.createElement('button')
    document.body.appendChild(knopf)
    knopf.focus()
    const fokus = jest.spyOn(element, 'focus')

    zeiger(element, 'pointerdown', 100, 200, { zeit: 0 })
    expect(document.activeElement).toBe(element)
    expect(fokus).toHaveBeenCalledWith({ preventScroll: true })
    zeiger(element, 'pointerup', 100, 200, { zeit: 50 })

    knopf.focus()
    rig.sperren(true)
    zeiger(element, 'pointerdown', 100, 200, { zeit: 1000 })
    expect(document.activeElement).toBe(element)
  })

  it('der Fokus vom Finger zeigt keinen Fokusrahmen - erst wieder mit einer Taste', () => {
    const { rig, element } = aufbau()
    element.tabIndex = 0
    zeiger(element, 'pointerdown', 100, 200, { zeit: 0 })
    zeiger(element, 'pointerup', 100, 200, { zeit: 50 })
    expect(document.activeElement).toBe(element)
    expect(element.style.outline).toBe('none')
    // Eine Taste am Canvas: wie nach einem Mausklick gehört der Rahmen dazu.
    taste('+', element)
    expect(element.style.outline).toBe('')

    // Wieder ein Finger, dann geht der Fokus weg (z. B. in die Karte).
    zeiger(element, 'pointerdown', 100, 200, { zeit: 1000 })
    expect(element.style.outline).toBe('none')
    element.blur()
    expect(element.style.outline).toBe('')

    // Nach dispose bleibt nichts am Canvas zurück.
    zeiger(element, 'pointerdown', 100, 200, { zeit: 2000 })
    expect(element.style.outline).toBe('none')
    rig.dispose()
    expect(element.style.outline).toBe('')
  })

  it('die Maus fokussiert wie gewohnt selbst (über mousedown)', () => {
    const { element } = aufbau()
    const fokus = jest.spyOn(element, 'focus')
    zeiger(element, 'pointerdown', 100, 200, { pointerType: 'mouse' })
    expect(fokus).not.toHaveBeenCalled()
    expect(element.style.outline).toBe('')
  })
})

describe('createRig: Grenzen und Zurückfedern', () => {
  it('über die Grenze gezogen und losgelassen: federt per Takt zurück, dann Ruhe', () => {
    const { element, kamera, requestRender } = aufbau()
    zeiger(element, 'pointerdown', 0, 300, { zeit: 0 })
    zeiger(element, 'pointermove', 20, 300, { zeit: 10 })
    zeiger(element, 'pointermove', 2020, 300, { zeit: 20 })
    const gezogen = kamera.yaw()
    expect(gezogen).toBeGreaterThan(20 * GRAD)
    expect(gezogen).toBeLessThan(26 * GRAD)
    // Finger drauf: kein Takt.
    expect(frames.size).toBe(0)

    zeiger(element, 'pointerup', 2020, 300, { zeit: 30 })
    expect(frames.size).toBe(1)
    laufen(32)
    expect(kamera.yaw()).toBeLessThan(gezogen)
    expect(kamera.yaw()).toBeGreaterThan(20 * GRAD)
    laufen(1500)
    expect(kamera.yaw()).toBeCloseTo(20 * GRAD, 9)
    // Angekommen: der Takt steht, es wird nicht weiter gerendert.
    expect(frames.size).toBe(0)
    const aufrufe = requestRender.mock.calls.length
    laufen(500)
    expect(requestRender.mock.calls.length).toBe(aufrufe)
  })

  it('prefers-reduced-motion: harter Anschlag ohne Takt', () => {
    const { element, kamera } = aufbau({ reducedMotion: true })
    zeiger(element, 'pointerdown', 0, 300)
    zeiger(element, 'pointermove', 20, 300)
    zeiger(element, 'pointermove', 2020, 300)
    expect(kamera.yaw()).toBeCloseTo(20 * GRAD, 9)
    zeiger(element, 'pointerup', 2020, 300)
    expect(frames.size).toBe(0)
  })
})

describe('createRig: Zoom', () => {
  it('Mausrad ändert den Öffnungswinkel in den Grenzen, nie den Standort', () => {
    const { element, kamera, erste } = aufbau()
    const e = rad(element, -200)
    expect(e.defaultPrevented).toBe(true)
    expect(kamera.fov).toBeLessThan(60)
    expect(kamera.fov).toBeGreaterThan(24)
    rad(element, -100000)
    expect(kamera.fov).toBe(24)
    rad(element, 100000)
    expect(kamera.fov).toBe(60)
    expect(kamera.eye).toEqual([0, 2, 0])
    expect(erste).toHaveBeenCalledTimes(1)
  })

  it('+ und - zoomen', () => {
    const { kamera } = aufbau()
    expect(taste('+').defaultPrevented).toBe(true)
    expect(kamera.fov).toBeCloseTo(51, 6)
    taste('-')
    expect(kamera.fov).toBeCloseTo(60, 6)
    taste('-')
    expect(kamera.fov).toBe(60)
  })

  it('Pinch abseits der Mitte: Was zwischen den Fingern liegt, bleibt dort', () => {
    const { element, kamera } = aufbau({ mitRahmen: true })
    const mitte = { x: 720, y: 190 }
    const punkt = hinterBildpunkt(kamera, mitte.x, mitte.y)
    expect(imBild(kamera, punkt).x).toBeCloseTo(mitte.x, 6)
    zeiger(element, 'pointerdown', 670, 190, { id: 1, zeit: 0 })
    zeiger(element, 'pointerdown', 770, 190, { id: 2, zeit: 10 })
    // Ein Finger nach dem anderen: Die Mitte wandert unterwegs - der Anker
    // bleibt die Mitte vom Anfang.
    zeiger(element, 'pointermove', 620, 190, { id: 1, zeit: 20 })
    zeiger(element, 'pointermove', 820, 190, { id: 2, zeit: 30 })
    expect(kamera.fov).toBeCloseTo(30, 6)
    // Nicht an einer Grenze: Der Blick hat sich zum Punkt gedreht ...
    expect(kamera.yaw()).toBeLessThan(-5 * GRAD)
    expect(kamera.pitch()).toBeGreaterThan(2 * GRAD)
    // ... und der Punkt steht, wo er stand.
    const danach = imBild(kamera, punkt)
    expect(Math.abs(danach.x - mitte.x)).toBeLessThan(3)
    expect(Math.abs(danach.y - mitte.y)).toBeLessThan(3)
    zeiger(element, 'pointerup', 820, 190, { id: 2, zeit: 40 })
    zeiger(element, 'pointerup', 620, 190, { id: 1, zeit: 50 })
    laufen(400)
    expect(Math.abs(imBild(kamera, punkt).x - mitte.x)).toBeLessThan(3)
  })

  it('Mausrad und Strg+Mausrad (Trackpad) zoomen zum Zeiger', () => {
    for (const ctrlKey of [false, true]) {
      const { element, kamera } = aufbau({ mitRahmen: true })
      const zeigerPos = { x: 250, y: 470 }
      const punkt = hinterBildpunkt(kamera, zeigerPos.x, zeigerPos.y)
      rad(element, ctrlKey ? -40 : -300, { ...zeigerPos, ctrlKey })
      expect(kamera.fov).toBeLessThan(45)
      expect(kamera.fov).toBeGreaterThan(24)
      const nah = imBild(kamera, punkt)
      expect(Math.abs(nah.x - zeigerPos.x)).toBeLessThan(3)
      expect(Math.abs(nah.y - zeigerPos.y)).toBeLessThan(3)
      // Und wieder hinaus, am selben Zeiger.
      rad(element, ctrlKey ? 20 : 150, { ...zeigerPos, ctrlKey })
      const weiter = imBild(kamera, punkt)
      expect(Math.abs(weiter.x - zeigerPos.x)).toBeLessThan(3)
      expect(Math.abs(weiter.y - zeigerPos.y)).toBeLessThan(3)
      expect(kamera.eye).toEqual([0, 2, 0])
    }
  })

  it('+ und - zoomen weiter zur Bildmitte', () => {
    const { kamera } = aufbau({ mitRahmen: true })
    taste('+')
    expect(kamera.fov).toBeCloseTo(51, 6)
    expect(kamera.yaw()).toBeCloseTo(0, 12)
    expect(kamera.pitch()).toBeCloseTo(0, 12)
  })

  it('zwei Finger gewischt: Winkel und Blick wieder wie vorher', () => {
    const { element, kamera, wechsel } = aufbau({ mitRahmen: true })
    zeiger(element, 'pointerdown', 600, 300, { id: 1 })
    zeiger(element, 'pointerdown', 700, 310, { id: 2 })
    // Etwas gespreizt (Pinch-Anteil unter der Schwelle), dann nach links.
    zeiger(element, 'pointermove', 505, 302, { id: 1 })
    zeiger(element, 'pointermove', 618, 312, { id: 2 })
    expect(kamera.fov).not.toBeCloseTo(60, 3)
    zeiger(element, 'pointerup', 618, 312, { id: 2 })
    zeiger(element, 'pointerup', 505, 302, { id: 1 })
    expect(wechsel).toEqual([1])
    expect(kamera.fov).toBeCloseTo(60, 9)
    expect(kamera.yaw()).toBeCloseTo(0, 9)
    expect(kamera.pitch()).toBeCloseTo(0, 9)
  })

  it('Pinch: Finger auseinander zoomt heran, kein Tipp, kein Wechsel', () => {
    const { element, kamera, taps, wechsel } = aufbau()
    zeiger(element, 'pointerdown', 100, 300, { id: 1, zeit: 0 })
    zeiger(element, 'pointerdown', 200, 300, { id: 2, zeit: 10 })
    zeiger(element, 'pointermove', 50, 300, { id: 1, zeit: 20 })
    zeiger(element, 'pointermove', 250, 300, { id: 2, zeit: 30 })
    expect(kamera.fov).toBeCloseTo(30, 6)
    zeiger(element, 'pointerup', 250, 300, { id: 2, zeit: 40 })
    // Der verbleibende Finger zieht nicht weiter und tippt nicht.
    zeiger(element, 'pointermove', 300, 300, { id: 1, zeit: 50 })
    zeiger(element, 'pointerup', 300, 300, { id: 1, zeit: 60 })
    expect(kamera.fov).toBeCloseTo(30, 6)
    expect(kamera.yaw()).toBeCloseTo(0, 9)
    expect(taps).toEqual([])
    expect(wechsel).toEqual([])
  })

  it('zoomTo gleitet heran und dreht zum Punkt', () => {
    const { rig, kamera } = aufbau()
    rig.zoomTo([Math.sin(10 * GRAD) * 4, 2, Math.cos(10 * GRAD) * 4])
    expect(frames.size).toBe(1)
    laufen(600)
    expect(kamera.fov).toBe(30)
    expect(kamera.yaw()).toBeCloseTo(10 * GRAD, 9)
    expect(frames.size).toBe(0)
  })

  it('zoomZurueck gleitet zur Startweite zurück und hält dann an', () => {
    const { rig, kamera } = aufbau()
    expect(rig.istGezoomt()).toBe(false)
    rig.zoomTo([0, 2, 4])
    laufen(600)
    expect(rig.istGezoomt()).toBe(true)
    rig.zoomZurueck()
    expect(frames.size).toBe(1)
    laufen(600)
    expect(kamera.fov).toBe(60)
    expect(rig.istGezoomt()).toBe(false)
    expect(frames.size).toBe(0)
  })

  it('schwenken dreht den Blick, ohne den Öffnungswinkel zu ändern', () => {
    const { rig, kamera } = aufbau()
    rig.schwenken(6 * GRAD, 3 * GRAD)
    laufen(600)
    expect(kamera.yaw()).toBeCloseTo(6 * GRAD, 9)
    expect(kamera.pitch()).toBeCloseTo(3 * GRAD, 9)
    expect(kamera.fov).toBe(60)
    expect(frames.size).toBe(0)
  })

  it('ein Rad-Ereignis ohne senkrechten Weg lässt eine laufende Fahrt in Ruhe', () => {
    const { rig, kamera, element } = aufbau()
    rig.zoomTo([Math.sin(10 * GRAD) * 4, 2, Math.cos(10 * GRAD) * 4])
    laufen(160)
    const fov = kamera.fov
    const e = rad(element, 0)
    // Die Seite scrollt trotzdem nicht mit.
    expect(e.defaultPrevented).toBe(true)
    expect(kamera.fov).toBe(fov)
    laufen(600)
    expect(kamera.fov).toBe(30)
    expect(kamera.yaw()).toBeCloseTo(10 * GRAD, 9)
  })

  it('ein Rad-Tick während der Fahrt ändert nur das Ziel des Öffnungswinkels', () => {
    const { rig, kamera, element } = aufbau()
    rig.zoomTo([Math.sin(10 * GRAD) * 4, 2, Math.cos(10 * GRAD) * 4])
    laufen(160)
    const vorher = kamera.fov
    rad(element, -100)
    // kein Sprung auf das Ziel
    expect(kamera.fov).toBeCloseTo(vorher, 6)
    laufen(600)
    expect(kamera.fov).toBeLessThan(30)
    expect(kamera.yaw()).toBeCloseTo(10 * GRAD, 9)
  })

  it('nach einem Pinch dreht der liegen gebliebene Finger nicht und tippt nicht', () => {
    const { element, kamera, taps, doppelt } = aufbau()
    zeiger(element, 'pointerdown', 100, 200, { id: 1, zeit: 0 })
    zeiger(element, 'pointerdown', 200, 200, { id: 2, zeit: 10 })
    zeiger(element, 'pointermove', 220, 200, { id: 2, zeit: 40 })
    // ein Finger hebt ab, der andere zieht weiter
    zeiger(element, 'pointerup', 220, 200, { id: 2, zeit: 60 })
    const yaw = kamera.yaw()
    const fov = kamera.fov
    zeiger(element, 'pointermove', 160, 240, { id: 1, zeit: 90 })
    zeiger(element, 'pointermove', 260, 300, { id: 1, zeit: 120 })
    expect(kamera.yaw()).toBeCloseTo(yaw, 9)
    expect(kamera.fov).toBe(fov)
    zeiger(element, 'pointerup', 260, 300, { id: 1, zeit: 150 })
    laufen(400)
    expect(kamera.yaw()).toBeCloseTo(yaw, 9)
    expect(taps).toEqual([])
    expect(doppelt).toEqual([])
    // Die nächste Berührung mit einem Finger dreht wieder.
    zeiger(element, 'pointerdown', 100, 200, { id: 3, zeit: 1000 })
    zeiger(element, 'pointermove', 130, 200, { id: 3, zeit: 1030 })
    zeiger(element, 'pointermove', 160, 200, { id: 3, zeit: 1060 })
    expect(kamera.yaw()).not.toBeCloseTo(yaw, 6)
    zeiger(element, 'pointerup', 160, 200, { id: 3, zeit: 1090 })
  })

  it('meldet das Ende einer Fahrt genau einmal (onRuhe) und ob sie noch läuft', () => {
    const { rig } = aufbau()
    const ruhe = jest.fn()
    rig.onRuhe(ruhe)
    expect(rig.bewegt()).toBe(false)
    rig.schwenken(6 * GRAD, 0)
    expect(rig.bewegt()).toBe(true)
    laufen(160)
    expect(ruhe).not.toHaveBeenCalled()
    laufen(600)
    expect(ruhe).toHaveBeenCalledTimes(1)
    expect(rig.bewegt()).toBe(false)
    laufen(600)
    expect(ruhe).toHaveBeenCalledTimes(1)
  })

  it('schwenken meldet, was die Grenze abgeschnitten hat', () => {
    const { rig } = aufbau()
    expect(rig.schwenken(5 * GRAD, 0)?.yaw).toBeCloseTo(0, 12)
    laufen(600)
    expect(rig.schwenken(60 * GRAD, 0)?.yaw).toBeCloseTo(45 * GRAD, 9)
  })

  it('Tipp und Doppeltipp nennen die Art des Zeigers', () => {
    const { rig, element } = aufbau()
    const arten: string[] = []
    rig.onTap((_x, _y, zeiger) => arten.push(`tipp ${zeiger}`))
    rig.onDoubleTap((_x, _y, zeiger) => arten.push(`doppelt ${zeiger}`))
    zeiger(element, 'pointerdown', 100, 200, { zeit: 0, pointerType: 'mouse' })
    zeiger(element, 'pointerup', 100, 200, { zeit: 60, pointerType: 'mouse' })
    zeiger(element, 'pointerdown', 100, 200, { zeit: 200 })
    zeiger(element, 'pointerup', 100, 200, { zeit: 260 })
    expect(arten).toEqual(['tipp mouse', 'doppelt touch'])
  })
})

describe('createRig: Blickpunkt wechseln', () => {
  it('gleitet ≈ 0,8 s, meldet die Ankunft und hält dann an', () => {
    const { rig, kamera, ankunft } = aufbau()
    rig.setBlickpunkt(korb)
    expect(kamera.eye).toEqual([0, 2, 0])
    laufen(WECHSEL_MS / 2)
    expect(kamera.eye[0]).toBeGreaterThan(0.5)
    expect(kamera.eye[0]).toBeLessThan(3.5)
    expect(ankunft).toEqual(['testregal'])
    laufen(WECHSEL_MS / 2 + 32)
    expect(kamera.eye).toEqual([4, 2, -3])
    expect(kamera.fov).toBe(50)
    expect(ankunft).toEqual(['testregal', 'testkorb'])
    expect(frames.size).toBe(0)
  })

  it('auch bei 10 Bildern/s dauert die Fahrt ≈ 0,8 s, nicht länger', () => {
    const { rig, ankunft } = aufbau()
    rig.setBlickpunkt(korb)
    const start = jetzt
    let dauer = Number.NaN
    while (jetzt - start < 3000 && Number.isNaN(dauer)) {
      laufen(100, 100)
      if (ankunft.includes('testkorb')) dauer = jetzt - start
    }
    expect(dauer).toBeGreaterThanOrEqual(WECHSEL_MS - 100)
    expect(dauer).toBeLessThanOrEqual(WECHSEL_MS + 100)
    expect(frames.size).toBe(0)
  })

  it('nach einer langen Pause beginnt der Takt ohne Sprung', () => {
    const { rig, kamera } = aufbau()
    // Lange nichts (Tab im Hintergrund), dann eine neue Fahrt.
    jetzt += 60_000
    rig.setBlickpunkt(korb)
    laufen(16)
    expect(kamera.eye[0]).toBeGreaterThan(0)
    expect(kamera.eye[0]).toBeLessThan(0.5)
  })

  it('prefers-reduced-motion: Schnitt ohne Takt', () => {
    const { rig, kamera, ankunft } = aufbau({ reducedMotion: true })
    rig.setBlickpunkt(korb)
    expect(kamera.eye).toEqual([4, 2, -3])
    expect(ankunft).toEqual(['testregal', 'testkorb'])
    expect(frames.size).toBe(0)
  })

  it('Pfeiltasten melden den Wechsel', () => {
    const { wechsel, erste } = aufbau()
    expect(taste('ArrowRight').defaultPrevented).toBe(true)
    taste('ArrowLeft')
    expect(wechsel).toEqual([1, -1])
    expect(erste).toHaveBeenCalledTimes(1)
  })

  it('Tasten in Eingabefeldern und Dialogen gehören nicht dem Rig', () => {
    const { wechsel, kamera } = aufbau()
    const feld = document.createElement('input')
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const knopf = document.createElement('button')
    dialog.appendChild(knopf)
    document.body.append(feld, dialog)
    expect(taste('ArrowRight', feld).defaultPrevented).toBe(false)
    taste('ArrowLeft', knopf)
    taste('+', feld)
    expect(wechsel).toEqual([])
    expect(kamera.fov).toBe(60)
  })

  it('zwei Finger nach links gewischt: nächster Blickpunkt, Winkel unverändert', () => {
    const { element, wechsel, kamera, taps } = aufbau()
    zeiger(element, 'pointerdown', 200, 300, { id: 1 })
    zeiger(element, 'pointerdown', 300, 310, { id: 2 })
    zeiger(element, 'pointermove', 110, 302, { id: 1 })
    zeiger(element, 'pointermove', 205, 312, { id: 2 })
    zeiger(element, 'pointerup', 205, 312, { id: 2 })
    zeiger(element, 'pointerup', 110, 302, { id: 1 })
    expect(wechsel).toEqual([1])
    expect(kamera.fov).toBe(60)
    expect(taps).toEqual([])
  })

  it('zwei Finger nach rechts gewischt: voriger Blickpunkt', () => {
    const { element, wechsel } = aufbau()
    zeiger(element, 'pointerdown', 100, 300, { id: 1 })
    zeiger(element, 'pointerdown', 200, 300, { id: 2 })
    zeiger(element, 'pointermove', 190, 300, { id: 1 })
    zeiger(element, 'pointermove', 290, 300, { id: 2 })
    zeiger(element, 'pointerup', 290, 300, { id: 2 })
    zeiger(element, 'pointerup', 190, 300, { id: 1 })
    expect(wechsel).toEqual([-1])
  })
})

describe('createRig: sperren (Flug zum Start)', () => {
  it('gesperrt bewirken Zeiger, Rad und Tasten nichts und zählen nicht als erste Geste', () => {
    const { rig, kamera, element, taps, wechsel, erste } = aufbau()
    rig.sperren(true)
    const yaw = kamera.yaw()
    const fov = kamera.fov

    zeiger(element, 'pointerdown', 100, 100, { zeit: 0 })
    zeiger(element, 'pointerup', 100, 100, { zeit: 80 })
    zeiger(element, 'pointerdown', 100, 100, { zeit: 1000 })
    zeiger(element, 'pointermove', 220, 100, { zeit: 1050 })
    zeiger(element, 'pointerup', 220, 100, { zeit: 1100 })
    const e = rad(element, -400)
    taste('ArrowRight')
    taste('+')
    laufen(500)

    expect(taps).toEqual([])
    expect(wechsel).toEqual([])
    expect(erste).not.toHaveBeenCalled()
    expect(kamera.yaw()).toBeCloseTo(yaw, 9)
    expect(kamera.fov).toBe(fov)
    // Die Seite scrollt oder zoomt trotzdem nicht mit.
    expect(e.defaultPrevented).toBe(true)
  })

  it('der Tipp, der entsperrt, ist selbst kein Tipp - der nächste schon', () => {
    const { rig, element, taps, erste } = aufbau()
    rig.sperren(true)
    zeiger(element, 'pointerdown', 100, 100, { zeit: 0 })
    // Der Aufrufer (createViewer) überspringt beim Aufsetzen des Fingers.
    rig.sperren(false)
    zeiger(element, 'pointerup', 100, 100, { zeit: 80 })
    expect(taps).toEqual([])
    expect(erste).not.toHaveBeenCalled()

    zeiger(element, 'pointerdown', 120, 100, { zeit: 2000 })
    zeiger(element, 'pointerup', 120, 100, { zeit: 2080 })
    expect(taps).toEqual(['120,100'])
    expect(erste).toHaveBeenCalledTimes(1)
  })

  it('sperren mitten im Ziehen lässt los: kein Tipp, kein Weiterziehen', () => {
    const { rig, kamera, element, taps } = aufbau()
    zeiger(element, 'pointerdown', 100, 100, { zeit: 0 })
    zeiger(element, 'pointermove', 160, 100, { zeit: 50 })
    zeiger(element, 'pointermove', 200, 100, { zeit: 100 })
    rig.sperren(true)
    laufen(500)
    const yaw = kamera.yaw()
    zeiger(element, 'pointermove', 300, 100, { zeit: 700 })
    zeiger(element, 'pointerup', 300, 100, { zeit: 750 })
    laufen(500)
    expect(kamera.yaw()).toBeCloseTo(yaw, 9)
    expect(taps).toEqual([])
  })
})

describe('createRig: dispose', () => {
  it('räumt Zuhörer und Takt ab - danach passiert nichts mehr', () => {
    const { rig, element, kamera, taps, wechsel, requestRender } = aufbau()
    rig.setBlickpunkt(korb)
    expect(frames.size).toBe(1)
    rig.dispose()
    expect(frames.size).toBe(0)
    const aufrufe = requestRender.mock.calls.length
    const eye = [...kamera.eye]

    zeiger(element, 'pointerdown', 100, 200, { zeit: 0 })
    zeiger(element, 'pointerup', 100, 200, { zeit: 50 })
    expect(rad(element, -200).defaultPrevented).toBe(false)
    expect(taste('ArrowRight').defaultPrevented).toBe(false)
    rig.setBlickpunkt(regal)
    rig.zoomTo([0, 2, 4])
    rig.resize(0.5)
    laufen(1000)

    expect(taps).toEqual([])
    expect(wechsel).toEqual([])
    expect(kamera.eye).toEqual(eye)
    expect(requestRender.mock.calls.length).toBe(aufrufe)
    // Zweimal abbauen ist harmlos.
    rig.dispose()
  })
})
