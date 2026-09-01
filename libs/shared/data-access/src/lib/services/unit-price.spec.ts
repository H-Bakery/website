import { parseWeightFromName, unitPrice, unitPriceLabel } from './unit-price'

/**
 * Intl setzt vor das Euro-Zeichen ein geschuetztes Leerzeichen (U+00A0) - im
 * Deutschen typografisch richtig, im Testvergleich aber unsichtbar. Fuer die
 * Erwartung normalisieren, nicht in der Ausgabe.
 */
function plain(value: string | null): string | null {
  return value === null ? null : value.replace(/\u00a0/g, ' ')
}

describe('unit-price (Grundpreis nach § 4 PAngV)', () => {
  describe('parseWeightFromName', () => {
    it('liest die Nennfüllmenge aus echten Produktnamen', () => {
      expect(parseWeightFromName('Kornbrot 500g')).toEqual({ grams: 500 })
      expect(parseWeightFromName('Mischbrot 1000g')).toEqual({ grams: 1000 })
      expect(parseWeightFromName('Holzluken 750g')).toEqual({ grams: 750 })
    })

    it('versteht kg und Dezimaltrennzeichen', () => {
      expect(parseWeightFromName('Brot 1kg')).toEqual({ grams: 1000 })
      expect(parseWeightFromName('Brot 1,5 kg')).toEqual({ grams: 1500 })
    })

    it('gibt null zurück, wenn kein Gewicht im Namen steht', () => {
      expect(parseWeightFromName('Schwarzwälder-Kirsch-Torte')).toBeNull()
      expect(parseWeightFromName('Croissant')).toBeNull()
    })

    it('hält Stückangaben für kein Gewicht', () => {
      // "1/4 Stück" darf nicht als 1 g oder 4 g durchgehen.
      expect(
        parseWeightFromName('Kranzkuchen ungefüllt (1/4 Stück)')
      ).toBeNull()
      expect(parseWeightFromName('Sahnerollen (1 Stück)')).toBeNull()
    })
  })

  describe('unitPrice', () => {
    it('rechnet auf ein Kilogramm um', () => {
      expect(unitPrice(2.5, 500)).toEqual({ value: 5, unit: 'kg' })
      expect(unitPrice(4.4, 1000)).toEqual({ value: 4.4, unit: 'kg' })
    })

    it('bezieht sich unter 250 g auf 100 g', () => {
      expect(unitPrice(1.2, 100)).toEqual({ value: 1.2, unit: '100 g' })
    })

    it('weist unbrauchbare Eingaben ab, statt 0 oder Infinity zu liefern', () => {
      expect(unitPrice(0, 500)).toBeNull()
      expect(unitPrice(2.5, 0)).toBeNull()
      expect(unitPrice(Number.NaN, 500)).toBeNull()
    })
  })

  describe('unitPriceLabel', () => {
    it('macht 500 g und 1000 g vergleichbar — der Zweck der Norm', () => {
      expect(plain(unitPriceLabel({ name: 'Kornbrot 500g', price: 2.5 }))).toBe(
        '5,00 € / kg'
      )
      expect(
        plain(unitPriceLabel({ name: 'Kornbrot 1000g', price: 4.4 }))
      ).toBe('4,40 € / kg')
    })

    it('rundet kaufmännisch auf zwei Stellen', () => {
      // 4,00 € / 750 g = 5,333… € je kg
      expect(plain(unitPriceLabel({ name: 'Holzluken 750g', price: 4 }))).toBe(
        '5,33 € / kg'
      )
    })

    it('zeigt nichts an, wo es nichts anzuzeigen gibt', () => {
      expect(
        unitPriceLabel({ name: 'Buttercreme-Torte', price: 45 })
      ).toBeNull()
    })
  })
})
