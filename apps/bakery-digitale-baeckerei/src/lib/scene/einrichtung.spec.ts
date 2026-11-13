import { BoxGeometry, InstancedMesh, Matrix4, Mesh } from 'three'
import type { PlatzPlan } from '../einrichtung/plan'
import {
  GELEGT,
  VERBORGEN,
  leseImModell,
  raeumeEinrichtungAb,
  richteEin,
  type Regale,
} from './einrichtung'
import { UEBERZUG } from './interact'
import { countTriangles } from './loadModel'
import { blendePreiskartenAus, createPicker } from './pick'
import { material, testladen } from './testladen'

// Synthetischer Mini-Laden mit erfundenen Produkten - kein echtes Modell,
// kein Renderer (three ohne WebGL: Geometrie und Raycaster laufen in jsdom).

const BROT = 'testregal/ebene-1/platz-01'
const GLAS = 'testregal/ebene-1/platz-02'
const BREZEL = 'testtheke/staender/platz-01'
const KORB = 'testregal/koerbe/korb-1'

/** Ein erfundenes Regal-Modell: ein Würfel von 10 cm, mittig auf y = 0. */
function regale(): Regale {
  const wuerfel = new BoxGeometry(0.1, 0.1, 0.1).translate(0, 0.05, 0)
  const mat = material('regal')
  return {
    geometrien: new Map([['testweck', wuerfel]]),
    material: mat,
    dispose: jest.fn(),
  }
}

/** Lage ohne Drehung an einem Ort (spaltenweise, wie three). */
const an = (x: number, y: number, z: number) =>
  new Matrix4().makeTranslation(x, y, z).toArray()

const gelegt = (
  matrizen: number[][],
  traeger = false
): Extract<PlatzPlan, { art: 'gelegt' }> => ({
  art: 'gelegt',
  produkt: 'testweck',
  anzahl: matrizen.length,
  matrizen,
  befund: 'passt',
  traeger,
})

function aufbau() {
  const laden = testladen()
  blendePreiskartenAus(laden.root)
  const picker = () =>
    createPicker({
      root: laden.root,
      camera: laden.camera,
      element: laden.element,
      requestRender: jest.fn(),
    })
  const tippe = (x: number, y: number, z: number) => {
    const [cx, cy] = laden.aufSchirm(x, y, z)
    return picker().pickAt(cx, cy, { radiusPx: 0 })
  }
  return { ...laden, picker, tippe }
}

const stuecke = (knoten: { children: unknown[] }) =>
  knoten.children.filter((c) => (c as Mesh).userData[GELEGT]) as InstancedMesh[]

describe('leseImModell', () => {
  it('nennt je sichtbarem Platz, was das Modell dort zeigt', () => {
    const { root } = aufbau()
    expect(leseImModell(root)).toEqual({
      [BROT]: { produkt: 'testbrot', anzahl: 1 },
      [GLAS]: { ware: 'testglas' },
      [BREZEL]: { produkt: 'testbrezel' },
      [KORB]: { produkt: 'testbroetchen', anzahl: 12 },
    })
  })

  it('ein vom Morgens-Filter ausgeblendeter Platz fehlt', () => {
    const { root, brezel } = aufbau()
    brezel.visible = false
    expect(leseImModell(root)).not.toHaveProperty(BREZEL)
  })
})

