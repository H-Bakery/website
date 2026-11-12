import { DoubleSide, Mesh, ShaderMaterial } from 'three'
import { UEBERZUG } from './interact'
import { blendePreiskartenAus, createPicker, createZiele } from './pick'
import { knoten, material, quader, testladen } from './testladen'

// Synthetischer Mini-Laden mit erfundenen Produkten - kein echtes Modell,
// kein Renderer (Geometrie und Raycaster von three laufen in jsdom).

function aufbau() {
  const laden = testladen()
  const requestRender = jest.fn()
  const picker = createPicker({
    root: laden.root,
    camera: laden.camera,
    element: laden.element,
    requestRender,
  })
  const tippe = (
    x: number,
    y: number,
    z: number,
    opts?: { radiusPx?: number; dx?: number; dy?: number }
  ) => {
    const [cx, cy] = laden.aufSchirm(x, y, z)
    return picker.pickAt(cx + (opts?.dx ?? 0), cy + (opts?.dy ?? 0), opts)
  }
  return { ...laden, picker, requestRender, tippe }
}

const ueberzuege = (mesh: Mesh) =>
  mesh.children.filter((c) => c.userData[UEBERZUG])

describe('pickAt', () => {
  it('trifft das Produkt hinter dem Glas und geht zum Knoten mit der Kennung hinauf', () => {
    const { tippe } = aufbau()
    const treffer = tippe(-0.5, 0, 0.15)
    expect(treffer).toMatchObject({
      slot: 'testregal/ebene-1/platz-01',
      produkt: 'testbrot',
      moebel: 'testregal',
    })
    expect(treffer).not.toHaveProperty('ware')
    // getroffen wurde die Vorderseite der Kruste, nicht das Glas bei z = 1
    expect(treffer?.punkt[2]).toBeCloseTo(0.15, 3)
  })

  it('trifft auch das zweite Material desselben Knotens', () => {
    const { tippe } = aufbau()
    // die Mehlschicht liegt oben auf der Kruste
    expect(tippe(-0.5, 0.165, 0.15)).toMatchObject({
      slot: 'testregal/ebene-1/platz-01',
      produkt: 'testbrot',
    })
  })

  it('meldet Möbel ohne Produkt und ohne Ware', () => {
    const { tippe } = aufbau()
    const treffer = tippe(-0.9, 0.9, -0.45, { radiusPx: 0 })
    expect(treffer).toEqual({
      slot: 'testregal',
      moebel: 'testregal',
      punkt: [expect.any(Number), expect.any(Number), expect.closeTo(-0.45, 3)],
    })
  })

  it('meldet neutrale Ware als ware, nicht als produkt', () => {
    const { tippe } = aufbau()
    const treffer = tippe(0.5, 0, 0.05)
    expect(treffer).toMatchObject({
      slot: 'testregal/ebene-1/platz-02',
      ware: 'testglas',
      moebel: 'testregal',
    })
    expect(treffer).not.toHaveProperty('produkt')
  })

  it('überspringt ausgeblendete Knoten (Morgens-Filter)', () => {
    const { tippe, brot } = aufbau()
    brot.visible = false
    expect(tippe(-0.5, 0, 0.15, { radiusPx: 0 })).toMatchObject({
      slot: 'testregal',
    })
  })

  it('überspringt alles unter einem ausgeblendeten Vorfahren', () => {
    const { tippe, root, regal, picker, aufSchirm } = aufbau()
    regal.visible = false
    expect(tippe(-0.9, 0.9, -0.45, { radiusPx: 0 })).toBeNull()
    root.visible = false
    const [x, y] = aufSchirm(-0.5, 0, 0.15)
    expect(picker.pickAt(x, y)).toBeNull()
  })

  it('lässt das Glas nie selbst gewinnen', () => {
    const { tippe, regal } = aufbau()
    regal.visible = false
    // hier liegt nur die Glasscheibe unter dem Finger
    expect(tippe(1.2, 1.2, 1, { radiusPx: 0 })).toBeNull()
  })

  it('überspringt Materialien namens glow auch ohne transparent', () => {
    const laden = testladen()
    laden.root.add(
      knoten(quader(material('glow'), [3, 3, 0.02], [0, 0, 1.2]), 'testlampe', {
        id: 'testlampe',
      })
    )
    const picker = createPicker({ ...laden, requestRender: jest.fn() })
    const [x, y] = laden.aufSchirm(-0.5, 0, 0.15)
    expect(picker.pickAt(x, y)).toMatchObject({ produkt: 'testbrot' })
  })

  it('gibt kleinen Produkten eine Tippfläche von 44 px', () => {
    const { tippe } = aufbau()
    // die Testbrezel ist 5 cm groß (≈ 9 px); 15 px daneben trifft sie noch
    expect(tippe(0, 0.6, 0, { dx: 15 })).toMatchObject({
      slot: 'testtheke/staender/platz-01',
      produkt: 'testbrezel',
      moebel: 'testtheke',
      punkt: [0, expect.closeTo(0.6, 6), 0],
    })
    expect(tippe(0, 0.6, 0, { dx: -12, dy: 12 })).toMatchObject({
      produkt: 'testbrezel',
    })
  })

  it('trifft außerhalb des Radius das Möbel dahinter', () => {
    const { tippe } = aufbau()
    expect(tippe(0, 0.6, 0, { dx: 60 })).toMatchObject({ slot: 'testregal' })
    expect(tippe(0, 0.6, 0, { dx: 60 })).not.toHaveProperty('produkt')
    // ohne Radius zählt nur der genaue Treffer
    expect(tippe(0, 0.6, 0, { dx: 15, radiusPx: 0 })).toMatchObject({
      slot: 'testregal',
    })
  })

  it('gibt auch kleiner Ware eine Tippfläche', () => {
    const { tippe } = aufbau()
    expect(tippe(0.5, 0, 0.05, { dx: 20 })).toMatchObject({ ware: 'testglas' })
  })

  it('zieht den genauen Treffer auf ein Produkt der Tippfläche daneben vor', () => {
    const laden = testladen()
    // eine zweite, große Ware direkt neben der Brezel
    laden.root.add(
      knoten(
        quader(material('kruste'), [0.6, 0.2, 0.2], [0.34, 0.6, 0]),
        'produkt/testtheke/staender/platz-02',
        { id: 'testtheke/staender/platz-02', product: 'testkuchen' }
      )
    )
    const picker = createPicker({ ...laden, requestRender: jest.fn() })
    const [x, y] = laden.aufSchirm(0, 0.6, 0)
    expect(picker.pickAt(x + 12, y)).toMatchObject({ produkt: 'testkuchen' })
    expect(picker.pickAt(x, y)).toMatchObject({ produkt: 'testbrezel' })
  })

  it('lässt hinter einer Wand keine Tippfläche durch', () => {
    const laden = testladen()
    laden.root.add(
      knoten(
        quader(material('putz'), [8, 4, 0.1], [0, 0, 0.5]),
        'testraum/wand',
        { id: 'testraum/wand' }
      )
    )
    const picker = createPicker({ ...laden, requestRender: jest.fn() })
    const [x, y] = laden.aufSchirm(0, 0.6, 0)
    const treffer = picker.pickAt(x + 15, y)
    expect(treffer).toMatchObject({ slot: 'testraum/wand', moebel: 'testraum' })
    expect(treffer).not.toHaveProperty('produkt')
  })

  it('gibt ausgeblendeten Produkten keine Tippfläche', () => {
    const { tippe, brezel } = aufbau()
    expect(tippe(0, 0.6, 0, { dx: 15 })).toMatchObject({
      produkt: 'testbrezel',
    })
    brezel.visible = false
    const treffer = tippe(0, 0.6, 0, { dx: 15 })
    expect(treffer).toMatchObject({ slot: 'testregal' })
    expect(treffer).not.toHaveProperty('produkt')
  })

  it('gibt hinter einer Raumwand kein Tiefen-Spiel, hinter einem Möbelteil schon', () => {
    // Eine dünne Fläche 10 cm vor der Testbrezel - näher als das Tiefen-Spiel
    // von 30 cm. Als Möbelteil lässt sie den Tipp daneben zur Brezel durch ...
    const mitBlende = testladen()
    mitBlende.root.add(
      knoten(
        quader(material('holz'), [1, 1, 0.02], [0, 0.6, 0.13]),
        'testtheke/blende',
        { id: 'testtheke/blende' }
      )
    )
    const blende = createPicker({ ...mitBlende, requestRender: jest.fn() })
    const [x, y] = mitBlende.aufSchirm(0, 0.6, 0)
    expect(blende.pickAt(x + 15, y)).toMatchObject({ produkt: 'testbrezel' })

    // ... als Wand des Raums (umschließend: 14 m breit) nicht.
    const mitWand = testladen()
    mitWand.root.add(
      knoten(
        quader(material('putz'), [14, 4, 0.02], [0, 0.6, 0.13]),
        'testraum/wand',
        { id: 'testraum/wand' }
      )
    )
    const wand = createPicker({ ...mitWand, requestRender: jest.fn() })
    const treffer = wand.pickAt(x + 15, y)
    expect(treffer).toMatchObject({ slot: 'testraum/wand' })
    expect(treffer).not.toHaveProperty('produkt')
  })

  it('macht aus dem Korb das Produkt, das auf demselben Platz liegt', () => {
    const { tippe, broetchen } = aufbau()
    // unten am Korb, unterhalb der Brötchen
    expect(tippe(0, -0.75, 0.15, { radiusPx: 0 })).toMatchObject({
      slot: 'testregal/koerbe/korb-1',
      produkt: 'testbroetchen',
    })
    // leerer Korb (Produkt ausgeblendet): nur das Möbel
    broetchen.visible = false
    const leer = tippe(0, -0.75, 0.15, { radiusPx: 0 })
    expect(leer).toMatchObject({ slot: 'testregal/koerbe/korb-1' })
    expect(leer).not.toHaveProperty('produkt')
  })

  it('nimmt den Namen ohne produkt/, wenn die Kennung fehlt', () => {
    const laden = testladen()
    laden.brezel.userData = {
      name: 'produkt/testtheke/staender/platz-09',
      product: 'testbrezel',
    }
    const picker = createPicker({ ...laden, requestRender: jest.fn() })
    const [x, y] = laden.aufSchirm(0, 0.6, 0)
    expect(picker.pickAt(x, y)).toMatchObject({
      slot: 'testtheke/staender/platz-09',
      moebel: 'testtheke',
    })
  })

  it('trifft daneben nichts', () => {
    const laden = testladen()
    laden.regal.visible = false
    const picker = createPicker({ ...laden, requestRender: jest.fn() })
    expect(picker.pickAt(12, 22)).toBeNull()
    // Canvas ohne Fläche
    laden.element.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 0, height: 0 } as DOMRect)
    expect(picker.pickAt(200, 200)).toBeNull()
  })
})

