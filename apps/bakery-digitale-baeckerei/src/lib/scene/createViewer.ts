/**
 * Die 3D-Szene der Digitalen Bäckerei: Renderer, Modell laden, Morgens-Filter,
 * Preisschilder ausblenden, Kamera-Rig (Umschauen, Zoom, Wechsel zwischen den
 * Blickpunkten) und Antippen der Ware. Kein Licht - das Licht steckt in den
 * Vertex-Farben des Modells (unlit).
 *
 * Diese Datei verdrahtet nur: Die Kamera führt rigControls.ts/rig.ts, das
 * Antippen und Hervorheben pick.ts/interact.ts, den Außenraum aussenraum.ts.
 *
 * Renderer-Einstellungen 1:1 aus dem Saar LiDAR Explorer
 * (github.com/Open-Kirrberg/saar-lidar-explorer, MIT, gleicher Urheber),
 * `app/src/zones/runtime/gltfZone.ts` (`enter()`, `GltfZone`-Konstruktor):
 * kein Tone-Mapping, Belichtung 1, Ausgabe sRGB, Hintergrund in der
 * Horizontfarbe des Explorer-Himmels. Andere Werte verfälschen die Farben.
 *
 * Importiert three - nur aus der nachgeladenen Viewer-Komponente verwenden
 * (next/dynamic, ssr: false), nie statisch aus der Seite.
 */
import {
  Box3,
  Color,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { Object3D } from 'three'
import type { Blickpunkt, Intro, Vec3 } from '../../config/raeume'
import { setzeAussenraum } from './aussenraum'
import {
  IM_BILD_RAND_PX,
  freierBereich,
  schwenkFuer,
  type Rechteck,
} from './bildausschnitt'
import {
  applyFill,
  parseProduktName,
  type FillNode,
  type FillResult,
} from './fills'
import {
  BILDRATE_NACH_MS,
  MAX_PAUSE_MS,
  dauer as introDauer,
  introPose,
  waehleIntro,
  zuLangsam,
  type IntroEnde,
} from './intro'
import { countTriangles, disposeTree, loadModel } from './loadModel'
import {
  blendePreiskartenAus,
  createPicker,
  type Picker,
  type Treffer,
} from './pick'
import { createRig } from './rigControls'
import { gehoertZu } from '../raeume/rauminfos'
import { slotVon, TIPP_RADIUS_PX } from './treffer'
import { ansichtFuer, cappedPixelRatio, type Ansicht } from './view'

export type { Treffer } from './pick'
export type { Rechteck } from './bildausschnitt'
export type { IntroEnde } from './intro'

/**
 * Tippfläche kleiner Produkte mit der Maus: Der Zeiger ist genauer als ein
 * Finger (44 px), wie im Explorer 8 px Radius.
 */
export const MAUS_RADIUS_PX = 8

/** Horizontfarbe des Explorer-Himmels (sRGB), dort Hintergrund des Zwillings. */
const HORIZON: Vec3 = [0.74, 0.8, 0.86]
/** Wie im Explorer: nah genug für Ware direkt vor der Kamera. */
const NEAR = 0.05
/** Der Außenraum reicht ≈ 40 m weit; der Explorer nimmt 3000 für seine Landschaft. */
const FAR = 500

export class WebGLUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('WebGL ist nicht verfügbar')
    this.name = 'WebGLUnavailableError'
    this.cause = cause
  }
}

export interface ViewerReadyInfo {
  /** ms seit Seitenstart (performance.now) beim ersten Bild mit Modell. */
  firstFrameMs: number
  triangles: number
  fill: FillResult
  /**
   * Der Flug zum Start, den dieses Modell hergibt (und ob er gerade läuft);
   * `null`: keiner - auch bei `prefers-reduced-motion`.
   */
  intro: { id: string; laeuft: boolean } | null
}