describe('richteEin', () => {
  it('ohne Plan (oder alles „gebacken“) bleibt der Baum unberührt', () => {
    const { root, brot, kruste } = aufbau()
    const vorher = countTriangles(root, true)
    const e = richteEin(root, { [BROT]: { art: 'gebacken' } }, regale())
    expect(e).toEqual({
      plaetze: 0,
      stuecke: 0,
      dreiecke: 0,
      leer: 0,
      ohneModell: 0,
    })
    expect(brot.children).toHaveLength(4)
    expect(kruste.userData[VERBORGEN]).toBeUndefined()
    expect(kruste.layers.mask).toBe(1)
    expect(countTriangles(root, true)).toBe(vorher)
  })

  it('legt Regal-Modelle auf einen Platz: die Ware des Modells verschwindet, die Stücke hängen am Knoten', () => {
    const { root, brot, kruste, mehl, preiskarte } = aufbau()
    const e = richteEin(
      root,
      { [BROT]: gelegt([an(-0.6, 0, 0), an(-0.4, 0, 0)]) },
      regale()
    )
    expect(e).toMatchObject({ plaetze: 1, stuecke: 2, dreiecke: 24 })
    for (const mesh of [kruste, mehl]) {
      expect(mesh.userData[VERBORGEN]).toBe(true)
      // aus der Zeichenebene - `visible` bleibt, sonst verschwänden die Stücke mit
      expect(mesh.layers.mask).toBe(0)
      expect(mesh.visible).toBe(true)
    }
    // Preisschilder bleiben, wie blendePreiskartenAus sie hinterlassen hat.
    expect(preiskarte.visible).toBe(false)
    expect(preiskarte.userData[VERBORGEN]).toBeUndefined()
    const [mesh] = stuecke(brot)
    expect(mesh).toBeInstanceOf(InstancedMesh)
    expect(mesh.count).toBe(2)
    expect(mesh.frustumCulled).toBe(true)
    // Der Platz trägt jetzt das eingerichtete Produkt.
    expect(brot.userData.product).toBe('testweck')
    expect(brot.userData.count).toBe(2)
  })

  it('die Lagen stehen im Rahmen des Modells - auch an einem verschobenen, skalierten Knoten', () => {
    const { root, brot } = aufbau()
    brot.position.set(0.3, -0.2, 0.1)
    brot.scale.setScalar(0.5)
    richteEin(root, { [BROT]: gelegt([an(-0.6, 0.4, 0.2)]) }, regale())
    const [mesh] = stuecke(brot)
    const m = new Matrix4()
    mesh.getMatrixAt(0, m)
    m.premultiply(mesh.matrixWorld)
    const e = m.elements
    expect([e[12], e[13], e[14]]).toEqual([
      expect.closeTo(-0.6, 6),
      expect.closeTo(0.4, 6),
      expect.closeTo(0.2, 6),
    ])
    // Maßstab 1 im Raum
    expect(Math.hypot(e[0], e[1], e[2])).toBeCloseTo(1, 6)
  })

  it('ein Knoten, der selbst das Mesh ist (neutrale Ware), bekommt die Stücke als Kinder und bleibt selbst unsichtbar', () => {
    const { root, ware } = aufbau()
    richteEin(root, { [GLAS]: gelegt([an(0.5, 0, 0)]) }, regale())
    expect(ware.userData[VERBORGEN]).toBe(true)
    expect(ware.layers.mask).toBe(0)
    expect(stuecke(ware)).toHaveLength(1)
    expect(ware.userData.product).toBe('testweck')
    expect(ware.userData.ware).toBeUndefined()
  })

  it('„leer“ blendet den Platz ganz aus', () => {
    const { root, brezel } = aufbau()
    const e = richteEin(root, { [BREZEL]: { art: 'leer' } }, regale())
    expect(e.leer).toBe(1)
    expect(brezel.visible).toBe(false)
    expect(brezel.userData.product).toBeUndefined()
  })

  it('ein Produkt ohne Regal-Modell: die Ware des Modells verschwindet, nichts liegt dort', () => {
    const { root, broetchen } = aufbau()
    const e = richteEin(
      root,
      { [KORB]: { art: 'ohne-modell', produkt: 'testkuchen', traeger: false } },
      regale()
    )
    expect(e.ohneModell).toBe(1)
    expect(broetchen.userData[VERBORGEN]).toBe(true)
    expect(stuecke(broetchen)).toHaveLength(0)
    expect(broetchen.userData.product).toBe('testkuchen')
  })

  it('ohne geladene Regal-Modelle (oder ohne Geometrie für das Produkt) bleibt die Ware des Modells', () => {
    const { root, brot, kruste } = aufbau()
    richteEin(root, { [BROT]: gelegt([an(0, 0, 0)]) }, null)
    expect(kruste.userData[VERBORGEN]).toBeUndefined()
    const anderes: PlatzPlan = { ...gelegt([an(0, 0, 0)]), produkt: 'fehlt' }
    richteEin(root, { [BROT]: anderes }, regale())
    expect(kruste.userData[VERBORGEN]).toBeUndefined()
    expect(brot.userData.product).toBe('testbrot')
  })

  it('ein Tablett aus dem Modell bleibt liegen, wenn der Plan es sagt', () => {
    const { root, kruste, mehl } = aufbau()
    // Für den Test: Die Mehlschicht spielt das Tablett.
    mehl.material = material('lack-schwarz')
    richteEin(root, { [BROT]: gelegt([an(-0.5, 0, 0)], true) }, regale())
    expect(kruste.userData[VERBORGEN]).toBe(true)
    expect(mehl.userData[VERBORGEN]).toBeUndefined()
    expect(mehl.layers.mask).toBe(1)
    richteEin(root, { [BROT]: gelegt([an(-0.5, 0, 0)], false) }, regale())
    expect(mehl.userData[VERBORGEN]).toBe(true)
  })

  it('ein neuer Plan nimmt den alten ganz zurück', () => {
    const { root, brot, kruste, brezel, ware } = aufbau()
    const r = regale()
    richteEin(
      root,
      {
        [BROT]: gelegt([an(-0.6, 0, 0), an(-0.4, 0, 0)]),
        [BREZEL]: { art: 'leer' },
        [GLAS]: gelegt([an(0.5, 0, 0)]),
      },
      r
    )
    const e = richteEin(root, {}, r)
    expect(e.plaetze).toBe(0)
    expect(stuecke(brot)).toHaveLength(0)
    expect(stuecke(ware)).toHaveLength(0)
    expect(kruste.userData[VERBORGEN]).toBeUndefined()
    expect(kruste.layers.mask).toBe(1)
    expect(ware.layers.mask).toBe(1)
    expect(brezel.visible).toBe(true)
    expect(brot.userData).toMatchObject({ product: 'testbrot', count: 1 })
    expect(ware.userData.ware).toBe('testglas')
    expect(ware.userData.product).toBeUndefined()
    expect(leseImModell(root)[BREZEL]).toEqual({ produkt: 'testbrezel' })
  })

  it('leseImModell nennt auch nach dem Einrichten, was das Modell zeigte', () => {
    const { root } = aufbau()
    richteEin(
      root,
      { [BROT]: gelegt([an(-0.5, 0, 0)]), [BREZEL]: { art: 'leer' } },
      regale()
    )
    const imModell = leseImModell(root)
    expect(imModell[BROT]).toEqual({ produkt: 'testbrot', anzahl: 1 })
    expect(imModell[BREZEL]).toEqual({ produkt: 'testbrezel' })
  })

  it('raeumeEinrichtungAb nimmt alles ab', () => {
    const { root, brot } = aufbau()
    richteEin(root, { [BROT]: gelegt([an(-0.5, 0, 0)]) }, regale())
    raeumeEinrichtungAb(root)
    expect(stuecke(brot)).toHaveLength(0)
    expect(brot.userData.product).toBe('testbrot')
  })
})

