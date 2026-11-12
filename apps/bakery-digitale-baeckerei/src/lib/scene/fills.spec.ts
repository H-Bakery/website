import { applyFill, fillShows, parseProduktName, type FillNode } from './fills'

// Synthetischer Mini-Baum mit erfundenen Produkten - kein echtes Modell.
function node(
  name: string,
  extras: Record<string, unknown> = {},
  children: FillNode[] = []
): FillNode {
  // wie der GLTFLoader: extras landen in userData, der Name unter userData.name
  return { userData: { name, ...extras }, visible: true, children }
}

function testladen() {
  const regal = node('testregal/korpus', { id: 'testregal/korpus' })
  const brot = node('produkt/testregal/platz-01', {
    id: 'testregal/platz-01',
    product: 'testbrot',
    fills: ['morgens', 'feierabend'],
  })
  const broetchenVoll = node('produkt/testregal/platz-02', {
    id: 'testregal/platz-02',
    product: 'testbroetchen',
    count: 12,
    fills: ['morgens'],
  })
  const broetchenRest = node('produkt/testregal/platz-02@feierabend', {
    id: 'testregal/platz-02',
    product: 'testbroetchen',
    count: 2,
    fills: ['feierabend'],
  })
  const dose = node('produkt/testregal/platz-03', {
    id: 'testregal/platz-03',
    ware: 'testdose',
    fills: ['morgens'],
  })
  const kuchenAbend = node('produkt/testtheke/platz-01@feierabend', {
    id: 'testtheke/platz-01',
    product: 'testkuchen',
    fills: ['feierabend'],
  })
  const root = node('', {}, [
    regal,
    brot,
    broetchenVoll,
    broetchenRest,
    dose,
    kuchenAbend,
  ])
  return { root, regal, brot, broetchenVoll, broetchenRest, dose, kuchenAbend }
}

describe('fillShows', () => {
  it('zeigt Knoten ohne fills immer', () => {
    expect(fillShows(undefined, 'morgens')).toBe(true)
    expect(fillShows(null, 'morgens')).toBe(true)
  })

  it('zeigt nur, was den Zustand nennt', () => {
    expect(fillShows(['morgens'], 'morgens')).toBe(true)
    expect(fillShows(['morgens', 'feierabend'], 'morgens')).toBe(true)
    expect(fillShows(['feierabend'], 'morgens')).toBe(false)
    expect(fillShows([], 'morgens')).toBe(false)
  })

  it('blendet bei einer kaputten Angabe nichts aus', () => {
    expect(fillShows('morgens', 'feierabend')).toBe(true)
    expect(fillShows({ morgens: true }, 'feierabend')).toBe(true)
  })
})

describe('parseProduktName', () => {
  it('liest Platz und Variante', () => {
    expect(parseProduktName('produkt/testregal/platz-02')).toEqual({
      slot: 'testregal/platz-02',
      variante: null,
    })
    expect(parseProduktName('produkt/testregal/platz-02@feierabend')).toEqual({
      slot: 'testregal/platz-02',
      variante: 'feierabend',
    })
  })

  it('kennt nur Produkt-Knoten', () => {
    expect(parseProduktName('testregal/korpus')).toBeNull()
    expect(parseProduktName('produkt/')).toBeNull()
    expect(parseProduktName('produkt/@feierabend')).toBeNull()
    expect(parseProduktName('produkt/testregal/platz-02@')).toBeNull()
    expect(parseProduktName(undefined)).toBeNull()
  })
})

describe('applyFill', () => {
  it('Morgens: blendet die Feierabend-Varianten aus, nichts liegt doppelt', () => {
    const t = testladen()
    const result = applyFill(t.root, 'morgens')
    expect(t.brot.visible).toBe(true)
    expect(t.broetchenVoll.visible).toBe(true)
    expect(t.broetchenRest.visible).toBe(false)
    expect(t.dose.visible).toBe(true)
    expect(t.kuchenAbend.visible).toBe(false)
    expect(result).toEqual({ shown: 3, hidden: 2, doubled: [] })
  })

  it('lässt Möbel und Wurzel unberührt', () => {
    const t = testladen()
    t.regal.visible = false // z. B. vom Außenraum-Schalter in P1
    applyFill(t.root, 'morgens')
    expect(t.regal.visible).toBe(false)
    expect(t.root.visible).toBe(true)
  })

  it('schaltet zurück: ein zweiter Lauf zeigt wieder, was der erste verbarg', () => {
    const t = testladen()
    applyFill(t.root, 'morgens')
    const result = applyFill(t.root, 'feierabend')
    expect(t.broetchenVoll.visible).toBe(false)
    expect(t.broetchenRest.visible).toBe(true)
    expect(t.kuchenAbend.visible).toBe(true)
    expect(t.dose.visible).toBe(false)
    expect(result).toEqual({ shown: 3, hidden: 2, doubled: [] })
  })

  it('meldet einen Platz, an dem zwei Varianten übereinander lägen', () => {
    const t = testladen()
    t.broetchenRest.userData.fills = ['morgens', 'feierabend']
    const result = applyFill(t.root, 'morgens')
    expect(result.doubled).toEqual(['testregal/platz-02'])
  })

  it('steigt in verschachtelte Knoten ab', () => {
    const inner = node('produkt/testregal/platz-09@feierabend', {
      fills: ['feierabend'],
    })
    const root = node('', {}, [node('gruppe', {}, [inner])])
    expect(applyFill(root, 'morgens').hidden).toBe(1)
    expect(inner.visible).toBe(false)
  })
})