export interface ViewerOptions {
  modelUrl: string
  /** Erwartete Größe des Modells in Bytes (aus model.lock.json), für den Fortschritt. */
  modelBytes?: number
  blickpunkt: Blickpunkt
  /** Zustand der Auslage, z. B. „morgens“. */
  fuellung: string
  /** Text für Screenreader am Canvas. */
  label: string
  /** Legt `window.__digitaleBaeckerei` zum Messen an (nur mit `?debug`). */
  debug?: boolean
  /** Flüge zum Start (aus raeume.ts), in der Reihenfolge des Vorrangs. */
  intros?: readonly Intro[]
  /** `false`: nach dem Laden gleich am Blickpunkt stehen (`?intro=0`). */
  introSpielen?: boolean
  /** Ein Flug beginnt (`true`) oder ist zu Ende (`false`, auch übersprungen). */
  onIntro?: (laeuft: boolean) => void
  onProgress: (fraction: number) => void
  onReady: (info: ViewerReadyInfo) => void
  onError: (error: unknown) => void
  /** Der WebGL-Kontext ging verloren (App gewechselt, Speicherdruck). */
  onLost: () => void
  /**
   * Ein Tipp ins Bild: der Treffer - mit `produkt`, wenn dort ein Produkt
   * liegt, sonst das getroffene Stück (neutrale Ware, Möbel, Station; die App
   * schaut, ob es dazu einen Infopunkt oder eine Tür gibt) - oder `null`,
   * wenn der Tipp nichts mit Kennung trifft.
   */
  onTreffer?: (treffer: Treffer | null) => void
  /** Einmal, bei der ersten Bedienung der Szene. */
  onErsteGeste?: () => void
  /** Zwei Finger gewischt oder Pfeiltaste: −1 = voriger, +1 = nächster Blickpunkt. */
  onWechselGeste?: (richtung: -1 | 1) => void
  /**
   * Steht der gewählte Platz im freien Teil des Bildes? `false`: Er liegt
   * außerhalb dessen, was sich an diesem Blickpunkt erreichen lässt (oder es
   * gibt ihn im Bild nicht).
   */
  onAuswahlImBild?: (slot: string, imBild: boolean) => void
}

export interface ViewerHandle {
  /** Zu einem anderen Blickpunkt gleiten (ohne Bewegung: schneiden). */
  setBlickpunkt: (blickpunkt: Blickpunkt) => void
  /** Text für Screenreader am Canvas. */
  setLabel: (label: string) => void
  /**
   * Einen Platz dauerhaft hervorheben (`null`: aus). Liegt er außerhalb des
   * Bildes oder unter der Karte (`verdeckt` liefert ihr Rechteck in
   * Viewport-Koordinaten), dreht der Blick zu ihm hin - in den Grenzen des
   * Umschauens. Dasselbe noch einmal nach `haltFrei()`, nach einer
   * Größenänderung und nach der Ankunft an einem Blickpunkt.
   */
  waehle: (slot: string | null, verdeckt?: () => Rechteck | null) => void
  /** Die Karte hat ihre Größe geändert: den gewählten Platz wieder frei stellen. */
  haltFrei: () => void
  /**
   * Den Flug zum Start (noch einmal) zeigen. `false`: Es gibt keinen - das
   * Modell ist nicht da, es hat keinen, die Kamera steht nicht an seinem
   * Ziel-Blickpunkt, oder das Gerät will keine Bewegung.
   */
  spieleIntro: () => boolean
  /** Einen laufenden Flug beenden: gleich am Blickpunkt stehen. */
  ueberspringeIntro: () => void
  dispose: () => void
}