describe('gelegte Plätze: Zählen, Antippen, Hervorheben', () => {
  it('countTriangles zählt die Stücke und lässt die verborgene Ware aus dem Sichtbaren', () => {
    const { root } = aufbau()
    const alle = countTriangles(root)
    const sichtbar = countTriangles(root, true)
    richteEin(
      root,
      { [BROT]: gelegt([an(-0.6, 0, 0), an(-0.4, 0, 0)]) },
      regale()
    )
    // zwei Würfel dazu
    expect(countTriangles(root)).toBe(alle + 24)
    // Kruste und Mehl (je ein Quader) zählen nicht mehr zum Sichtbaren.
    expect(countTriangles(root, true)).toBe(sichtbar - 24 + 24)
  })

  it('ein Tipp auf ein gelegtes Stück trifft den Platz - mit dem eingerichteten Produkt', () => {
    const { root, tippe } = aufbau()
    // Das Stück liegt neben der (verborgenen) Kruste des Modells.
    richteEin(root, { [BROT]: gelegt([an(-0.95, 0.4, 0)]) }, regale())
    expect(tippe(-0.95, 0.45, 0.05)).toMatchObject({
      slot: BROT,
      produkt: 'testweck',
    })
  })

  it('die verborgene Ware des Modells ist nicht mehr anzutippen', () => {
    const { root, tippe } = aufbau()
    richteEin(root, { [BROT]: gelegt([an(-0.95, 0.4, 0)]) }, regale())
    // Mitte der alten Kruste: Dahinter steht nur noch die Rückwand.
    expect(tippe(-0.5, 0, 0.15)).toMatchObject({ slot: 'testregal' })
  })

  it('die Tippfläche (≈ 44 px) eines kleinen gelegten Platzes liegt um die Stücke', () => {
    const { root, aufSchirm, picker } = aufbau()
    richteEin(root, { [BREZEL]: gelegt([an(0.3, 0.9, 0)]) }, regale())
    const [x, y] = aufSchirm(0.3, 0.95, 0)
    expect(picker().pickAt(x + 14, y + 14)).toMatchObject({
      slot: BREZEL,
      produkt: 'testweck',
    })
  })

  it('ein leerer Platz ist nicht anzutippen', () => {
    const { root, tippe } = aufbau()
    richteEin(root, { [BREZEL]: { art: 'leer' } }, regale())
    expect(tippe(0, 0.6, 0.02)?.slot).not.toBe(BREZEL)
  })

  it('die Hervorhebung hängt an den gelegten Stücken: Überzüge mit denselben Lagen', () => {
    const { root, brot, picker } = aufbau()
    richteEin(
      root,
      { [BROT]: gelegt([an(-0.6, 0, 0), an(-0.4, 0, 0)]) },
      regale()
    )
    const p = picker()
    p.highlight(BROT)
    expect(p.hervorgehoben).toEqual({ slot: BROT, ueberzuege: 3 })
    const [mesh] = stuecke(brot)
    const ueberzuege = mesh.children.filter((c) => c.userData[UEBERZUG])
    expect(ueberzuege).toHaveLength(3)
    for (const u of ueberzuege as InstancedMesh[]) {
      expect(u).toBeInstanceOf(InstancedMesh)
      expect(u.count).toBe(2)
      expect(u.instanceMatrix).toBe(mesh.instanceMatrix)
      expect(u.geometry).toBe(mesh.geometry)
    }
    p.highlight(null)
    expect(mesh.children).toHaveLength(0)
    p.dispose()
  })
})
