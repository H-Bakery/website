/**
 * Hervorhebung eines angetippten oder in der Liste gewählten Platzes: warmer
 * Umriss (umgestülpte Hülle, feste Breite in Pixeln), dünne dunkle Kante
 * außen und ein Randleuchten (additiv, Fresnel) in aufgehelltem Messing.
 *
 * Das Modell ist unlit mit Vertex-Farben; seine Materialien werden nie
 * angefasst. Die Hervorhebung hängt je Mesh drei Überzüge an, die dessen
 * Geometrie teilen, und nimmt sie beim Wechsel wieder ab - danach ist der
 * Baum wie zuvor. Die drei Shader-Materialien gehören dieser Datei und werden
 * in `dispose()` freigegeben.
 *
 * Gerendert wird nur bei Bedarf: Jede Änderung ruft `requestRender()`, eine
 * eigene rAF-Schleife läuft nur während des Ein- und Ausblendens.
 *
 * Herkunft: `TwinHighlight` (Shader, Farben, Breiten) aus dem Saar LiDAR
 * Explorer (github.com/Open-Kirrberg/saar-lidar-explorer, MIT, gleicher
 * Urheber), `app/src/zones/runtime/twinPick.ts`; Ablauf nach
 * `twinInteract.ts`. Ohne Anheben und ohne Bilderrahmen für flache Ziele.
 *
 * Importiert three - nur aus der nachgeladenen Viewer-Komponente verwenden.
 */