export interface ViewerDebug {
  ready: boolean
  firstFrameMs: number | null
  frames: number
  info: () => {
    triangles: number
    visibleTriangles: number
    drawCalls: number
    renderedTriangles: number
    pixelRatio: number
    size: [number, number]
    fov: number
    fill: FillResult | null
    /** id des Blickpunkts, an dem (oder zu dem) die Kamera steht. */
    blickpunkt: string
    /** Standort und Blickrichtung (Einheitsvektor) der Kamera. */
    eye: number[]
    richtung: number[]
    /** Ausgeblendete Preisschild-Meshes (DB8). */
    preisschilder: number
    aussenSichtbar: boolean
    /** Flug zum Start: läuft er, welcher, wie endete der letzte, Bilder des letzten. */
    intro: {
      laeuft: boolean
      id: string | null
      ende: IntroEnde | null
      bilder: number
      sekunden: number
    }
  }
  /** Rendert `ms` lang jedes Bild neu (leichtes Schwenken) und misst. */
  spin: (ms: number) => Promise<{
    frames: number
    seconds: number
    fps: number
    medianFrameMs: number
    p95FrameMs: number
  }>
  /** Zeichnet neu und liest ein Raster von Pixeln: ist das Bild leer? */
  pixelStats: () => {
    samples: number
    distinct: number
    backgroundShare: number
  }
  /** Kamera frei setzen (Blickpunkte für P1 ausprobieren). */
  setView: (eye: Vec3, look: Vec3, fov: number) => void
  /**
   * Standbild des Flugs zur Filmzeit `sekunden` (Außenraum eingeblendet);
   * liefert die Dauer des Flugs oder `null`, wenn es keinen gibt.
   */
  introBild: (sekunden: number) => number | null
  /** Knoten mit Weltkoordinaten-Rahmen, gefiltert nach Namensanfang. */
  nodes: (prefix?: string) => {
    name: string
    visible: boolean
    min: number[]
    max: number[]
    extras: Record<string, unknown>
  }[]
  /**
   * Mitte des sichtbaren Knotens `produkt/<slot>` in CSS-Pixeln des Viewports
   * (wie `clientX`/`clientY`); `null`, wenn es den Platz nicht gibt, er
   * ausgeblendet ist oder außerhalb des Bildes liegt.
   */
  screenPos: (slot: string) => { x: number; y: number } | null
  /**
   * Der Platz, an dem gerade wirklich eine Hervorhebung hängt (aus dem
   * Picker gelesen) - `null`, wenn nichts gezeichnet wird, auch wenn ein
   * Platz gewählt ist.
   */
  hervorgehoben: string | null
  /** Der gewählte Platz, wie ihn die App verlangt hat. */
  gewaehlt: string | null
  /**
   * Öffnet die Nahansicht für ein Modell aus dem Index, auch ohne Karte
   * (von `DigitaleBaeckerei` eingehängt). `false`: Für die ID gibt es keines.
   */
  nahansicht?: (id: string) => boolean
}

declare global {
  interface Window {
    __digitaleBaeckerei?: ViewerDebug
  }
}

/**
 * Baut die Szene in `container`. Wirft `WebGLUnavailableError`, wenn kein
 * WebGL-Kontext entsteht. Jeder Aufruf hat ein eigenes Canvas: ein per
 * forceContextLoss freigegebenes Canvas ließe sich beim zweiten Mounten
 * (React StrictMode) nicht wiederverwenden.
 */
