/**
 * Antippen im 3D-Laden: Was liegt unter dem Finger?
 *
 * Ein Strahl durch den Tipp trifft die nächste undurchsichtige, sichtbare
 * Fläche. Glas (`glas`), Leuchten (`glow`) und alles Durchsichtige lassen
 * ihn durch - Ware hinter dem Vitrinenglas bleibt antippbar, Wände
 * verdecken weiter. Vom getroffenen Mesh geht es über `parent` hinauf zum
 * Knoten mit `userData.id` (Knoten mit mehreren Materialien sind eine Gruppe
 * mit einem Kind-Mesh je Material).
 *
 * Kleine Produkte (Brezeln, Gläser, einzelne Brote) haben eine unsichtbare
 * Tippfläche von ≈ 44 px: Trifft der Strahl nichts oder nur ein Möbelteil,
 * gewinnt das kleine Produkt, an dessen Mitte er am nächsten vorbeigeht. Ein
 * genauer Treffer auf ein Produkt gewinnt immer. Preisschilder sind nie
 * antippbar und werden nie hervorgehoben.
 *
 * Sichtbarkeit (Morgens-Filter, Außenraum je Blickpunkt, Preisschilder) wird
 * bei jedem Tipp neu gelesen; die Geometrie gilt als fest (ein Verzeichnis
 * je Modell, beim Anlegen gebaut).
 *
 * Herkunft: `TwinTargets` aus dem Saar LiDAR Explorer
 * (github.com/Open-Kirrberg/saar-lidar-explorer, MIT, gleicher Urheber),
 * `app/src/zones/runtime/twinPick.ts`, und `pickAt` aus `twinInteract.ts`.
 * Statt eines BVH (three-mesh-bvh ist hier keine Abhängigkeit) der Raycaster
 * von three - bei ≈ 150 000 Dreiecken und einem Strahl je Tipp reicht das.
 *
 * Importiert three - nur aus der nachgeladenen Viewer-Komponente verwenden.
 */
import { Box3, Raycaster, Vector2, Vector3 } from 'three'
import type { Material, Mesh, Object3D, PerspectiveCamera, Ray } from 'three'
import { gehoertZu } from '../raeume/rauminfos'
import { createHervorhebung, UEBERZUG } from './interact'
import type { HervorhebungsZiel } from './interact'
import {
  artVon,
  haeltTippAuf,
  istKlein,
  istPreisMaterial,
  istUmschliessend,
  moebelVon,
  slotVon,
  TIEFEN_SPIEL_M,
  TIPP_RADIUS_PX,
  TIPP_WEITE_M,
  tippWinkel,
  waehleTippflaeche,
} from './treffer'
import type { Tippflaeche, Treffer } from './treffer'

export type { Treffer } from './treffer'
export { blendePreiskartenAus } from './preiskarten'

export interface Picker {
  /**
   * Treffer unter dem Punkt `clientX, clientY` (Viewport-Koordinaten wie im
   * PointerEvent), oder null. `radiusPx`: Radius der Tippfläche kleiner
   * Produkte, Vorgabe 22 (= 44 px Finger); 0 = nur genaue Treffer.
   */
  pickAt(
    clientX: number,
    clientY: number,
    opts?: { radiusPx?: number }
  ): Treffer | null
  /**
   * Platz hervorheben: ohne `flash` dauerhaft („in der Liste gewählt“, null =
   * aus), mit `flash` kurz aufleuchten (Tipp); danach gilt wieder die
   * dauerhafte Auswahl.
   */
  highlight(slot: string | null, opts?: { flash?: boolean }): void
  /**
   * Was gerade wirklich hervorgehoben ist: der Platz, an dem Überzüge hängen
   * (`null`, wenn keiner hängt - unbekannter Platz, ausgeblendet, Meshes ohne
   * Normalen), und ihre Anzahl.
   */
  readonly hervorgehoben: { slot: string | null; ueberzuege: number }
  dispose(): void
}

/** Ein Knoten des Modells mit Kennung und seinen antippbaren Meshes. */
interface Knoten {
  objekt: Object3D
  produkt?: string
  ware?: string
  meshes: Mesh[]
  box: Box3
  /** Kleine Produkte und Waren: Mitte und halbe Kanten der Tippfläche. */
  flaeche: Tippflaeche | null
}

/** Alle Knoten eines Platzes (z. B. der Korb und die Brötchen darin). */
interface Ziel {
  slot: string
  knoten: Knoten[]
  /** Raum, Fassade, Gelände: verdeckt nur. */
  umschliessend: boolean
}

