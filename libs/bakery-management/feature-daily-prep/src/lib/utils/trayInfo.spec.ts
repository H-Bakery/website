import { formatTrayInfo, getTrayNumbers } from './trayInfo'

describe('formatTrayInfo', () => {
  it('nennt ein einzelnes Blech', () => {
    expect(formatTrayInfo({ tray_number: 5 })).toBe('Blech 5')
  })

  it('zählt Blech 0 als Angabe', () => {
    expect(formatTrayInfo({ tray_number: 0 })).toBe('Blech 0')
  })

  it('listet mehrere Bleche auch ohne Stückzahl pro Blech', () => {
    expect(formatTrayInfo({ tray_numbers: [11, 12, 13] })).toBe(
      'Bleche 11, 12, 13'
    )
  })

  it('nennt Blechzahl und Stück pro Blech, wenn trays_of gesetzt ist', () => {
    expect(formatTrayInfo({ tray_numbers: [15, 16, 17], trays_of: 12 })).toBe(
      '3 Bleche à 12 (Bleche 15, 16, 17)'
    )
  })

  it('liefert null ohne Blechangabe statt "Blech undefined"', () => {
    expect(formatTrayInfo({})).toBeNull()
    expect(formatTrayInfo({ tray_number: undefined })).toBeNull()
    expect(formatTrayInfo({ tray_numbers: [] })).toBeNull()
    expect(formatTrayInfo({ tray_numbers: [], trays_of: 5 })).toBeNull()
  })

  it('ignoriert NaN und andere Nicht-Zahlen', () => {
    expect(formatTrayInfo({ tray_number: Number.NaN })).toBeNull()
    expect(formatTrayInfo({ tray_numbers: [Number.NaN, 4] })).toBe('Blech 4')
  })

  it('enthält nie "undefined" oder "NaN"', () => {
    const variants = [
      {},
      { tray_number: undefined, tray_numbers: undefined, trays_of: undefined },
      { tray_numbers: [7], trays_of: undefined },
      { tray_numbers: [Number.NaN] },
    ]
    for (const item of variants) {
      const text = formatTrayInfo(item) ?? ''
      expect(text).not.toMatch(/undefined|NaN/)
    }
  })
})

describe('getTrayNumbers', () => {
  it('bevorzugt tray_numbers vor tray_number', () => {
    expect(getTrayNumbers({ tray_number: 1, tray_numbers: [2, 3] })).toEqual([
      2, 3,
    ])
  })

  it('liefert ein leeres Array ohne Angabe', () => {
    expect(getTrayNumbers({})).toEqual([])
  })
})