export function createViewer(
  container: HTMLElement,
  options: ViewerOptions
): ViewerHandle {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', options.label)
  // Fokussierbar: Pfeiltasten und +/- gelten der Szene, und der Fokus kehrt
  // nach dem Schließen der Produktkarte hierher zurück.
  canvas.tabIndex = 0
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  // Kein graues Aufblitzen beim Antippen (Android).
  canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent')
  container.prepend(canvas)

  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'default',
    })
  } catch (err) {
    canvas.remove()
    throw new WebGLUnavailableError(err)
  }
  renderer.toneMapping = NoToneMapping
  renderer.toneMappingExposure = 1
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setPixelRatio(cappedPixelRatio(window.devicePixelRatio))

  const scene = new Scene()
  scene.background = new Color().setRGB(
    HORIZON[0],
    HORIZON[1],
    HORIZON[2],
    SRGBColorSpace
  )
  const camera = new PerspectiveCamera(60, 1, NEAR, FAR)
  const lookTarget = new Vector3()

  const abort = new AbortController()
  let disposed = false
  let model: Object3D | null = null
  let fill: FillResult | null = null
  let picker: Picker | null = null
  let blickpunkt = options.blickpunkt
  let preisschilder = 0
  let aussenSichtbar = true
  /** Dauerhaft hervorgehobener Platz (gewähltes Produkt). */
  let gewaehlt: string | null = null
  /** Liefert das Rechteck der Karte, die das Bild gerade verdeckt. */
  let verdecktVon: (() => Rechteck | null) | null = null
  let raf = 0
  let width = 0
  let height = 0
  let frames = 0
  let firstFrameMs: number | null = null
  /** Gesetzt, solange die Debug-Messung die Kamera führt. */
  let override: Ansicht | null = null
  let debugHook: ViewerDebug | null = null
  /** Der Flug zum Start, den das geladene Modell hergibt. */
  let intro: Intro | null = null
  /** Gesetzt, solange der Flug die Kamera führt. */
  let introLauf: {
    intro: Intro
    /** `performance.now()` beim ersten Bild; 0 = noch keins. */
    start: number
    letztes: number
    sekunden: number
    bilder: number
    geprueft: boolean
    raf: number
  } | null = null
  let introEnde: IntroEnde | null = null
  let introBilder = 0
  let introSekunden = 0

  const applyView = (view: Ansicht) => {
    camera.position.set(view.eye[0], view.eye[1], view.eye[2])
    lookTarget.set(view.look[0], view.look[1], view.look[2])
    camera.up.set(0, 1, 0)
    camera.lookAt(lookTarget)
    camera.fov = view.fov
    camera.updateProjectionMatrix()
  }

  const renderNow = () => {
    if (disposed || width === 0 || height === 0) return
    renderer.render(scene, camera)
    frames += 1
  }

  /** Rendern nur bei Bedarf: höchstens ein Bild je Animation-Frame, kein Dauer-Loop. */
  const requestRender = () => {
    if (raf || disposed) return
    raf = requestAnimationFrame(() => {
      raf = 0
      renderNow()
    })
  }

  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const rig = createRig({
    camera,
    element: canvas,
    requestRender,
    reducedMotion,
  })

  const zeigeAussenraum = (sichtbar: boolean) => {
    aussenSichtbar = sichtbar
    if (model) setzeAussenraum(model, sichtbar)
  }

  rig.setBlickpunkt(blickpunkt, { animate: false })
  // Erst nach der Fahrt ausblenden - unterwegs kann das Schaufenster im Bild sein.
  rig.onAnkunft((bp) => {
    zeigeAussenraum(bp.aussenSichtbar !== false)
    requestRender()
    // Während der Fahrt gewählt: erst jetzt lässt sich der Platz frei stellen.
    haltFrei()
  })

  /**
   * Mitte des sichtbaren Knotens `produkt/<slot>` im Zonen-Rahmen. Gibt es
   * keinen solchen Platz, ist `slot` der Knoten eines Infopunkts (`ofen`):
   * dann die Mitte aller sichtbaren Stücke, die dazu gehören (`ofen/…`).
   */
  const box = new Box3()
  const mitteVon = (slot: string): Vector3 | null => {
    if (!model) return null
    model.updateMatrixWorld()
    for (const child of model.children) {
      if (!child.visible) continue
      if (parseProduktName(child.userData.name)?.slot !== slot) continue
      box.setFromObject(child)
      if (box.isEmpty()) continue
      return box.getCenter(new Vector3())
    }
    const gruppe = new Box3()
    const teil = new Box3()
    for (const child of model.children) {
      if (!child.visible) continue
      const id = slotVon(child.userData)
      if (!id || !gehoertZu(id, slot)) continue
      teil.setFromObject(child)
      if (!teil.isEmpty()) gruppe.union(teil)
    }
    return gruppe.isEmpty() ? null : gruppe.getCenter(new Vector3())
  }

  /** Bildpunkt (CSS-px, relativ zum Canvas) und ob er vor der Kamera liegt. */
  const bildpunkt = (welt: Vector3) => {
    camera.updateMatrixWorld()
    const imBlick = welt.clone().applyMatrix4(camera.matrixWorldInverse)
    const p = welt.clone().project(camera)
    return {
      x: ((p.x + 1) / 2) * width,
      y: ((1 - p.y) / 2) * height,
      vorn: imBlick.z < 0,
      /** Liegt der Punkt rechts der Blickrichtung? (gilt auch hinter der Kamera) */
      rechts: imBlick.x > 0,
    }
  }

  const tippRadius = (zeiger: string) =>
    zeiger === 'mouse' ? MAUS_RADIUS_PX : TIPP_RADIUS_PX

  /** Höchstens so oft führt `haltFrei` nach (die Rechnung ist eine Näherung). */
  const NACHFUEHRUNGEN = 2
  /** Nach dem Ende des laufenden Schwenks noch einmal prüfen (Runde). */
  let nachRuhe: number | null = null

  /**
   * Den gewählten Platz in den freien Teil des Bildes drehen (neben die
   * Karte, ins Bild) und melden, ob das gelungen ist. Der nötige Schwenk ist
   * aus dem Bildpunkt genähert (bei geneigter Kamera nicht exakt), darum
   * prüft die Funktion nach dem Ende der Fahrt noch einmal und führt nach.
   * Gemeldet wird am Schluss, wo das Produkt wirklich steht.
   */
  function haltFrei(runde = 0) {
    nachRuhe = null
    const slot = gewaehlt
    if (disposed || !slot || !model || override || introLauf) return
    if (width === 0 || height === 0) return
    const mitte = mitteVon(slot)
    if (!mitte) {
      options.onAuswahlImBild?.(slot, false)
      return
    }
    const rect = canvas.getBoundingClientRect()
    const bild = { breite: width, hoehe: height }
    const k = verdecktVon?.() ?? null
    const karte = k
      ? {
          left: k.left - rect.left,
          top: k.top - rect.top,
          right: k.right - rect.left,
          bottom: k.bottom - rect.top,
        }
      : null
    const p = bildpunkt(mitte)
    const schwenk = p.vorn
      ? schwenkFuer(p, freierBereich(bild, karte), bild, camera.fov)
      : // Hinter der Kamera gibt es keinen Bildpunkt: grob in die Richtung drehen.
        // (Blick nach rechts = das Bild wandert nach links = dYaw < 0.)
        { dYaw: p.rechts ? -Math.PI / 2 : Math.PI / 2, dPitch: 0 }
    if (!schwenk) {
      options.onAuswahlImBild?.(slot, true)
      return
    }
    if (runde >= NACHFUEHRUNGEN) {
      // Mehr geht von hier nicht: Steht es wenigstens (knapp) im freien Bild?
      const knapp = freierBereich(bild, karte, IM_BILD_RAND_PX)
      options.onAuswahlImBild?.(
        slot,
        p.vorn &&
          p.x >= knapp.left &&
          p.x <= knapp.right &&
          p.y >= knapp.top &&
          p.y <= knapp.bottom
      )
      return
    }
    // Ruht der Schwenk (Fahrt zu einem Blickpunkt), kommt `haltFrei` bei der
    // Ankunft noch einmal.
    if (!rig.schwenken(schwenk.dYaw, schwenk.dPitch)) return
    if (rig.bewegt()) nachRuhe = runde + 1
    else haltFrei(runde + 1)
  }
  rig.onRuhe(() => {
    if (nachRuhe !== null) haltFrei(nachRuhe)
  })

  rig.onTap((x, y, zeiger) => {
    const treffer = picker?.pickAt(x, y, { radiusPx: tippRadius(zeiger) })
    if (treffer?.produkt) {
      options.onTreffer?.(treffer)
      return
    }
    // Kein Produkt: Die App bekommt das getroffene Stück trotzdem - an ihm
    // kann ein Infopunkt oder eine Tür hängen (sonst schließt sie die Karte).
    options.onTreffer?.(treffer ?? null)
    // Neutrale Ware hat keine Karte, aber der Tipp soll sichtbar ankommen:
    // kurz aufleuchten. Die Auswahl ist damit schon aufgehoben - `waehle(null)`
    // aus der App fasst die Hervorhebung dann nicht mehr an.
    if (treffer?.ware && picker) {
      gewaehlt = null
      picker.highlight(null)
      picker.highlight(treffer.slot, { flash: true })
    }
  })
  // Doppeltipp auf Ware zoomt heran; der nächste Doppeltipp - egal wohin -
  // zoomt wieder zur Startweite zurück. Ein Doppeltipp ins Leere zoomt aus
  // jeder Zoomstufe zurück.
  rig.onDoubleTap((x, y, zeiger) => {
    if (rig.istGezoomt()) {
      rig.zoomZurueck()
      return
    }
    const treffer = picker?.pickAt(x, y, { radiusPx: tippRadius(zeiger) })
    if (treffer && (treffer.produkt || treffer.ware)) rig.zoomTo(treffer.punkt)
    else rig.zoomZurueck()
  })
  rig.onFirstGesture(() => options.onErsteGeste?.())
  rig.onWechselGeste((richtung) => options.onWechselGeste?.(richtung))

  // --- Flug zum Start (Rechnung: intro.ts) ---------------------------------
  // Der Flug führt die Kamera selbst, mit einem eigenen Takt nur für seine
  // Dauer; das Rig steht derweil gesperrt schon am Ziel und übernimmt am Ende.

  /** Die Kamera des Flugs zur Filmzeit, für das aktuelle Bildformat. */
  const introAnsicht = (flug: Intro, sekunden: number): Ansicht => {
    const ende = ansichtFuer(blickpunkt, camera.aspect)
    return { ...introPose(flug, sekunden, ende), hochformat: ende.hochformat }
  }

  const beendeIntro = (grund: IntroEnde) => {
    const lauf = introLauf
    if (!lauf) return
    introLauf = null
    if (lauf.raf) cancelAnimationFrame(lauf.raf)
    canvas.removeEventListener('pointerdown', onIntroZeiger)
    window.removeEventListener('keydown', onIntroTaste, true)
    document.removeEventListener('visibilitychange', onIntroSichtbarkeit)
    introEnde = grund
    introBilder = lauf.bilder
    introSekunden = lauf.sekunden
    if (disposed) return
    rig.sperren(false)
    // Das Rig übernimmt in der Ruhelage des Blickpunkts - genau dort endet
    // der Flug. `onAnkunft` regelt den Außenraum wie bei jedem Blickpunkt.
    rig.setBlickpunkt(blickpunkt, { animate: false })
    requestRender()
    options.onIntro?.(false)
  }

  const introTakt = (jetzt: number) => {
    const lauf = introLauf
    if (!lauf || disposed) return
    lauf.raf = 0
    // Die Uhr läuft ab dem ersten Bild: Das Hochladen des Modells auf die
    // Grafikkarte davor kostet keine Flugzeit.
    if (lauf.start === 0) lauf.start = jetzt
    else if (jetzt - lauf.letztes > MAX_PAUSE_MS) {
      beendeIntro('langsam')
      return
    }
    lauf.letztes = jetzt
    const ms = jetzt - lauf.start
    lauf.sekunden = ms / 1000
    if (lauf.sekunden >= introDauer(lauf.intro)) {
      beendeIntro('ende')
      return
    }
    if (!lauf.geprueft && ms >= BILDRATE_NACH_MS) {
      lauf.geprueft = true
      // Statt acht Sekunden zu ruckeln: gleich an die Theke.
      if (zuLangsam(lauf.bilder, ms)) {
        beendeIntro('langsam')
        return
      }
    }
    applyView(introAnsicht(lauf.intro, lauf.sekunden))
    renderNow()
    lauf.bilder += 1
    lauf.raf = requestAnimationFrame(introTakt)
  }

  /** Jeder Tipp oder Klick ins Bild überspringt. */
  function onIntroZeiger() {
    beendeIntro('uebersprungen')
  }
  function onIntroTaste(e: KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    beendeIntro('uebersprungen')
  }
  /** Im Hintergrund läuft kein Takt: sauber an der Theke enden. */
  function onIntroSichtbarkeit() {
    if (document.visibilityState === 'hidden') beendeIntro('verborgen')
  }

  const starteIntro = (flug: Intro) => {
    if (introLauf) beendeIntro('uebersprungen')
    override = null
    const lauf = {
      intro: flug,
      start: 0,
      letztes: 0,
      sekunden: 0,
      bilder: 0,
      geprueft: false,
      raf: 0,
    }
    introLauf = lauf
    rig.sperren(true)
    // Das Rig steht schon am Ziel (eine laufende Fahrt dorthin wird geschnitten).
    rig.setBlickpunkt(blickpunkt, { animate: false })
    zeigeAussenraum(true)
    applyView(introAnsicht(flug, 0))
    canvas.addEventListener('pointerdown', onIntroZeiger)
    window.addEventListener('keydown', onIntroTaste, true)
    document.addEventListener('visibilitychange', onIntroSichtbarkeit)
    options.onIntro?.(true)
    if (document.visibilityState === 'hidden') {
      beendeIntro('verborgen')
      return
    }
    lauf.raf = requestAnimationFrame(introTakt)
  }

  const resize = () => {
    if (disposed) return
    const rect = container.getBoundingClientRect()
    width = Math.round(rect.width)
    height = Math.round(rect.height)
    if (width === 0 || height === 0) return
    renderer.setPixelRatio(cappedPixelRatio(window.devicePixelRatio))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    if (override) applyView(override)
    else {
      rig.resize(camera.aspect)
      // Mitten im Flug gedreht: Das Rig kennt jetzt die Ruhelage des neuen
      // Formats, der Flug blendet in sie über - die Kamera führt weiter er.
      if (introLauf) {
        applyView(introAnsicht(introLauf.intro, introLauf.sekunden))
      }
    }
    // Neue Größe oder gedreht: Die Karte liegt jetzt woanders.
    haltFrei()
    // setSize leert das Canvas - gleich neu zeichnen, sonst blitzt es beim Drehen.
    if (model) renderNow()
    else requestRender()
  }
  const resizeObserver =
    typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
  resizeObserver?.observe(container)
  window.addEventListener('orientationchange', resize)
  resize()

  const onContextLost = (event: Event) => {
    event.preventDefault()
    if (!disposed) options.onLost()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  // Laden: 0…0,9 Download, danach Entpacken (meshopt) und erstes Bild.
  options.onProgress(0)
  loadModel(options.modelUrl, abort.signal, options.modelBytes, (f) => {
    if (!disposed) options.onProgress(0.9 * f)
  })
    .then((root) => {
      if (disposed) {
        disposeTree(root)
        return
      }
      // Reihenfolge: Morgens-Filter, Preisschilder weg (DB8), dann das
      // Verzeichnis der antippbaren Flächen über dem fertigen Baum.
      fill = applyFill(root as unknown as FillNode, options.fuellung)
      preisschilder = blendePreiskartenAus(root)
      model = root
      scene.add(root)
      zeigeAussenraum(blickpunkt.aussenSichtbar !== false)
      picker = createPicker({ root, camera, element: canvas, requestRender })
      if (gewaehlt) picker.highlight(gewaehlt)
      // Ohne Bewegung (prefers-reduced-motion) gibt es keinen Flug.
      intro = reducedMotion
        ? null
        : waehleIntro(
            options.intros,
            root.children.map((k) => String(k.userData.name ?? k.name)),
            blickpunkt.id
          )
      // Vor dem ersten Bild: Es zeigt dann schon die Straße, nicht die Theke.
      if (intro && options.introSpielen !== false) starteIntro(intro)
      resize()
      renderNow()
      firstFrameMs = performance.now()
      try {
        performance.mark('digitale-baeckerei:erstes-bild')
      } catch {
        /* nur zum Messen */
      }
      options.onProgress(1)
      options.onReady({
        firstFrameMs,
        triangles: countTriangles(root, true),
        fill,
        intro: intro ? { id: intro.id, laeuft: introLauf !== null } : null,
      })
    })
    .catch((err) => {
      if (disposed || abort.signal.aborted) return
      options.onError(err)
    })

  if (options.debug) {
    const debug: ViewerDebug = {
      get ready() {
        return model !== null
      },
      get firstFrameMs() {
        return firstFrameMs
      },
      get frames() {
        return frames
      },
      info: () => ({
        triangles: model ? countTriangles(model) : 0,
        visibleTriangles: model ? countTriangles(model, true) : 0,
        drawCalls: renderer.info.render.calls,
        renderedTriangles: renderer.info.render.triangles,
        pixelRatio: renderer.getPixelRatio(),
        size: [width, height],
        fov: camera.fov,
        fill,
        blickpunkt: blickpunkt.id,
        eye: camera.position.toArray(),
        richtung: camera.getWorldDirection(new Vector3()).toArray(),
        preisschilder,
        aussenSichtbar,
        intro: {
          laeuft: introLauf !== null,
          id: intro?.id ?? null,
          ende: introEnde,
          bilder: introLauf?.bilder ?? introBilder,
          sekunden: introLauf?.sekunden ?? introSekunden,
        },
      }),
      spin: (ms) =>
        new Promise((resolve) => {
          const base = ansichtFuer(blickpunkt, camera.aspect)
          const dir = new Vector3(
            base.look[0] - base.eye[0],
            base.look[1] - base.eye[1],
            base.look[2] - base.eye[2]
          )
          const up = new Vector3(0, 1, 0)
          const times: number[] = []
          const start = performance.now()
          let last = start
          const step = (now: number) => {
            if (disposed) return
            const t = now - start
            // ± 15° schwenken, wie später beim Umschauen
            const yaw = Math.sin(t / 600) * ((15 * Math.PI) / 180)
            const d = dir.clone().applyAxisAngle(up, yaw)
            override = {
              ...base,
              look: [base.eye[0] + d.x, base.eye[1] + d.y, base.eye[2] + d.z],
            }
            applyView(override)
            renderNow()
            times.push(now - last)
            last = now
            if (t < ms) {
              requestAnimationFrame(step)
              return
            }
            // Zurück an das Rig: Es setzt die Kamera wieder auf seine Pose.
            override = null
            rig.resize(camera.aspect)
            renderNow()
            const deltas = times.slice(1).sort((a, b) => a - b)
            const seconds = (last - start) / 1000
            const at = (q: number) =>
              deltas.length
                ? deltas[
                    Math.min(deltas.length - 1, Math.floor(q * deltas.length))
                  ]
                : 0
            resolve({
              frames: deltas.length,
              seconds,
              fps: seconds > 0 ? deltas.length / seconds : 0,
              medianFrameMs: at(0.5),
              p95FrameMs: at(0.95),
            })
          }
          requestAnimationFrame(step)
        }),
      pixelStats: () => {
        renderNow()
        const gl = renderer.getContext()
        const w = gl.drawingBufferWidth
        const h = gl.drawingBufferHeight
        const px = new Uint8Array(4)
        const colours = new Map<string, number>()
        const grid = 24
        for (let iy = 0; iy < grid; iy += 1) {
          for (let ix = 0; ix < grid; ix += 1) {
            const x = Math.floor(((ix + 0.5) / grid) * w)
            const y = Math.floor(((iy + 0.5) / grid) * h)
            gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
            const key = `${px[0]},${px[1]},${px[2]}`
            colours.set(key, (colours.get(key) ?? 0) + 1)
          }
        }
        const bg = HORIZON.map((c) => Math.round(c * 255)).join(',')
        return {
          samples: grid * grid,
          distinct: colours.size,
          backgroundShare: (colours.get(bg) ?? 0) / (grid * grid),
        }
      },
      setView: (eye, look, fov) => {
        override = { eye, look, fov, hochformat: camera.aspect < 1 }
        applyView(override)
        renderNow()
      },
      introBild: (sekunden) => {
        if (!intro || !model) return null
        if (introLauf) beendeIntro('uebersprungen')
        setzeAussenraum(model, true)
        override = introAnsicht(intro, sekunden)
        applyView(override)
        renderNow()
        return introDauer(intro)
      },
      nodes: (prefix = '') => {
        if (!model) return []
        model.updateMatrixWorld(true)
        const box = new Box3()
        const out: ReturnType<ViewerDebug['nodes']> = []
        for (const child of model.children) {
          const name = String(child.userData.name ?? child.name)
          if (!name.startsWith(prefix)) continue
          box.setFromObject(child)
          const round = (v: Vector3) =>
            v.toArray().map((n) => Math.round(n * 100) / 100)
          out.push({
            name,
            visible: child.visible,
            min: round(box.min),
            max: round(box.max),
            extras: { ...child.userData },
          })
        }
        return out
      },
      screenPos: (slot) => {
        const mitte = mitteVon(slot)
        if (!mitte) return null
        const p = bildpunkt(mitte)
        if (!p.vorn || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
          return null
        }
        const rect = canvas.getBoundingClientRect()
        return { x: rect.left + p.x, y: rect.top + p.y }
      },
      get hervorgehoben() {
        return picker?.hervorgehoben.slot ?? null
      },
      get gewaehlt() {
        return gewaehlt
      },
    }
    window.__digitaleBaeckerei = debug
    debugHook = debug
  }

  return {
    setBlickpunkt: (neu) => {
      if (disposed || neu.id === blickpunkt.id) return
      // Ein Wechsel mitten im Flug: erst an dessen Ziel, dann von dort weiter.
      beendeIntro('uebersprungen')
      blickpunkt = neu
      override = null
      // Vor der Fahrt einblenden; nach der Ankunft blendet `onAnkunft` aus.
      if (neu.aussenSichtbar !== false) zeigeAussenraum(true)
      rig.setBlickpunkt(neu)
      requestRender()
    },
    setLabel: (label) => {
      canvas.setAttribute('aria-label', label)
    },
    waehle: (slot, verdeckt) => {
      if (disposed) return
      verdecktVon = slot ? verdeckt ?? null : null
      // Dieselbe Auswahl noch einmal (oder schon durch einen Tipp auf Ware
      // aufgehoben): die Hervorhebung nicht anfassen - ein laufendes
      // Aufleuchten bliebe sonst stehen.
      if (slot !== gewaehlt) {
        gewaehlt = slot
        picker?.highlight(slot)
      }
      haltFrei()
    },
    haltFrei: () => haltFrei(),
    spieleIntro: () => {
      if (disposed || !model || !intro || intro.ziel !== blickpunkt.id) {
        return false
      }
      starteIntro(intro)
      renderNow()
      return true
    },
    ueberspringeIntro: () => beendeIntro('uebersprungen'),
    dispose: () => {
      if (disposed) return
      beendeIntro('uebersprungen')
      disposed = true
      abort.abort()
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      rig.dispose()
      // Vor dem Modell: Die Überzüge der Hervorhebung hängen an dessen Meshes.
      picker?.dispose()
      picker = null
      resizeObserver?.disconnect()
      window.removeEventListener('orientationchange', resize)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      if (model) {
        scene.remove(model)
        disposeTree(model)
        model = null
      }
      scene.clear()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
      // Nur den eigenen Haken entfernen (StrictMode: das zweite Mounten hat schon seinen).
      if (debugHook && window.__digitaleBaeckerei === debugHook) {
        delete window.__digitaleBaeckerei
      }
    },
  }
}
