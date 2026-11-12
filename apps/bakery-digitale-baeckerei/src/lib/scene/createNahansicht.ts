/**
 * Die Nahansicht eines Produkts („In 3D ansehen“): ein eigener, kleiner
 * Renderer mit dem 3D-Modell aus dem Daten-Repo `produkte-3d` auf einem
 * Drehteller. Entsteht erst beim Öffnen und gibt beim Schließen alles frei -
 * die Szene des Ladens (createViewer.ts) behält ihren eigenen Kontext.
 *
 * **Licht und Renderer wie die Vorschau des Daten-Repos**
 * (`produkte-3d/preview/index.html`): Diese Modelle sind beleuchtetes PBR -
 * anders als der Laden (unlit, Licht in den Vertex-Farben). Also
 * `RoomEnvironment` (prozedural, keine Fremddatei) mit Stärke 0,75, ein
 * Richtungslicht, Ausgabe sRGB, `NeutralToneMapping`, Belichtung 1, dazu der
 * weiche Kontaktschatten der Vorschau. Nicht „verbessern“, ohne die Vorschau
 * dort mitzuziehen.
 *
 * Gerendert wird nur bei Bedarf: eine langsame Runde beim Öffnen (nicht bei
 * `prefers-reduced-motion`), danach nur noch bei Bedienung.
 *
 * Importiert three - nur über `ladeNahansicht()` nachladen, nie statisch.
 */
import {
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'
import type { Material, Object3D, Texture, WebGLRenderTarget } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  FOV_GRAD,
  NEAR,
  RUNDE_MS,
  anfangsRunde,
  begrenze,
  kameraOrt,
  naechsterZoom,
  passAbstand,
  startZustand,
  zielpunkt,
  type Drehteller,
  type Rahmen,
  type Vec3,
} from './drehteller'
import { createDrehtellerControls } from './drehtellerControls'
import { countTriangles, disposeTree, loadModel } from './loadModel'
import { cappedPixelRatio } from './view'

/** Hintergrund der Bühne (sRGB) - wie in der Vorschau des Daten-Repos. */
export const BUEHNE = '#efe9df'
/** Stärke der Umgebung und das Hauptlicht - Werte der Vorschau. */
const UMGEBUNG_STAERKE = 0.75
const LICHT_FARBE = '#fff1dc'
const LICHT_STAERKE = 2.2
const LICHT_ORT: Vec3 = [-0.5, 1.0, 0.6]
const FAR = 50

export interface NahansichtReadyInfo {
  /** ms vom Aufruf bis zum ersten Bild mit Modell. */
  ersteBildMs: number
  triangles: number
}

export interface NahansichtOptions {
  /** Adresse der GLB-Datei. */
  url: string
  /** Erwartete Größe in Bytes (aus dem Index), für den Fortschritt. */
  bytes?: number
  /** Text für Screenreader am Canvas. */
  label: string
  /** `prefers-reduced-motion`: keine Runde beim Öffnen. */
  reducedMotion: boolean
  /** Legt `window.__digitaleBaeckereiNahansicht` zum Messen an (nur mit `?debug`). */
  debug?: boolean
  onProgress: (fraction: number) => void
  onReady: (info: NahansichtReadyInfo) => void
  /** Das Modell ließ sich nicht laden. */
  onError: (error: unknown) => void
  /** Der WebGL-Kontext ging verloren. */
  onLost: () => void
}

export interface NahansichtHandle {
  dispose: () => void
}

export interface NahansichtDebug {
  ready: boolean
  frames: number
  ersteBildMs: number | null
  /** Läuft die Runde vom Öffnen noch? */
  dreht: boolean
  info: () => {
    triangles: number
    pixelRatio: number
    size: [number, number]
    zustand: Drehteller
    abstand: number
    zoomMin: number
    rahmen: Rahmen | null
    texturen: number
  }
  /**
   * Zeichnet neu und liest ein Raster von Pixeln: Anteil des Hintergrunds,
   * Zahl der Farben, der Bildausschnitt des Produkts (Anteil von Breite und
   * Höhe) und eine Prüfsumme des Rasters (ändert sich, wenn sich das Bild
   * ändert).
   */
  pixelStats: () => {
    samples: number
    distinct: number
    backgroundShare: number
    breite: number
    hoehe: number
    mitteX: number
    mitteY: number
    summe: string
  }
  /** Den Blick setzen (Bogenmaß, Zoom) - zum Messen und für Bilder. */
  setze: (zustand: Partial<Drehteller>) => void
}

