/**
 * Einrichtung in der Szene (DB12): die leichten Regal-Modelle laden und nach
 * Plan (src/lib/einrichtung/plan.ts) auf die Plätze des Modells legen.
 *
 * Je eingerichtetem Platz ein `InstancedMesh` als Kind seines Knotens
 * `produkt/<slot>`: eine Geometrie je Produkt (geteilt von allen Plätzen),
 * ein Material für alle, ein Zeichenaufruf je Platz - weniger als die Ware
 * des Modells braucht (dort ein Aufruf je Material je Platz). Als Kind des
 * Knotens bleibt alles andere, wie es ist: Antippen und Hervorheben finden
 * den Platz über den Knoten, das Ausblenden außerhalb des Bildes rechnet je
 * Platz.
 *
 * Die Ware des Modells wird nicht entfernt, sondern aus der Zeichenebene
 * genommen (`layers`) und markiert (`VERBORGEN`): `visible` bliebe an einem
 * Knoten hängen, der selbst das Mesh ist, und nähme die neuen Stücke mit.
 * Alles lässt sich zurücknehmen (`richteEin` noch einmal mit einem anderen
 * Plan - der Einrichten-Modus lebt davon).
 *
 * Importiert three - nur aus der nachgeladenen Viewer-Komponente verwenden.
 */
import { Box3, InstancedMesh, Matrix4, MeshBasicMaterial } from 'three'
import type { BufferGeometry, Material, Mesh, Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { TRAEGER_MATERIALIEN } from '../../../scripts/auslage'
import type { ImModell, PlatzPlan } from '../einrichtung/plan'
import { parseProduktName } from './fills'
import { istPreiskarte } from './preiskarten'
import { GELEGT, VERBORGEN } from './treffer'

export { GELEGT, VERBORGEN } from './treffer'
/** `userData` des Knotens: was das Modell dort zeigte, und der Plan, der gilt. */
const URSPRUNG = 'dbUrsprung'
const PLAN = 'dbPlan'

export interface Regale {
  /** Geometrie je Produkt-ID. */
  geometrien: Map<string, BufferGeometry>
  /** Das eine Material aller Regal-Modelle (unlit, Vertex-Farben). */
  material: Material
  dispose: () => void
}

/**
 * Lädt das Paket der Regal-Modelle (ein GLB, je Produkt ein Mesh mit dem
 * Namen der Produkt-ID; unkomprimiert, ohne Decoder lesbar).
 */
export async function ladeRegale(
  url: string,
  signal: AbortSignal
): Promise<Regale> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const buffer = await res.arrayBuffer()
  if (signal.aborted) throw new DOMException('Laden abgebrochen', 'AbortError')
  const gltf = await new GLTFLoader().parseAsync(buffer, '')
  const geometrien = new Map<string, BufferGeometry>()
  let material: Material | null = null
  gltf.scene.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh || !mesh.name) return
    geometrien.set(mesh.name, mesh.geometry)
    if (!material && !Array.isArray(mesh.material)) material = mesh.material
  })
  const eines: Material =
    material ?? new MeshBasicMaterial({ vertexColors: true })
  return {
    geometrien,
    material: eines,
    dispose: () => {
      for (const g of geometrien.values()) g.dispose()
      eines.dispose()
    },
  }
}

/** Die Knoten `produkt/<slot>` des Modells, die der Zustand der Auslage zeigt. */
function platzKnoten(root: Object3D): Map<string, Object3D> {
  const out = new Map<string, Object3D>()
  for (const child of root.children) {
    const slot = parseProduktName(child.userData.name)?.slot
    if (!slot || out.has(slot)) continue
    // Vom Morgens-Filter ausgeblendet - außer, die Einrichtung selbst war es.
    if (!child.visible && child.userData[PLAN] !== 'leer') continue
    out.set(slot, child)
  }
  return out
}

/** Was das Modell auf seinen Plätzen zeigt - für `planeRaum`. */
export function leseImModell(root: Object3D): Record<string, ImModell> {
  const out: Record<string, ImModell> = {}
  for (const [slot, knoten] of platzKnoten(root)) {
    const quelle = (knoten.userData[URSPRUNG] ?? knoten.userData) as Record<
      string,
      unknown
    >
    const { product, ware, count } = quelle
    out[slot] = {
      ...(typeof product === 'string' && product ? { produkt: product } : {}),
      ...(typeof ware === 'string' && ware ? { ware } : {}),
      ...(typeof count === 'number' ? { anzahl: count } : {}),
    }
  }
  return out
}

/** Die Meshes der Ware des Modells unter einem Knoten (nicht die gelegten). */
function wareMeshes(knoten: Object3D): Mesh[] {
  const out: Mesh[] = []
  knoten.traverse((node) => {
    const mesh = node as Mesh
    if (mesh.isMesh && !mesh.userData[GELEGT] && !mesh.userData.dbUeberzug) {
      out.push(mesh)
    }
  })
  return out
}

const istTraeger = (mesh: Mesh): boolean => {
  const materialien = ([] as Material[]).concat(mesh.material ?? [])
  return (
    materialien.length > 0 &&
    materialien.every((m) => TRAEGER_MATERIALIEN.includes(m.name))
  )
}

