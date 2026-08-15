import { HefezopfCalculator } from './productionCalculator'

describe('HefezopfCalculator', () => {
  let calculator: HefezopfCalculator

  beforeEach(() => {
    calculator = new HefezopfCalculator()
  })

  it('returns an empty plan when there are no orders', () => {
    const plan = calculator.calculateProductionNeeds({})

    expect(plan.totalDoughWeight).toBe(0)
    expect(plan.doughBatches).toBe(0)
    expect(plan.doughPieces).toEqual({})
    expect(Object.values(plan.fillings).every((v) => v === 0)).toBe(true)
  })

  it('calculates dough weight from the dough piece definition (weight × count × quantity)', () => {
    // Hefekranz Nuss = "Gefüllter Kranz" = 3 × 600g
    const plan = calculator.calculateProductionNeeds({ 'Hefekranz Nuss': 2 })

    expect(plan.totalDoughWeight).toBe(2 * 3 * 600)
    expect(plan.doughPieces['Gefüllter Kranz']).toBe(6)
  })

  it('aggregates dough pieces of the same type across products', () => {
    const plan = calculator.calculateProductionNeeds({
      'Hefekranz Nuss': 1,
      'Hefekranz Schoko': 1,
    })

    // both use "Gefüllter Kranz" (3 pieces each)
    expect(plan.doughPieces['Gefüllter Kranz']).toBe(6)
  })

  it('sums filling amounts per filling type', () => {
    const plan = calculator.calculateProductionNeeds({
      'Hefekranz Nuss': 2, // 1200g each
      'Gefüllter Zopf Nuss': 3, // 450g each
      'Hefezopf Plain': 5, // no filling
    })

    expect(plan.fillings['nuss']).toBe(2 * 1200 + 3 * 450)
    expect(plan.fillings['schoko']).toBe(0)
  })

  it('rounds dough batches up to whole 40kg batches', () => {
    // 1 Großer Zopf = 3 × 300g = 900g -> still 1 batch
    expect(
      calculator.calculateProductionNeeds({ 'Hefezopf Plain': 1 }).doughBatches
    ).toBe(1)

    // 45 × 900g = 40.5kg -> 2 batches
    expect(
      calculator.calculateProductionNeeds({ 'Hefezopf Plain': 45 }).doughBatches
    ).toBe(2)
  })

  it('ignores unknown products', () => {
    const plan = calculator.calculateProductionNeeds({ Unbekannt: 10 })

    expect(plan.totalDoughWeight).toBe(0)
    expect(plan.doughPieces).toEqual({})
  })

  it('lists products that use a given filling', () => {
    expect(calculator.getProductsWithFilling('marzipan').sort()).toEqual(
      ['Gefüllter Zopf Marzipan', 'Hefekranz Marzipan'].sort()
    )
    expect(calculator.getProductsWithFilling('unbekannt')).toEqual([])
  })

  it('exposes dough piece details by name', () => {
    expect(calculator.getDoughPieceDetails('Kleiner Zopf')).toMatchObject({
      weight: 300,
      count: 2,
    })
    expect(calculator.getDoughPieceDetails('Gibt es nicht')).toBeUndefined()
  })
})
