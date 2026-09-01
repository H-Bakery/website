import { fireEvent, render, screen } from '@testing-library/react'

import type { ShopProduct } from '@bakery/shared/data-access'

import { BundleOffers } from './bundle-offers'

const mockAddToCart = jest.fn()

jest.mock('@bakery/shared/contexts', () => ({
  useCart: () => ({ addToCart: mockAddToCart, getQuantity: () => 0 }),
}))

function product(
  id: string,
  category: ShopProduct['category'],
  price: number,
  overrides: Partial<ShopProduct> = {}
): ShopProduct {
  return {
    id,
    numericId: id.length,
    name: id,
    category,
    price,
    available: true,
    seasonal: false,
    image: null,
    shortDescription: '',
    description: '',
    ...overrides,
  }
}

/**
 * Die echten hq-Slugs, die die Tüten kuratieren — plus je ein Ausweichprodukt
 * derselben Kategorie, damit auch der Fallback geprüft werden kann.
 */
const CATALOG: ShopProduct[] = [
  product('kornbrot-500g', 'brot', 2.5),
  product('baguette-klein', 'baguette', 2.2),
  product('sternweck', 'broetchen', 0.6),
  product('roggenweck', 'broetchen', 0.7),
  product('croissant', 'teilchen', 1.2),
  product('kaesekuchen-1-stueck', 'kuchen', 1.8),
  product('marmorkuchen-1-stueck', 'kuchen', 1.2),
]

describe('BundleOffers', () => {
  beforeEach(() => mockAddToCart.mockClear())

  it('summiert den Preis aus den echten Einzelpreisen', () => {
    render(<BundleOffers products={CATALOG} />)

    // Frühstückstüte: 6 × 0,60 € + 2 × 1,20 € = 6,00 €.
    const card = screen.getByText('Frühstückstüte').closest('div')
    expect(card?.textContent).toContain('6,00')
  })

  it('nimmt den kuratierten Artikel, nicht das erstbeste der Kategorie', () => {
    // Der Reihenfolge nach käme zuerst `kaesekuchen-1-stueck`; die zweite
    // Zeile der Kaffeetafel meint aber ausdrücklich den Marmorkuchen.
    render(<BundleOffers products={CATALOG} />)

    const card = screen.getByText('Kaffeetafel').closest('div')
    expect(card?.textContent).toContain('marmorkuchen-1-stueck')
    // 4 × 1,80 € + 4 × 1,20 € = 12,00 €.
    expect(card?.textContent).toContain('12,00')
  })

  it('legt jede Position einzeln mit der richtigen Menge in den Warenkorb', () => {
    render(<BundleOffers products={CATALOG} />)

    const buttons = screen.getAllByTestId('bundle-add')
    fireEvent.click(buttons[0])

    expect(mockAddToCart).toHaveBeenCalledTimes(2)
    expect(mockAddToCart.mock.calls[0][0]).toMatchObject({ slug: 'sternweck' })
    expect(mockAddToCart.mock.calls[0][1]).toBe(6)
    expect(mockAddToCart.mock.calls[1][0]).toMatchObject({ slug: 'croissant' })
    expect(mockAddToCart.mock.calls[1][1]).toBe(2)
  })

  it('weicht auf die Kategorie aus, wenn der kuratierte Artikel fehlt', () => {
    const withoutSternweck = CATALOG.filter((item) => item.id !== 'sternweck')
    render(<BundleOffers products={withoutSternweck} />)

    fireEvent.click(screen.getAllByTestId('bundle-add')[0])

    expect(mockAddToCart.mock.calls[0][0]).toMatchObject({
      slug: 'roggenweck',
    })
  })

  it('bestätigt sichtbar, dass die Tüte im Warenkorb liegt', () => {
    render(<BundleOffers products={CATALOG} />)

    fireEvent.click(screen.getAllByTestId('bundle-add')[0])

    expect(screen.getByText('Liegt im Warenkorb')).toBeInTheDocument()
  })

  it('nennt den Grundpreis, wo nach Gewicht verkauft wird (§ 4 PAngV)', () => {
    render(<BundleOffers products={CATALOG} />)

    // Kornbrot 500 g für 2,50 € → 5,00 € je Kilogramm. Als Regex, weil
    // `Intl` zwischen Betrag und € ein geschütztes Leerzeichen setzt.
    const brotkorb = screen.getByText('Brotkorb').closest('div')
    expect(brotkorb?.textContent).toMatch(/5,00\s€\s\/\skg/)
  })

  it('erfindet keinen Grundpreis für Ware ohne Gewicht im Namen', () => {
    render(<BundleOffers products={CATALOG} />)

    // Sternweck und Croissant tragen kein Gewicht – dann steht dort nichts.
    const fruehstueck = screen.getByText('Frühstückstüte').closest('div')
    expect(fruehstueck?.textContent).not.toContain('/ kg')
    expect(fruehstueck?.textContent).not.toContain('/ 100 g')
  })

  it('nennt keinen Rabatt und keine erfundene Knappheit', () => {
    render(<BundleOffers products={CATALOG} />)

    const text = screen.getByTestId('bundle-offers').textContent ?? ''
    expect(text).not.toMatch(/statt|sparen|rabatt|nur noch|solange der Vorrat/i)
    expect(text).toContain('Vorschlag – im Warenkorb änderbar')
  })

  it('lässt eine Tüte weg, statt sie mit falschem Preis halb zu zeigen', () => {
    // Ohne Brötchen fehlen Frühstückstüte und Brotkorb; Kaffeetafel bleibt.
    const withoutRolls = CATALOG.filter((item) => item.category !== 'broetchen')
    render(<BundleOffers products={withoutRolls} />)

    expect(screen.getAllByTestId('bundle-card')).toHaveLength(1)
    expect(screen.getByText('Kaffeetafel')).toBeInTheDocument()
  })

  it('füllt zwei Zeilen derselben Kategorie nicht mit demselben Produkt', () => {
    // Ohne die kuratierten Slugs muss der Fallback trotzdem zwei
    // verschiedene Kuchen finden, sonst stünde 2× dasselbe auf der Karte.
    const renamed = CATALOG.map((item) =>
      item.category === 'kuchen'
        ? { ...item, id: `x-${item.id}`, name: `x-${item.name}` }
        : item
    )
    render(<BundleOffers products={renamed} />)

    const card = screen.getByText('Kaffeetafel').closest('div')
    expect(card?.textContent).toContain('x-kaesekuchen-1-stueck')
    expect(card?.textContent).toContain('x-marmorkuchen-1-stueck')
  })

  it('greift nie zu einem nicht verfügbaren Produkt', () => {
    const catalog = [
      product('ausverkauft', 'broetchen', 0.4, { available: false }),
      ...CATALOG.filter((item) => item.id !== 'sternweck'),
    ]
    render(<BundleOffers products={catalog} />)

    fireEvent.click(screen.getAllByTestId('bundle-add')[0])

    for (const call of mockAddToCart.mock.calls) {
      expect(call[0].slug).not.toBe('ausverkauft')
    }
  })

  it('rendert nichts, wenn gar keine Produkte da sind', () => {
    const { container } = render(<BundleOffers products={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
