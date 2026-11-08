import {
  partybrezelConfig as config,
  type PartybrezelConfig,
} from '../config/partybrezel.config'
import { formatEuro, formatGrams } from './format'
import { priceBreakdown, pretzelPrice } from './pricing'
import { pretzel } from './testing'

// Eigene, erfundene Preise, damit der Test nicht an den Platzhaltern hängt.
const priced: PartybrezelConfig = {
  ...config,
  sizes: config.sizes.map((s) =>
    s.id === 'klein'
      ? { ...s, basePriceCents: 1000 }
      : { ...s, basePriceCents: 1500 }
  ),
  toppings: [
    { id: 'a', label: 'A', surchargePerPartCents: 0 },
    { id: 'b', label: 'B', surchargePerPartCents: 110 },
    { id: 'c', label: 'C', surchargePerPartCents: 30 },
  ],
}

const nbsp = (s: string) => s.replace(/\u00a0/g, ' ')

describe('pricing', () => {
  it('Grundpreis plus Aufpreis je belegtem Teil, in ganzen Cent', () => {
    const line = pretzelPrice(
      pretzel(priced, 'gross', ['b', 'c', 'b']),
      1,
      priced
    )
    expect(line.baseCents).toBe(1500)
    expect(line.surcharges).toEqual([
      { toppingId: 'b', label: 'B', parts: 2, centsPerPart: 110, cents: 220 },
      { toppingId: 'c', label: 'C', parts: 1, centsPerPart: 30, cents: 30 },
    ])
    expect(line.totalCents).toBe(1750)
    expect(line.untoppedParts).toBe(0)
  })

  it('offene Teile kosten nichts, werden aber gezählt', () => {
    const line = pretzelPrice(
      pretzel(priced, 'klein', ['b', null, null]),
      1,
      priced
    )
    expect(line.totalCents).toBe(1110)
    expect(line.untoppedParts).toBe(2)
  })

  it('summiert alle Brezeln ohne Rundungsfehler', () => {
    // 10 × 3 Teile × 0,30 € - als Gleitkomma wäre das 8.999999…
    const pretzels = Array.from({ length: 10 }, () =>
      pretzel(priced, 'klein', 'c')
    )
    const total = priceBreakdown(pretzels, priced)
    expect(total.totalCents).toBe(10 * 1000 + 30 * 30)
    expect(total.lines.map((l) => l.index)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
  })

  it('leere Bestellung kostet 0', () => {
    expect(priceBreakdown([], priced)).toEqual({ lines: [], totalCents: 0 })
  })

  it('folgt der Config: anderer Grundpreis, anderer Preis', () => {
    const p = pretzel(config, 'gross', 'butter')
    const base = config.sizes.find((s) => s.id === 'gross')?.basePriceCents
    expect(pretzelPrice(p, 1, config).baseCents).toBe(base)
  })
})

describe('format', () => {
  it('formatiert Euro de-DE', () => {
    expect(nbsp(formatEuro(1990))).toBe('19,90 €')
    expect(nbsp(formatEuro(123456))).toBe('1.234,56 €')
    expect(nbsp(formatEuro(0))).toBe('0,00 €')
  })

  it('formatiert Gramm und Kilogramm', () => {
    expect(formatGrams(900)).toBe('900 g')
    expect(formatGrams(2400)).toBe('2,4 kg')
    expect(formatGrams(1000)).toBe('1 kg')
  })
})
