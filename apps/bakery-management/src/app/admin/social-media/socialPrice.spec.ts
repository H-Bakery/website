import { formatSocialPrice } from './socialPrice'

describe('formatSocialPrice', () => {
  it('setzt hinter einen Betrag genau ein „ €“', () => {
    expect(formatSocialPrice('3,50')).toBe('3,50 €')
    expect(formatSocialPrice('3.5')).toBe('3,50 €')
    expect(formatSocialPrice('12')).toBe('12 €')
    expect(formatSocialPrice('3,50€')).toBe('3,50 €')
    expect(formatSocialPrice(' 3,50 € ')).toBe('3,50 €')
    expect(formatSocialPrice('€ 2,9')).toBe('2,90 €')
  })

  it('lässt Freitext stehen statt „€“ anzuhängen', () => {
    expect(formatSocialPrice('Sparen Sie 30%')).toBe('Sparen Sie 30%')
    expect(formatSocialPrice('ab 2,50 €')).toBe('ab 2,50 €')
    expect(formatSocialPrice('3 für 2')).toBe('3 für 2')
  })

  it('leer bleibt leer', () => {
    expect(formatSocialPrice('')).toBe('')
    expect(formatSocialPrice('   ')).toBe('')
  })
})