/** Nimmt zurück, was `richteEin` an einem Knoten getan hat. */
function setzeZurueck(knoten: Object3D): void {
  for (const kind of [...knoten.children]) {
    if (!kind.userData[GELEGT]) continue
    kind.removeFromParent()
    ;(kind as InstancedMesh).dispose?.()
  }
  for (const mesh of wareMeshes(knoten)) {
    if (!mesh.userData[VERBORGEN]) continue
    delete mesh.userData[VERBORGEN]
    mesh.layers.set(0)
  }
  const ursprung = knoten.userData[URSPRUNG] as
    | Record<string, unknown>
    | undefined
  if (ursprung) {
    for (const key of ['product', 'ware', 'count']) {
      if (ursprung[key] === undefined) delete knoten.userData[key]
      else knoten.userData[key] = ursprung[key]
    }
    delete knoten.userData[URSPRUNG]
  }
  if (knoten.userData[PLAN] === 'leer') knoten.visible = true
  delete knoten.userData[PLAN]
}

export interface Eingerichtet {
  /** Plätze mit gelegten Regal-Modellen und die Zahl der Stücke. */
  plaetze: number
  stuecke: number
  /** Dreiecke aller gelegten Stücke. */
  dreiecke: number
  /** Plätze, die im Bild leer bleiben (ausdrücklich leer / Produkt ohne Regal-Modell). */
  leer: number
  ohneModell: number
}

/**
 * Richtet die Plätze unter `root` nach `plan` ein. Mehrfach aufrufbar: Jeder
 * Aufruf nimmt zuerst zurück, was der vorige getan hat. Ohne `regale` (oder
 * für ein Produkt ohne Geometrie) bleibt ein `gelegt`-Platz, wie er im Modell
 * ist - es wird nie eine andere Form gezeigt.
 */
export function richteEin(
  root: Object3D,
  plan: Record<string, PlatzPlan>,
  regale: Regale | null
): Eingerichtet {
  const ergebnis: Eingerichtet = {
    plaetze: 0,
    stuecke: 0,
    dreiecke: 0,
    leer: 0,
    ohneModell: 0,
  }
  root.updateMatrixWorld(true)
  const invers = new Matrix4()
  const m = new Matrix4()
  for (const [slot, knoten] of platzKnoten(root)) {
    setzeZurueck(knoten)
    const p = Object.prototype.hasOwnProperty.call(plan, slot)
      ? plan[slot]
      : undefined
    if (!p || p.art === 'gebacken') continue
    const geometrie =
      p.art === 'gelegt' ? regale?.geometrien.get(p.produkt) : undefined
    if (p.art === 'gelegt' && (!geometrie || !regale)) continue

    knoten.userData[URSPRUNG] = {
      product: knoten.userData.product,
      ware: knoten.userData.ware,
      count: knoten.userData.count,
    }
    knoten.userData[PLAN] = p.art
    if (p.art === 'leer') {
      knoten.visible = false
      delete knoten.userData.product
      delete knoten.userData.ware
      ergebnis.leer += 1
      continue
    }
    // Die Ware des Modells verschwindet; ein Tablett darunter bleibt liegen.
    for (const mesh of wareMeshes(knoten)) {
      if (p.traeger && istTraeger(mesh)) continue
      // Preisschilder sind schon ausgeblendet (`visible`) - nicht anfassen.
      if (istPreiskarte(mesh)) continue
      mesh.userData[VERBORGEN] = true
      mesh.layers.disableAll()
    }
    // Der Platz trägt jetzt dieses Produkt - auch für den Tipp ins Bild.
    knoten.userData.product = p.produkt
    delete knoten.userData.ware
    if (p.art === 'ohne-modell') {
      ergebnis.ohneModell += 1
      continue
    }
    knoten.userData.count = p.matrizen.length
    const stuecke = new InstancedMesh(
      geometrie as BufferGeometry,
      (regale as Regale).material,
      p.matrizen.length
    )
    stuecke.name = `einrichtung/${slot}`
    stuecke.userData[GELEGT] = true
    // Die Lagen stehen im Rahmen des Modells, das Mesh hängt am Knoten.
    invers.copy(knoten.matrixWorld).invert()
    p.matrizen.forEach((lage, i) => {
      stuecke.setMatrixAt(i, m.fromArray(lage).premultiply(invers))
    })
    stuecke.instanceMatrix.needsUpdate = true
    stuecke.computeBoundingBox()
    stuecke.computeBoundingSphere()
    stuecke.frustumCulled = true
    knoten.add(stuecke)
    stuecke.updateMatrixWorld(true)
    ergebnis.plaetze += 1
    ergebnis.stuecke += p.matrizen.length
    const g = geometrie as BufferGeometry
    ergebnis.dreiecke +=
      ((g.index?.count ?? g.attributes.position.count) / 3) * p.matrizen.length
  }
  return ergebnis
}

/**
 * Der Rahmen eines Knotens im Raum, ohne die Ware, die die Einrichtung
 * verborgen hat - leer, wenn dort nichts (mehr) zu sehen ist.
 */
export function rahmenOhneVerborgenes(knoten: Object3D, ziel: Box3): Box3 {
  ziel.makeEmpty()
  const teil = new Box3()
  knoten.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh || mesh.userData[VERBORGEN] || mesh.userData.dbUeberzug) {
      return
    }
    const viele = mesh as InstancedMesh
    let rahmen: Box3 | null
    if (viele.isInstancedMesh) {
      if (!viele.boundingBox) viele.computeBoundingBox()
      rahmen = viele.boundingBox
    } else {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      rahmen = mesh.geometry.boundingBox
    }
    if (rahmen) ziel.union(teil.copy(rahmen).applyMatrix4(mesh.matrixWorld))
  })
  return ziel
}

/** Gibt frei, was die Einrichtung an `root` gehängt hat (vor `disposeTree`). */
export function raeumeEinrichtungAb(root: Object3D): void {
  for (const child of root.children) {
    if (child.userData[PLAN] !== undefined) setzeZurueck(child)
  }
}