declare global {
  interface Window {
    __digitaleBaeckereiNahansicht?: NahansichtDebug
  }
}

/** Der weiche Schatten unter dem Produkt, als gezeichnete Textur (keine Datei). */
function schattenTextur(): CanvasTexture | null {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')
  if (!g) return null
  const verlauf = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  verlauf.addColorStop(0, 'rgba(60,40,20,0.38)')
  verlauf.addColorStop(0.55, 'rgba(60,40,20,0.16)')
  verlauf.addColorStop(1, 'rgba(60,40,20,0)')
  g.fillStyle = verlauf
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

/** Dekodierte Bilder (ImageBitmap) der Texturen sofort freigeben. */
function schliesseBilder(root: Object3D): number {
  const gesehen = new Set<Texture>()
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    for (const material of ([] as Material[]).concat(mesh.material ?? [])) {
      for (const value of Object.values(material)) {
        if ((value as Texture | null)?.isTexture) gesehen.add(value as Texture)
      }
    }
  })
  for (const textur of gesehen) {
    const bild = textur.image as { close?: () => void } | null | undefined
    try {
      bild?.close?.()
    } catch {
      /* schon geschlossen */
    }
  }
  return gesehen.size
}

/**
 * Gibt frei, was dieser Renderer für Texturen angelegt hat, die ihm nicht
 * gehören. three hält die Tabelle für PBR-Materialien (`DFG_LUT`) als eine
 * einzige Textur für alle Renderer und hängt bei der ersten Benutzung einen
 * `dispose`-Lauscher des Renderers daran - `renderer.dispose()` nimmt ihn
 * nicht wieder weg. Ohne diesen Schritt bliebe mit jedem Öffnen ein ganzer
 * WebGL-Kontext samt Canvas im Speicher hängen. `dispose()` der Textur löst
 * genau diesen Eintrag; braucht sie ein anderer Renderer, lädt three sie neu.
 */
function loeseGeteilteTexturen(renderer: WebGLRenderer, root: Object3D): void {
  const gesehen = new Set<Texture>()
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    for (const material of ([] as Material[]).concat(mesh.material ?? [])) {
      const uniforms = (
        renderer.properties.get(material) as {
          uniforms?: Record<string, { value?: unknown } | undefined>
        }
      ).uniforms
      if (!uniforms) continue
      for (const uniform of Object.values(uniforms)) {
        const wert = uniform?.value as Texture | null | undefined
        if (wert?.isTexture) gesehen.add(wert)
      }
    }
  })
  for (const textur of gesehen) textur.dispose()
}

/**
 * Baut die Nahansicht in `container`. Liefert `null`, wenn kein
 * WebGL-Kontext entsteht (dann ist nichts angelegt). Jeder Aufruf hat ein
 * eigenes Canvas (React StrictMode: abbauen und neu aufbauen ist sauber).
 */