export interface Ziele {
  /** Anzahl der Plätze und der Tippflächen (Tests, Debug). */
  readonly anzahl: number
  readonly tippflaechen: number
  /**
   * Treffer entlang `ray` (Zonen-Rahmen, Einheitsrichtung). `winkel` (rad,
   * `tippWinkel`) = Radius der Tippflächen, 0 = nur genaue Treffer.
   */
  waehle(ray: Ray, winkel?: number, weite?: number): Treffer | null
  /**
   * Sichtbare Meshes und Mitte eines Platzes zum Hervorheben, oder null.
   * Kennt niemand den Platz genau, gilt `slot` als Anfang der Kennung: alle
   * Stücke `<slot>/…` zusammen (Stationen mit Infopunkt).
   */
  suche(slot: string): HervorhebungsZiel | null
}

const materialsOf = (mesh: Mesh): Material[] =>
  ([] as Material[]).concat(mesh.material ?? [])

/** Kann dieses Material angetippt werden? Kein Glas, kein Preisschild. */
const antippbar = (material: Material | undefined): boolean =>
  !!material && haeltTippAuf(material) && !istPreisMaterial(material.name)

/**
 * Verzeichnis der antippbaren Meshes unter `root`. Liest auch (noch)
 * ausgeblendete Knoten ein - was sichtbar ist, entscheidet sich je Tipp.
 */
export function createZiele(root: Object3D): Ziele {
  root.updateMatrixWorld(true)
  const meshes: Mesh[] = []
  const knotenVon = new Map<Mesh, Knoten | null>()
  const jeObjekt = new Map<Object3D, Knoten>()
  const zielVon = new Map<Knoten, Ziel>()
  const ziele = new Map<string, Ziel>()
  const tmp = new Box3()

  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh || mesh.userData[UEBERZUG]) return
    if (!mesh.geometry?.attributes.position) return
    if (!materialsOf(mesh).some(antippbar)) return
    // hinauf zum Knoten mit Kennung
    let traeger: Object3D | null = mesh
    let slot: string | null = null
    for (; traeger; traeger = traeger.parent) {
      slot = slotVon(traeger.userData)
      if (slot || traeger === root) break
    }
    meshes.push(mesh)
    if (!slot || !traeger) {
      // ohne Kennung: verdeckt nur
      knotenVon.set(mesh, null)
      return
    }
    let knoten = jeObjekt.get(traeger)
    if (!knoten) {
      knoten = {
        objekt: traeger,
        ...artVon(traeger.userData),
        meshes: [],
        box: new Box3(),
        flaeche: null,
      }
      jeObjekt.set(traeger, knoten)
      let ziel = ziele.get(slot)
      if (!ziel) {
        ziel = { slot, knoten: [], umschliessend: false }
        ziele.set(slot, ziel)
      }
      ziel.knoten.push(knoten)
      zielVon.set(knoten, ziel)
    }
    knoten.meshes.push(mesh)
    knotenVon.set(mesh, knoten)
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    if (mesh.geometry.boundingBox) {
      knoten.box.union(
        tmp.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld)
      )
    }
  })

  const size = new Vector3()
  const centre = new Vector3()
  const mitFlaeche: Knoten[] = []
  for (const ziel of ziele.values()) {
    const box = new Box3()
    for (const knoten of ziel.knoten) {
      box.union(knoten.box)
      if (knoten.produkt === undefined && knoten.ware === undefined) continue
      knoten.box.getSize(size)
      if (knoten.box.isEmpty() || !istKlein([size.x, size.y, size.z])) continue
      knoten.box.getCenter(centre)
      knoten.flaeche = {
        c: [centre.x, centre.y, centre.z],
        h: [size.x / 2, size.y / 2, size.z / 2],
      }
      mitFlaeche.push(knoten)
    }
    box.getSize(size)
    ziel.umschliessend = istUmschliessend(size.x, size.y, size.z)
  }

  /** Sichtbar samt aller Vorfahren bis `root`? */
  const sichtbar = (node: Object3D): boolean => {
    for (let n: Object3D | null = node; n; n = n.parent) {
      if (!n.visible) return false
      if (n === root) break
    }
    return true
  }

  const raycaster = new Raycaster()

  const trefferFuer = (
    ziel: Ziel,
    knoten: Knoten,
    punkt: Vector3
  ): Treffer => ({
    slot: ziel.slot,
    ...(knoten.produkt !== undefined ? { produkt: knoten.produkt } : {}),
    ...(knoten.ware !== undefined ? { ware: knoten.ware } : {}),
    moebel: moebelVon(ziel.slot),
    punkt: [punkt.x, punkt.y, punkt.z],
  })

  /** Der sichtbare Produkt- oder Waren-Knoten eines Platzes (Korb → Brötchen). */
  const inhaltVon = (ziel: Ziel, zuerst: Knoten): Knoten | null => {
    const hat = (k: Knoten) => k.produkt !== undefined || k.ware !== undefined
    if (hat(zuerst)) return zuerst
    return (
      ziel.knoten.find((k) => k.produkt !== undefined && sichtbar(k.objekt)) ??
      ziel.knoten.find((k) => hat(k) && sichtbar(k.objekt)) ??
      null
    )
  }

  return {
    get anzahl() {
      return ziele.size
    },
    get tippflaechen() {
      return mitFlaeche.length
    },

    waehle: (ray, winkel = 0, weite = TIPP_WEITE_M) => {
      raycaster.ray.copy(ray)
      raycaster.near = 0
      raycaster.far = weite
      const hits = raycaster.intersectObjects(meshes.filter(sichtbar), false)
      // bei Material-Listen entscheidet das Material der getroffenen Fläche
      const hit = hits.find((h) => {
        const mesh = h.object as Mesh
        if (!Array.isArray(mesh.material)) return true
        return antippbar(mesh.material[h.face?.materialIndex ?? 0])
      })
      const knoten = hit ? knotenVon.get(hit.object as Mesh) ?? null : null
      const ziel = knoten ? zielVon.get(knoten) ?? null : null
      const inhalt = ziel && knoten ? inhaltVon(ziel, knoten) : null
      if (hit && ziel && inhalt) return trefferFuer(ziel, inhalt, hit.point)

      if (winkel > 0 && mitFlaeche.length) {
        const kandidaten = mitFlaeche.filter((k) => sichtbar(k.objekt))
        const o = ray.origin
        const d = ray.direction
        // hinter einer Wand oder einer Fläche ohne Kennung kein Tiefen-Spiel
        const spiel = ziel && !ziel.umschliessend ? TIEFEN_SPIEL_M : 0
        const wahl = waehleTippflaeche(
          [o.x, o.y, o.z],
          [d.x, d.y, d.z],
          kandidaten.map((k) => k.flaeche as Tippflaeche),
          winkel,
          hit ? hit.distance : Infinity,
          weite,
          spiel
        )
        if (wahl.index >= 0) {
          const k = kandidaten[wahl.index]
          const z = zielVon.get(k) as Ziel
          return trefferFuer(z, k, k.box.getCenter(centre))
        }
      }
      if (!hit || !ziel || !knoten) return null
      return trefferFuer(ziel, knoten, hit.point)
    },

    suche: (slot) => {
      // Ein Platz (`brotregal/ebene-1/platz-01`) - oder der Knoten eines
      // Infopunkts (`ofen`): dann alle Stücke, die dazu gehören (`ofen/…`).
      // Ein belegter Platz bleibt für sich, auch wenn unter ihm noch etwas hinge.
      const exakt = ziele.get(slot)
      const istPlatz = exakt?.knoten.some(
        (k) => k.produkt !== undefined || k.ware !== undefined
      )
      const gruppe = (
        exakt && istPlatz
          ? [exakt]
          : [...ziele.values()].filter((z) => gehoertZu(z.slot, slot))
      ).filter((z) => !z.umschliessend)
      if (gruppe.length === 0) return null
      const box = new Box3()
      const out: Mesh[] = []
      for (const knoten of gruppe.flatMap((z) => z.knoten)) {
        for (const mesh of knoten.meshes) {
          if (!sichtbar(mesh)) continue
          out.push(mesh)
          if (mesh.geometry.boundingBox) {
            box.union(
              tmp.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld)
            )
          }
        }
      }
      if (out.length === 0) return null
      return { meshes: out, mitte: box.getCenter(new Vector3()) }
    },
  }
}

