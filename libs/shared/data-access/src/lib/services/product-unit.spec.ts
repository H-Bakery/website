import { productUnit } from './product-unit'

/**
 * Die Namen unten sind die echten aus `hq/products` — die Regeln sollen an
 * der Wirklichkeit hängen, nicht an erfundenen Beispielen.
 */
describe('product-unit (Verkaufseinheit hinter „pro“)', () => {
  it('nennt den ganzen Kuchen „Kuchen“ und das Portionsstück daneben „Stück“', () => {
    expect(productUnit({ name: 'Apfelkuchen', category: 'kuchen' })).toBe(
      'Kuchen'
    )
    expect(
      productUnit({ name: 'Apfelkuchen (1 Stück)', category: 'kuchen' })
    ).toBe('Stück')
    expect(productUnit({ name: 'Blechkuchen', category: 'kuchen' })).toBe(
      'Kuchen'
    )
    expect(
      productUnit({ name: 'Streuselkuchen groß', category: 'kuchen' })
    ).toBe('Kuchen')
    expect(
      productUnit({
        name: 'Streuselkuchen groß (1/4 Stück)',
        category: 'kuchen',
      })
    ).toBe('Stück')
  })

  it('erkennt „1/4 Stück“ auch in einem Namen mit offener Klammer', () => {
    expect(
      productUnit({
        name: 'Kranzkuchen gefüllt (Nuss, Schoko, Quark oder Pudding (1/4 Stück)',
        category: 'kuchen',
      })
    ).toBe('Stück')
    expect(
      productUnit({
        name: 'Kranzkuchen gefüllt (Nuss, Schoko, Quark oder Pudding',
        category: 'kuchen',
      })
    ).toBe('Kuchen')
  })

  it('nennt Torten „Torte“ und Rollen „Rolle“', () => {
    expect(productUnit({ name: 'Sahne-Torte', category: 'torten' })).toBe(
      'Torte'
    )
    expect(
      productUnit({ name: 'Schwarzwälder-Kirsch-Torte', category: 'torten' })
    ).toBe('Torte')
    expect(productUnit({ name: 'Erdbeertorte', category: 'torten' })).toBe(
      'Torte'
    )
    expect(productUnit({ name: 'Buttercreme-Rolle', category: 'torten' })).toBe(
      'Rolle'
    )
    expect(productUnit({ name: 'Sahnerollen', category: 'torten' })).toBe(
      'Rolle'
    )
    expect(
      productUnit({ name: 'Sahnerollen (1 Stück)', category: 'torten' })
    ).toBe('Stück')
  })

  it('lässt Böden, Zöpfe und Rosinenbrot beim Stück — dort ist das Stück das Ganze', () => {
    expect(productUnit({ name: 'Tortenboden', category: 'torten' })).toBe(
      'Stück'
    )
    expect(productUnit({ name: 'Obstboden', category: 'torten' })).toBe('Stück')
    expect(productUnit({ name: 'Zopf ungefüllt', category: 'kuchen' })).toBe(
      'Stück'
    )
    expect(productUnit({ name: 'Rosinenbrot', category: 'kuchen' })).toBe(
      'Stück'
    )
  })

  it('hält einen „Butterkuchen“ aus den Teilchen für ein Stück, keinen Kuchen', () => {
    expect(productUnit({ name: 'Butterkuchen', category: 'teilchen' })).toBe(
      'Stück'
    )
    expect(
      productUnit({ name: 'Puddingstückchen', category: 'teilchen' })
    ).toBe('Stück')
    expect(productUnit({ name: 'Kornbrot 500g', category: 'brot' })).toBe(
      'Stück'
    )
  })

  it('fällt bei fehlender Kategorie oder kaputtem Namen auf „Stück“ zurück', () => {
    expect(productUnit({ name: 'Apfelkuchen' })).toBe('Stück')
    expect(productUnit({ name: 'Apfelkuchen', category: null })).toBe('Stück')
    expect(
      productUnit({ name: undefined as unknown as string, category: 'kuchen' })
    ).toBe('Stück')
  })
})