export function createNahansicht(
  container: HTMLElement,
  options: NahansichtOptions
): NahansichtHandle | null {
  const geoeffnet = performance.now()
  const canvas = document.createElement('canvas')
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', options.label)
  // Fokussierbar: Pfeiltasten drehen, +/- zoomen.
  canvas.tabIndex = 0
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent')
  container.prepend(canvas)

  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'default',
    })
  } catch {
    canvas.remove()
    return null
  }
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = NeutralToneMapping
  renderer.toneMappingExposure = 1
  renderer.setPixelRatio(cappedPixelRatio(window.devicePixelRatio))

  const scene = new Scene()
  scene.background = new Color(BUEHNE)
  // Die Umgebung einmal backen; Generator und Raum braucht danach niemand mehr.
  let umgebung: WebGLRenderTarget | null = null
  {
    const pmrem = new PMREMGenerator(renderer)
    const raum = new RoomEnvironment()
    umgebung = pmrem.fromScene(raum, 0.04)
    raum.dispose()
    pmrem.dispose()
  }
  scene.environment = umgebung.texture
  scene.environmentIntensity = UMGEBUNG_STAERKE
  const licht = new DirectionalLight(LICHT_FARBE, LICHT_STAERKE)
  licht.position.set(LICHT_ORT[0], LICHT_ORT[1], LICHT_ORT[2])
  scene.add(licht)

  const camera = new PerspectiveCamera(FOV_GRAD, 1, NEAR, FAR)

  const abort = new AbortController()
  let disposed = false
  let model: Object3D | null = null
  let schatten: Mesh<PlaneGeometry, MeshBasicMaterial> | null = null
  let rahmen: Rahmen | null = null
  let ziel: Vec3 = [0, 0, 0]
  let abstand = 1
  let zoomMin = 1
  let zustand = startZustand()
  let raf = 0
  let width = 0
  let height = 0
  let frames = 0
  let ersteBildMs: number | null = null
  /** Die Runde vom Öffnen: Startzeit und Ausgangswinkel, solange sie läuft. */
  let runde: { start: number; yaw: number } | null = null
  let texturen = 0
  let debugHook: NahansichtDebug | null = null

  const stelleKamera = () => {
    const ort = kameraOrt(zustand, ziel, abstand)
    camera.position.set(ort[0], ort[1], ort[2])
    camera.up.set(0, 1, 0)
    camera.lookAt(ziel[0], ziel[1], ziel[2])
  }

  const renderNow = () => {
    if (disposed || width === 0 || height === 0) return
    stelleKamera()
    renderer.render(scene, camera)
    frames += 1
  }

  /** Höchstens ein Bild je Animation-Frame, kein Dauer-Loop. */
  const requestRender = () => {
    if (raf || disposed) return
    raf = requestAnimationFrame((now) => {
      raf = 0
      if (runde) {
        const t = now - runde.start
        zustand = begrenze(
          { ...zustand, yaw: runde.yaw + anfangsRunde(t) },
          zoomMin
        )
        if (t >= RUNDE_MS) runde = null
      }
      renderNow()
      if (runde) requestRender()
    })
  }

  const controls = createDrehtellerControls({
    element: canvas,
    lies: () => ({ zustand, zoomMin }),
    setze: (neu) => {
      if (!model) return
      zustand = neu
      requestRender()
    },
    // Wer selbst dreht, beendet die Runde - der Blick bleibt, wo er ist.
    onGeste: () => {
      runde = null
    },
  })

  /** Abstand und Grenzen für die aktuelle Bildgröße. */
  const passeAn = () => {
    if (!rahmen || width === 0 || height === 0) return
    abstand = passAbstand(rahmen, width / height)
    zoomMin = naechsterZoom(rahmen, abstand)
    zustand = begrenze(zustand, zoomMin)
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
    camera.updateProjectionMatrix()
    passeAn()
    // setSize leert das Canvas - gleich neu zeichnen.
    renderNow()
  }
  const resizeObserver =
    typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
  resizeObserver?.observe(container)
  window.addEventListener('orientationchange', resize)
  resize()

  const onContextLost = (event: Event) => {
    event.preventDefault()
    if (disposed) return
    runde = null
    options.onLost()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  options.onProgress(0)
  loadModel(options.url, abort.signal, options.bytes, (f) => {
    if (!disposed) options.onProgress(0.9 * f)
  })
    .then((root) => {
      if (disposed) {
        schliesseBilder(root)
        disposeTree(root)
        return
      }
      // Immer die ganze Szene einhängen (Vertrag des Daten-Repos: der
      // Mesh-Knoten trägt wegen der Quantisierung Skalierung und Verschiebung).
      model = root
      scene.add(root)
      root.updateMatrixWorld(true)
      const box = new Box3().setFromObject(root)
      if (box.isEmpty()) throw new Error('Das Modell ist leer')
      rahmen = { min: box.min.toArray(), max: box.max.toArray() }
      ziel = zielpunkt(rahmen)

      const textur = schattenTextur()
      if (textur) {
        schatten = new Mesh(
          new PlaneGeometry(
            (box.max.x - box.min.x) * 1.5,
            (box.max.z - box.min.z) * 1.5
          ),
          new MeshBasicMaterial({
            map: textur,
            transparent: true,
            depthWrite: false,
          })
        )
        schatten.rotation.x = -Math.PI / 2
        schatten.position.set(ziel[0], box.min.y - 0.0005, ziel[2])
        scene.add(schatten)
      }

      resize()
      renderNow()
      ersteBildMs = performance.now() - geoeffnet
      try {
        performance.mark('digitale-baeckerei:nahansicht-erstes-bild')
      } catch {
        /* nur zum Messen */
      }
      options.onProgress(1)
      options.onReady({ ersteBildMs, triangles: countTriangles(root) })
      if (!options.reducedMotion) {
        runde = { start: performance.now(), yaw: zustand.yaw }
        requestRender()
      }
    })
    .catch((err) => {
      if (disposed || abort.signal.aborted) return
      options.onError(err)
    })

  if (options.debug) {
    const debug: NahansichtDebug = {
      get ready() {
        return model !== null && ersteBildMs !== null
      },
      get frames() {
        return frames
      },
      get ersteBildMs() {
        return ersteBildMs
      },
      get dreht() {
        return runde !== null
      },
      info: () => {
        if (model) {
          const gesehen = new Set<Texture>()
          model.traverse((node) => {
            const mesh = node as Mesh
            if (!mesh.isMesh) return
            for (const m of ([] as Material[]).concat(mesh.material ?? [])) {
              for (const v of Object.values(m)) {
                if ((v as Texture | null)?.isTexture) gesehen.add(v as Texture)
              }
            }
          })
          texturen = gesehen.size
        }
        return {
          triangles: model ? countTriangles(model) : 0,
          pixelRatio: renderer.getPixelRatio(),
          size: [width, height],
          zustand: { ...zustand },
          abstand,
          zoomMin,
          rahmen,
          texturen,
        }
      },
      pixelStats: () => {
        renderNow()
        const gl = renderer.getContext()
        const w = gl.drawingBufferWidth
        const h = gl.drawingBufferHeight
        const px = new Uint8Array(4)
        const farben = new Map<string, number>()
        const raster = 32
        // Hintergrund: was in der Ecke steht (Tone-Mapping verschiebt den Wert leicht).
        gl.readPixels(1, h - 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
        const ecke = [px[0], px[1], px[2]]
        let summe = 0
        let hintergrund = 0
        let minX = raster
        let maxX = -1
        let minY = raster
        let maxY = -1
        for (let iy = 0; iy < raster; iy += 1) {
          for (let ix = 0; ix < raster; ix += 1) {
            const x = Math.floor(((ix + 0.5) / raster) * w)
            const y = Math.floor(((iy + 0.5) / raster) * h)
            gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
            const key = `${px[0]},${px[1]},${px[2]}`
            farben.set(key, (farben.get(key) ?? 0) + 1)
            summe = (summe * 31 + px[0] * 65536 + px[1] * 256 + px[2]) >>> 0
            // Deutlich anders als der Hintergrund (nicht nur der zarte Schatten)?
            const fern =
              Math.abs(px[0] - ecke[0]) +
              Math.abs(px[1] - ecke[1]) +
              Math.abs(px[2] - ecke[2])
            if (fern <= 6) hintergrund += 1
            if (fern > 60) {
              minX = Math.min(minX, ix)
              maxX = Math.max(maxX, ix)
              minY = Math.min(minY, iy)
              maxY = Math.max(maxY, iy)
            }
          }
        }
        const gefunden = maxX >= 0
        return {
          samples: raster * raster,
          distinct: farben.size,
          backgroundShare: hintergrund / (raster * raster),
          breite: gefunden ? (maxX - minX + 1) / raster : 0,
          hoehe: gefunden ? (maxY - minY + 1) / raster : 0,
          mitteX: gefunden ? (minX + maxX + 1) / 2 / raster : 0,
          // readPixels zählt von unten.
          mitteY: gefunden ? 1 - (minY + maxY + 1) / 2 / raster : 0,
          summe: summe.toString(16),
        }
      },
      setze: (neu) => {
        runde = null
        zustand = begrenze({ ...zustand, ...neu }, zoomMin)
        renderNow()
      },
    }
    window.__digitaleBaeckereiNahansicht = debug
    debugHook = debug
  }

  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      runde = null
      abort.abort()
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      controls.dispose()
      resizeObserver?.disconnect()
      window.removeEventListener('orientationchange', resize)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      if (model) {
        scene.remove(model)
        loeseGeteilteTexturen(renderer, model)
        schliesseBilder(model)
        disposeTree(model)
        model = null
      }
      if (schatten) {
        scene.remove(schatten)
        schatten.geometry.dispose()
        schatten.material.map?.dispose()
        schatten.material.dispose()
        schatten = null
      }
      scene.environment = null
      umgebung?.dispose()
      umgebung = null
      licht.dispose()
      scene.clear()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
      // Nur den eigenen Haken entfernen (StrictMode: das zweite Mounten hat schon seinen).
      if (debugHook && window.__digitaleBaeckereiNahansicht === debugHook) {
        delete window.__digitaleBaeckereiNahansicht
      }
    },
  }
}
