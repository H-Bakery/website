import { blendePreiskartenAus, istPreiskarte } from './preiskarten'
import { knoten, material, quader, testladen } from './testladen'

// Synthetischer Mini-Laden - kein echtes Modell, keine Preise.

describe('blendePreiskartenAus', () => {
  it('blendet Karte und Schrift aus und zählt die Meshes', () => {
    const { root, preiskarte, preisschrift, kruste, mehl, brot } = testladen()
    expect(blendePreiskartenAus(root)).toBe(2)
    expect(preiskarte.visible).toBe(false)
    expect(preisschrift.visible).toBe(false)
    // das Produkt selbst bleibt
    expect(brot.visible).toBe(true)
    expect(kruste.visible).toBe(true)
    expect(mehl.visible).toBe(true)
  })

  it('lässt alles andere sichtbar', () => {
    const { root } = testladen()
    blendePreiskartenAus(root)
    const versteckt: string[] = []
    root.traverse((n) => {
      if (!n.visible) versteckt.push(String(n.parent?.userData.name))
    })
    expect(versteckt).toEqual([
      'produkt/testregal/ebene-1/platz-01',
      'produkt/testregal/ebene-1/platz-01',
    ])
  })

  it('zählt beim zweiten Aufruf dasselbe und ändert nichts mehr', () => {
    const { root } = testladen()
    expect(blendePreiskartenAus(root)).toBe(2)
    expect(blendePreiskartenAus(root)).toBe(2)
  })

  it('findet Preis-Materialien auch in Material-Listen', () => {
    const { root } = testladen()
    const holz = material('holz')
    const karte = material('preiskarte')
    const schrift = material('preisschrift')
    const gemischt = knoten(
      quader(
        [holz, karte, holz, holz, schrift, holz],
        [0.2, 0.2, 0.2],
        [1, 1, 0]
      ),
      'testregal/schiene',
      { id: 'testregal/schiene' }
    )
    const nurPreis = quader([karte, schrift], [0.1, 0.1, 0.1], [1, 0, 0])
    root.add(gemischt, nurPreis)
    expect(istPreiskarte(gemischt)).toBe(false)
    expect(istPreiskarte(nurPreis)).toBe(true)

    expect(blendePreiskartenAus(root)).toBe(4)
    // gemischt: das Mesh bleibt, nur die Preis-Materialien verschwinden
    expect(gemischt.visible).toBe(true)
    expect(karte.visible).toBe(false)
    expect(schrift.visible).toBe(false)
    expect(holz.visible).toBe(true)
    expect(nurPreis.visible).toBe(false)
  })

  it('zählt ohne Preisschilder null', () => {
    const { root, preiskarte, preisschrift } = testladen()
    preiskarte.removeFromParent()
    preisschrift.removeFromParent()
    expect(blendePreiskartenAus(root)).toBe(0)
  })
})