describe('Preisschilder', () => {
  it('sind nie antippbar - ob schon ausgeblendet oder nicht', () => {
    for (const vorher of [true, false]) {
      const laden = testladen()
      if (vorher) expect(blendePreiskartenAus(laden.root)).toBe(2)
      const picker = createPicker({ ...laden, requestRender: jest.fn() })
      if (!vorher) expect(blendePreiskartenAus(laden.root)).toBe(2)
      const [x, y] = laden.aufSchirm(-0.5, -0.3, 0.21)
      // unter dem Finger liegt die Preiskarte, dahinter die Regalwand
      const treffer = picker.pickAt(x, y, { radiusPx: 0 })
      expect(treffer).toMatchObject({ slot: 'testregal' })
      expect(treffer).not.toHaveProperty('produkt')
    }
  })

  it('zählen nicht zur Größe des Produkts', () => {
    const { root } = testladen()
    // ohne Karte: Brot 0,5 m breit → keine Tippfläche; Ware, Brezel → zwei
    expect(createZiele(root).tippflaechen).toBe(2)
  })

  it('lassen den Tipp durch, wenn sie Teil einer Material-Liste sind', () => {
    const laden = testladen()
    // Würfel vor dem Brot: Vorderseite (+z) Preiskarte, Rückseite von innen sichtbar
    const seiten = [0, 1, 2, 3].map(() =>
      material('glas', { transparent: true })
    )
    const karte = material('preiskarte')
    const rueck = material('pappe')
    rueck.side = DoubleSide
    const wuerfel = knoten(
      quader([...seiten, karte, rueck], [0.2, 0.2, 0.2], [-0.5, 0, 0.6]),
      'produkt/testtheke/platz-07',
      { id: 'testtheke/platz-07', product: 'testtorte' }
    )
    laden.root.add(wuerfel)
    expect(blendePreiskartenAus(laden.root)).toBe(3)
    expect(wuerfel.visible).toBe(true)
    expect(karte.visible).toBe(false)
    const picker = createPicker({ ...laden, requestRender: jest.fn() })
    const [x, y] = laden.aufSchirm(-0.5, 0, 0.7)
    // durch die Preis-Vorderseite hindurch auf die Rückseite desselben Würfels
    const treffer = picker.pickAt(x, y, { radiusPx: 0 })
    expect(treffer).toMatchObject({ produkt: 'testtorte' })
    expect(treffer?.punkt[2]).toBeCloseTo(0.5, 3)
  })
})

