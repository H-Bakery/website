import { bruchHint, hasLead, isBruchItem, variantLabel } from './grundmengenApi'
import type { GrundmengenConfig, GrundmengenItem } from './grundmengenApi'

const korn: GrundmengenItem = {
  id: 'test-korn',
  name: 'Testkorn',
  section: 'brot',
  unit: 'Laib',
  variants: ['g500', 'g1000'],
  plu: [],
  base: {},
  variantKind: 'size',
  sizes: [
    { id: 'g500', label: '500 g' },
    { id: 'g1000', label: '1 kg' },
  ],
}
const doppel: GrundmengenItem = {
  id: 'test-doppel',
  name: 'Testdoppel',
  section: 'broetchen',
  unit: 'Stück',
  variants: [],
  plu: [],
  base: {},
  bruch: { per_product: 2, group: 'test-doppel', piecesPerBruch: 20 },
  lead: { default: 1 },
}
const config: GrundmengenConfig = {
  days: [2, 3],
  sections: ['brot', 'broetchen'],
  items: [korn, doppel],
  fillings: [{ id: 'nuss', name: 'Testnussfüllung' }],
}

describe('Grundmengen v2 (Z10)', () => {
  it('Größen heißen wie in den Stammdaten, Füllungen wie bisher', () => {
    expect(variantLabel(config, 'g500', korn)).toBe('500 g')
    expect(variantLabel(config, 'g500')).toBe('g500')
    expect(variantLabel(config, 'nuss')).toBe('Testnussfüllung')
  })

  it('Bruch-Hinweis: Stück × Teigstücke ÷ Stück je Bruch', () => {
    expect(isBruchItem(doppel)).toBe(true)
    expect(isBruchItem(korn)).toBe(false)
    expect(bruchHint(25, doppel)).toBe(2.5)
    expect(bruchHint(7, doppel)).toBe(0.7)
    expect(bruchHint(null, doppel)).toBeNull()
    // Stück je Bruch offen: kein Hinweis - nie geschätzt
    expect(
      bruchHint(25, {
        bruch: { per_product: 2, group: 'testdoppel', piecesPerBruch: null },
      })
    ).toBeNull()
    expect(bruchHint(25, korn)).toBeNull()
  })

  it('Vorlauf', () => {
    expect(hasLead(doppel)).toBe(true)
    expect(hasLead(korn)).toBe(false)
    expect(hasLead({ lead: { default: 0 } })).toBe(false)
  })
})