import {
  AdditiveBlending,
  BackSide,
  FrontSide,
  LessEqualDepth,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three'
import type { WebGLRenderer } from 'three'
import { BLITZ_MS, blitzStaerke, einblenden, EINBLENDEN_MS } from './treffer'

/** `messing` #C29A4B, 30 % zu Weiß gemischt (sRGB). */
export const HIGHLIGHT_SRGB: readonly [number, number, number] = [
  0xd4 / 255,
  0xb8 / 255,
  0x81 / 255,
]
/** Dunkle Kante außen `#3A2A22` (Kontrast auf hellen Flächen). */
export const INK_SRGB: readonly [number, number, number] = [
  0x3a / 255,
  0x2a / 255,
  0x22 / 255,
]
/** Breiten in CSS-px: warmes Band, dunkle Kante außen. */
export const OUTLINE_PX = 3
export const INK_PX = 4.5

/** Kennzeichen der Überzüge in `userData` (nie antippbar, nie Ziel). */
export const UEBERZUG = 'dbUeberzug'

// Versatz entlang der Normalen im Bild; wo die Normale längs des Sehstrahls
// liegt, stattdessen von der Mitte des Ziels weg.
const OUTLINE_VS = /* glsl */ `
uniform float uWidth;
uniform vec2 uRes;
uniform vec3 uCentre;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  vec3 nv = normalize( normalMatrix * normal );
  vec2 nc = ( projectionMatrix * vec4( nv, 0.0 ) ).xy;
  float l = length( nc );
  vec4 cc = projectionMatrix * viewMatrix * vec4( uCentre, 1.0 );
  vec2 rd = ( clip.xy / clip.w - cc.xy / max( cc.w, 1e-4 ) ) * uRes;
  float rl = length( rd );
  vec2 dir = l > 1e-5 ? nc / l : vec2( 0.0 );
  vec2 rad = rl > 1e-3 ? rd / rl : vec2( 0.0 );
  vec2 sum = mix( rad, dir, smoothstep( 0.1, 0.45, l ) );
  float sl = length( sum );
  if ( sl > 1e-5 ) clip.xy += ( sum / sl ) * uWidth * 2.0 / uRes * clip.w;
  gl_Position = clip;
}`
const OUTLINE_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uAmt;
uniform float uAlpha;
void main() { gl_FragColor = vec4( uColor, uAlpha * uAmt ); }`
const RIM_VS = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  vN = normalize( normalMatrix * normal );
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`
const RIM_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uAmt;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = 1.0 - abs( dot( normalize( vN ), normalize( vV ) ) );
  gl_FragColor = vec4( uColor * ( 0.16 + 0.7 * f * f ) * uAmt, 1.0 );
}`

export interface HervorhebungsZiel {
  /** Sichtbare Meshes des Platzes (ohne Preisschilder). */
  meshes: Mesh[]
  /** Mitte des Platzes im Zonen-Rahmen. */
  mitte: Vector3
}

export interface Hervorhebung {
  /**
   * `slot` dauerhaft hervorheben (null: aus). Mit `flash`: nur kurz
   * aufleuchten; danach gilt wieder die dauerhafte Auswahl.
   */
  zeige(slot: string | null, opts?: { flash?: boolean }): void
  /** Gerade hervorgehobener Platz. */
  readonly aktiv: string | null
  /** Aktuelle Stärke 0…1 (Tests, Debug). */
  readonly staerke: number
  dispose(): void
}

export function createHervorhebung(o: {
  /** Meshes und Mitte eines Platzes, oder null (unbekannt, ausgeblendet). */
  suche: (slot: string) => HervorhebungsZiel | null
  requestRender: () => void
  /** Ohne Angabe: `prefers-reduced-motion` des Geräts. */
  reducedMotion?: boolean
}): Hervorhebung {
  const reduced =
    o.reducedMotion ??
    (typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const res = { value: new Vector2(1, 1) }
  const centre = { value: new Vector3() }
  const warm = new Vector3(...HIGHLIGHT_SRGB)
  const hull = (color: Vector3, alpha: number, width: number) =>
    new ShaderMaterial({
      uniforms: {
        uColor: { value: color },
        uAmt: { value: 0 },
        uAlpha: { value: alpha },
        uWidth: { value: width },
        uRes: res,
        uCentre: centre,
      },
      vertexShader: OUTLINE_VS,
      fragmentShader: OUTLINE_FS,
      side: BackSide,
      transparent: true,
      depthWrite: false,
      // eine Hüllenfläche in der Ebene der Wand dahinter darf nicht flimmern
      polygonOffset: true,
      polygonOffsetFactor: 0,
      polygonOffsetUnits: -4,
    })
  const ink = hull(new Vector3(...INK_SRGB), 0.45, INK_PX)
  const outline = hull(warm, 1, OUTLINE_PX)
  const rim = new ShaderMaterial({
    uniforms: { uColor: { value: warm }, uAmt: { value: 0 } },
    vertexShader: RIM_VS,
    fragmentShader: RIM_FS,
    side: FrontSide,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthFunc: LessEqualDepth,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  })
  const materials = [ink, outline, rim] as const

  /** Umrissbreite in Pixeln halten: Größe und Pixeldichte des Zeichenpuffers. */
  const vorDemZeichnen = (renderer: WebGLRenderer) => {
    renderer.getDrawingBufferSize(res.value)
    const pr = renderer.getPixelRatio()
    outline.uniforms.uWidth.value = OUTLINE_PX * pr
    ink.uniforms.uWidth.value = INK_PX * pr
  }

  let disposed = false
  let dauerhaft: string | null = null
  let blitz: { slot: string; start: number } | null = null
  let aktiv: string | null = null
  /** Beginn des Einblendens des aktiven Platzes. */
  let seit = 0
  let staerke = 0
  let ueberzuege: Mesh[] = []
  let raf = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const nimmAb = () => {
    for (const u of ueberzuege) u.removeFromParent()
    ueberzuege = []
    aktiv = null
  }

  const haengeAn = (slot: string, ziel: HervorhebungsZiel) => {
    centre.value.copy(ziel.mitte)
    for (const mesh of ziel.meshes) {
      // die Hülle braucht Normalen
      if (!mesh.geometry?.attributes.normal) continue
      materials.forEach((material, i) => {
        const u = new Mesh(mesh.geometry, material)
        u.userData[UEBERZUG] = true
        u.raycast = () => undefined
        u.renderOrder = 2 + i
        u.frustumCulled = mesh.frustumCulled
        u.onBeforeRender = vorDemZeichnen
        mesh.add(u)
        ueberzuege.push(u)
      })
    }
    aktiv = slot
  }

  /** Überzüge auf den Platz umhängen, der jetzt gilt. */
  const wechsle = (now: number) => {
    const slot = blitz?.slot ?? dauerhaft
    if (slot === aktiv) return
    nimmAb()
    if (!slot) return
    const ziel = o.suche(slot)
    if (!ziel || ziel.meshes.length === 0) return
    haengeAn(slot, ziel)
    seit = now
  }

  const zeichne = (now: number) => {
    if (!aktiv) staerke = 0
    else if (reduced) staerke = 1
    else if (blitz)
      staerke = blitzStaerke(
        (now - blitz.start) / BLITZ_MS,
        blitz.slot === dauerhaft
      )
    else staerke = einblenden((now - seit) / EINBLENDEN_MS)
    for (const material of materials) material.uniforms.uAmt.value = staerke
    o.requestRender()
  }

  const schritt = () => {
    raf = 0
    timer = null
    if (disposed) return
    const now = performance.now()
    if (blitz && now - blitz.start >= BLITZ_MS) {
      blitz = null
      const vorher = aktiv
      wechsle(now)
      // derselbe Platz bleibt ausgewählt: nicht noch einmal einblenden
      if (aktiv === vorher) seit = now - EINBLENDEN_MS
    }
    zeichne(now)
    weiter(now)
  }

  /** Nächsten Schritt nur planen, solange sich noch etwas ändert. */
  const weiter = (now: number) => {
    if (raf || timer !== null) return
    if (reduced) {
      if (blitz) {
        timer = setTimeout(schritt, Math.max(0, blitz.start + BLITZ_MS - now))
      }
      return
    }
    if (blitz || (aktiv && now - seit < EINBLENDEN_MS)) {
      raf = requestAnimationFrame(schritt)
    }
  }

  const haltAn = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  return {
    zeige: (slot, opts) => {
      if (disposed) return
      const now = performance.now()
      if (slot && opts?.flash) {
        blitz = { slot, start: now }
      } else {
        dauerhaft = slot
        if (!slot) blitz = null
      }
      // ein laufender Zeitgeber (reduzierte Bewegung) gilt dem alten Blitz
      if (timer !== null) haltAn()
      wechsle(now)
      zeichne(now)
      weiter(now)
    },
    get aktiv() {
      return aktiv
    },
    get staerke() {
      return staerke
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      haltAn()
      nimmAb()
      for (const material of materials) material.dispose()
    },
  }
}
