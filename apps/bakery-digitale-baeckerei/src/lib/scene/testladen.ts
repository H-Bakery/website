/**
 * Synthetischer Mini-Laden für die Tests des Antippens: erfundene Möbel und
 * Produkte („Testbrot“), gebaut wie der GLTFLoader das Modell liefert - alle
 * Knoten direkt unter der Wurzel, `extras` in `userData`, der Name mit `/`
 * unter `userData.name`, Knoten mit mehreren Materialien als Gruppe mit einem
 * Kind-Mesh je Material. Kein echtes Modell, keine Preise.
 *
 * Nur für *.spec.ts (three ohne Renderer: Geometrie und Raycaster laufen in
 * jsdom).
 */
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Vector3,
} from 'three'
import type { Material, Object3D } from 'three'

export const BREITE = 400
export const HOEHE = 400

export function material(
  name: string,
  opts: { transparent?: boolean; opacity?: number } = {}
): MeshBasicMaterial {
  return new MeshBasicMaterial({ name, ...opts })
}

export function quader(
  mat: Material | Material[],
  size: [number, number, number],
  at: [number, number, number]
): Mesh {
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]), mat)
  mesh.position.set(at[0], at[1], at[2])
  return mesh
}

export function knoten<T extends Object3D>(
  objekt: T,
  name: string,
  extras: Record<string, unknown> = {}
): T {
  objekt.name = name.replace(/\//g, '')
  objekt.userData = { name, ...extras }
  return objekt
}

export interface Testladen {
  root: Group
  camera: PerspectiveCamera
  element: HTMLElement
  /** Viewport-Koordinaten eines Punkts im Raum. */
  aufSchirm: (x: number, y: number, z: number) => [number, number]
  regal: Group
  brot: Group
  kruste: Mesh
  mehl: Mesh
  preiskarte: Mesh
  preisschrift: Mesh
  glas: Mesh
  ware: Mesh
  brezel: Mesh
  korb: Mesh
  broetchen: Mesh
}

/**
 * Blick von vorn (Kamera bei z = 2,5 m, 400 × 400 px, ≈ 172 px je Meter in
 * der Ebene z = 0):
 * - Rückwand des Testregals bei z = −0,5
 * - Testbrot (zwei Materialien + Preiskarte davor/darunter) bei x = −0,5
 * - Testglas (neutrale Ware, klein) bei x = +0,5
 * - Testbrezel (klein, 5 cm) bei y = +0,6
 * - Korb mit Testbrötchen (Möbel und Produkt teilen den Platz) bei y = −0,7
 * - eine Glasscheibe vor allem bei z = 1
 */
export function testladen(): Testladen {
  const root = new Group()

  const regal = knoten(new Group(), 'testregal/korpus', { id: 'testregal' })
  regal.add(quader(material('holz'), [2.4, 2.4, 0.1], [0, 0, -0.5]))

  const brot = knoten(new Group(), 'produkt/testregal/ebene-1/platz-01', {
    id: 'testregal/ebene-1/platz-01',
    product: 'testbrot',
    count: 1,
    fills: ['morgens'],
  })
  const kruste = quader(material('kruste'), [0.5, 0.3, 0.3], [-0.5, 0, 0])
  const mehl = quader(material('mehl'), [0.3, 0.02, 0.3], [-0.5, 0.16, 0])
  const preiskarte = quader(
    material('preiskarte'),
    [0.12, 0.08, 0.01],
    [-0.5, -0.3, 0.2]
  )
  const preisschrift = quader(
    material('preisschrift'),
    [0.08, 0.03, 0.01],
    [-0.5, -0.3, 0.21]
  )
  brot.add(kruste, mehl, preiskarte, preisschrift)

  const glas = knoten(
    quader(
      material('glas', { transparent: true, opacity: 0.25 }),
      [3, 3, 0.02],
      [0, 0, 1]
    ),
    'testtheke/vitrine',
    { id: 'testtheke/vitrine' }
  )

  const ware = knoten(
    quader(material('ton'), [0.1, 0.14, 0.1], [0.5, 0, 0]),
    'produkt/testregal/ebene-1/platz-02',
    { id: 'testregal/ebene-1/platz-02', ware: 'testglas', fills: ['morgens'] }
  )

  const brezel = knoten(
    quader(material('lauge'), [0.05, 0.05, 0.05], [0, 0.6, 0]),
    'produkt/testtheke/staender/platz-01',
    {
      id: 'testtheke/staender/platz-01',
      product: 'testbrezel',
      fills: ['morgens'],
    }
  )

  const korb = knoten(
    quader(material('korb'), [0.6, 0.2, 0.3], [0, -0.7, 0]),
    'testregal/koerbe/korb-1',
    { id: 'testregal/koerbe/korb-1' }
  )
  const broetchen = knoten(
    quader(material('kruste-hell'), [0.5, 0.1, 0.25], [0, -0.55, 0]),
    'produkt/testregal/koerbe/korb-1',
    {
      id: 'testregal/koerbe/korb-1',
      product: 'testbroetchen',
      count: 12,
      fills: ['morgens'],
    }
  )

  root.add(regal, brot, glas, ware, brezel, korb, broetchen)

  const camera = new PerspectiveCamera(50, BREITE / HOEHE, 0.05, 100)
  camera.position.set(0, 0, 2.5)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()

  // Canvas-Ersatz mit Versatz im Viewport (die Seite hat eine Kopfzeile)
  const LINKS = 10
  const OBEN = 20
  const element = document.createElement('div')
  element.getBoundingClientRect = () =>
    ({
      left: LINKS,
      top: OBEN,
      width: BREITE,
      height: HOEHE,
      right: LINKS + BREITE,
      bottom: OBEN + HOEHE,
      x: LINKS,
      y: OBEN,
      toJSON: () => ({}),
    } as DOMRect)

  const v = new Vector3()
  const aufSchirm = (x: number, y: number, z: number): [number, number] => {
    v.set(x, y, z).project(camera)
    return [LINKS + ((v.x + 1) / 2) * BREITE, OBEN + ((1 - v.y) / 2) * HOEHE]
  }

  return {
    root,
    camera,
    element,
    aufSchirm,
    regal,
    brot,
    kruste,
    mehl,
    preiskarte,
    preisschrift,
    glas,
    ware,
    brezel,
    korb,
    broetchen,
  }
}
