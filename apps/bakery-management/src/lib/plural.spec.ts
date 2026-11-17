import { plural } from './plural'
import { plural as fromPartnerTypes } from './partnerTypes'

describe('plural', () => {
  it('Einzahl nur bei genau 1', () => {
    expect(plural(1, 'Monat', 'Monate')).toBe('1 Monat')
    expect(plural(0, 'Tag', 'Tage')).toBe('0 Tage')
    expect(plural(2, 'Ruhetag', 'Ruhetage')).toBe('2 Ruhetage')
  })

  it('Zahl im deutschen Format, fehlende Zahl als 0', () => {
    expect(plural(1250, 'Produkt', 'Produkte')).toBe('1.250 Produkte')
    expect(plural(null, 'Besuch', 'Besuche')).toBe('0 Besuche')
    expect(plural(undefined, 'Besuch', 'Besuche')).toBe('0 Besuche')
    expect(plural(Number.NaN, 'Besuch', 'Besuche')).toBe('0 Besuche')
  })

  it('partnerTypes reicht dieselbe Funktion weiter', () => {
    expect(fromPartnerTypes).toBe(plural)
  })
})