describe('highlight', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('hebt die sichtbaren Meshes des Platzes hervor und stellt alles wieder her', () => {
    const { picker, root, kruste, mehl, preiskarte, preisschrift, regal } =
      aufbau()
    blendePreiskartenAus(root)
    const materialien = [kruste, mehl].map((m) => m.material)
    const zahl = () => {
      let n = 0
      root.traverse(() => (n += 1))
      return n
    }
    const vorher = zahl()

    picker.highlight('testregal/ebene-1/platz-01')
    expect(ueberzuege(kruste)).toHaveLength(3)
    expect(ueberzuege(mehl)).toHaveLength(3)
    // Preisschilder und andere Plätze bleiben unberührt
    expect(ueberzuege(preiskarte)).toHaveLength(0)
    expect(ueberzuege(preisschrift)).toHaveLength(0)
    expect(ueberzuege(regal.children[0] as Mesh)).toHaveLength(0)
    // die Materialien des Modells werden nicht angefasst
    expect([kruste, mehl].map((m) => m.material)).toEqual(materialien)
    expect(kruste.material).toBe(materialien[0])
    for (const u of ueberzuege(kruste) as Mesh[]) {
      expect(u.geometry).toBe(kruste.geometry)
      expect(u.material).toBeInstanceOf(ShaderMaterial)
    }

    picker.highlight(null)
    expect(zahl()).toBe(vorher)
    expect(kruste.children).toHaveLength(0)
    expect(kruste.material).toBe(materialien[0])
  })

  it('zeichnet bei jeder Änderung neu, aber nicht dauernd', () => {
    const { picker, requestRender } = aufbau()
    picker.highlight('testregal/ebene-1/platz-01')
    expect(requestRender).toHaveBeenCalled()
    jest.advanceTimersByTime(1000)
    const bisher = requestRender.mock.calls.length
    jest.advanceTimersByTime(2000)
    expect(requestRender).toHaveBeenCalledTimes(bisher)
    picker.highlight(null)
    expect(requestRender).toHaveBeenCalledTimes(bisher + 1)
  })

  it('leuchtet beim Tipp kurz auf und räumt danach auf', () => {
    const { picker, brezel, requestRender } = aufbau()
    picker.highlight('testtheke/staender/platz-01', { flash: true })
    expect(ueberzuege(brezel)).toHaveLength(3)
    jest.advanceTimersByTime(300)
    expect(ueberzuege(brezel)).toHaveLength(3)
    jest.advanceTimersByTime(700)
    expect(brezel.children).toHaveLength(0)
    const bisher = requestRender.mock.calls.length
    jest.advanceTimersByTime(1000)
    expect(requestRender).toHaveBeenCalledTimes(bisher)
  })

  it('kehrt nach dem Aufleuchten zur Auswahl aus der Liste zurück', () => {
    const { picker, brezel, kruste } = aufbau()
    picker.highlight('testregal/ebene-1/platz-01')
    picker.highlight('testtheke/staender/platz-01', { flash: true })
    expect(ueberzuege(brezel)).toHaveLength(3)
    expect(kruste.children).toHaveLength(0)
    jest.advanceTimersByTime(1000)
    expect(brezel.children).toHaveLength(0)
    expect(ueberzuege(kruste)).toHaveLength(3)
  })

  it('hebt Korb und Inhalt gemeinsam hervor, Ausgeblendetes und Unbekanntes nicht', () => {
    const { picker, korb, broetchen, brot, kruste } = aufbau()
    picker.highlight('testregal/koerbe/korb-1')
    expect(ueberzuege(korb)).toHaveLength(3)
    expect(ueberzuege(broetchen)).toHaveLength(3)
    picker.highlight('gibt/es/nicht')
    expect(korb.children).toHaveLength(0)
    brot.visible = false
    picker.highlight('testregal/ebene-1/platz-01')
    expect(kruste.children).toHaveLength(0)
  })

  it('meldet, was wirklich hervorgehoben ist - nicht, was verlangt wurde', () => {
    const { picker, brot, kruste } = aufbau()
    expect(picker.hervorgehoben).toEqual({ slot: null, ueberzuege: 0 })

    picker.highlight('testregal/ebene-1/platz-01')
    expect(picker.hervorgehoben.slot).toBe('testregal/ebene-1/platz-01')
    expect(picker.hervorgehoben.ueberzuege).toBeGreaterThan(0)
    expect(picker.hervorgehoben.ueberzuege).toBe(
      brot.children.reduce((n, kind) => n + ueberzuege(kind as Mesh).length, 0)
    )
    expect(ueberzuege(kruste).length).toBeGreaterThan(0)

    // unbekannter Platz: verlangt, aber nichts hängt
    picker.highlight('gibt/es/nicht')
    expect(picker.hervorgehoben).toEqual({ slot: null, ueberzuege: 0 })

    // ausgeblendeter Platz: ebenso
    brot.visible = false
    picker.highlight('testregal/ebene-1/platz-01')
    expect(picker.hervorgehoben).toEqual({ slot: null, ueberzuege: 0 })

    brot.visible = true
    picker.highlight('testregal/ebene-1/platz-02')
    expect(picker.hervorgehoben.slot).toBe('testregal/ebene-1/platz-02')
    picker.highlight(null)
    expect(picker.hervorgehoben).toEqual({ slot: null, ueberzuege: 0 })
    picker.dispose()
    expect(picker.hervorgehoben).toEqual({ slot: null, ueberzuege: 0 })
  })

  it('hebt auch Meshes ohne Normalen hervor (unlit-Modell): berechnet sie einmal', () => {
    const { picker, ware } = aufbau()
    ware.geometry.deleteAttribute('normal')
    expect(ware.geometry.attributes.normal).toBeUndefined()

    picker.highlight('testregal/ebene-1/platz-02')
    expect(picker.hervorgehoben.slot).toBe('testregal/ebene-1/platz-02')
    expect(ueberzuege(ware)).toHaveLength(3)
    expect(ware.geometry.attributes.normal.count).toBe(
      ware.geometry.attributes.position.count
    )
  })

  it('gibt beim Abbauen die eigenen Materialien frei und hängt alles ab', () => {
    const dispose = jest.spyOn(ShaderMaterial.prototype, 'dispose')
    const { picker, kruste, requestRender } = aufbau()
    picker.highlight('testregal/ebene-1/platz-01', { flash: true })
    const eigene = (ueberzuege(kruste) as Mesh[]).map((u) => u.material)
    picker.dispose()
    expect(kruste.children).toHaveLength(0)
    expect(dispose).toHaveBeenCalledTimes(3)
    expect(new Set(dispose.mock.contexts)).toEqual(new Set(eigene))
    const bisher = requestRender.mock.calls.length
    jest.advanceTimersByTime(2000)
    picker.highlight('testregal/ebene-1/platz-01')
    expect(requestRender).toHaveBeenCalledTimes(bisher)
    expect(kruste.children).toHaveLength(0)
    expect(picker.pickAt(200, 200)).toBeNull()
    dispose.mockRestore()
  })
})
