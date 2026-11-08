import { formatPriceInput, parsePriceInput } from './priceInput'

describe('Preisfeld der Produktmaske', () => {
  it('zeigt Preise deutsch mit zwei Nachkommastellen', () => {
    expect(formatPriceInput(2.5)).toBe('2,50')
    expect(formatPriceInput(12)).toBe('12,00')
    expect(formatPriceInput(0.45)).toBe('0,45')
    expect(formatPriceInput(null)).toBe('')
  })

  it('liest deutsches Komma - „2,50“ ist 2,50 €, nicht 2 €', () => {
    expect(parsePriceInput('2,50')).toBe(2.5)
    expect(parsePriceInput('2,5')).toBe(2.5)
    expect(parsePriceInput(' 2,50 € ')).toBe(2.5)
    expect(parsePriceInput('1.234,50')).toBe(1234.5)
  })

  it('liest auch den Punkt als Dezimaltrenner', () => {
    expect(parsePriceInput('3.5')).toBe(3.5)
    expect(parsePriceInput('3')).toBe(3)
  })

  it('lehnt ab, was die API ablehnen würde', () => {
    expect(parsePriceInput('')).toBeNull()
    expect(parsePriceInput('abc')).toBeNull()
    expect(parsePriceInput('-1')).toBeNull()
    expect(parsePriceInput('2,505')).toBeNull()
    expect(parsePriceInput('1.234')).toBeNull()
    expect(parsePriceInput('10000,01')).toBeNull()
    expect(parsePriceInput('2,5,0')).toBeNull()
  })
})