export function createPicker(o: {
  root: Object3D
  camera: PerspectiveCamera
  element: HTMLElement
  requestRender: () => void
}): Picker {
  const ziele = createZiele(o.root)
  const hervorhebung = createHervorhebung({
    suche: ziele.suche,
    requestRender: o.requestRender,
  })
  const raycaster = new Raycaster()
  const ndc = new Vector2()
  let disposed = false

  return {
    pickAt: (clientX, clientY, opts) => {
      if (disposed) return null
      const rect = o.element.getBoundingClientRect()
      if (!(rect.width > 0) || !(rect.height > 0)) return null
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      )
      o.camera.updateMatrixWorld()
      raycaster.setFromCamera(ndc, o.camera)
      const px = opts?.radiusPx ?? TIPP_RADIUS_PX
      return ziele.waehle(
        raycaster.ray,
        tippWinkel(px, rect.height, o.camera.fov)
      )
    },
    highlight: (slot, opts) => {
      if (disposed) return
      hervorhebung.zeige(slot, opts)
    },
    get hervorgehoben() {
      const ueberzuege = disposed ? 0 : hervorhebung.ueberzuege
      return {
        slot: ueberzuege > 0 ? hervorhebung.aktiv : null,
        ueberzuege,
      }
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      hervorhebung.dispose()
    },
  }
}
