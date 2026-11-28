import type { Raum } from '../../config/raeume'
import { raumAusAdresse, sucheFuerRaum } from './adresse'

const raum = (id: string): Raum => ({
  id,
  name: id,
  wechsel: `Nach ${id}`,
  modell: `${id}.glb`,
  fuellung: 'morgens',
  produkte: false,
  start: 'a',
  blickpunkte: [],
})
const LADEN = raum('laden')
const WERKSTATT = raum('werkstatt')
const RAEUME = [LADEN, WERKSTATT]

describe('raumAusAdresse', () => {
  it('ohne Parameter: der Start-Raum', () => {
    expect(raumAusAdresse('', RAEUME, 'laden')).toBe(LADEN)
    expect(raumAusAdresse('?debug&intro=0', RAEUME, 'laden')).toBe(LADEN)
  })

  it('?raum=<id> wählt einen verfügbaren Raum', () => {
    expect(raumAusAdresse('?raum=werkstatt', RAEUME, 'laden')).toBe(WERKSTATT)
    expect(raumAusAdresse('?debug&raum=werkstatt', RAEUME, 'laden')).toBe(
      WERKSTATT
    )
    expect(raumAusAdresse('?raum=laden', RAEUME, 'laden')).toBe(LADEN)
  })

  it('ein unbekannter oder nicht gebauter Raum landet im Start-Raum', () => {
    expect(raumAusAdresse('?raum=keller', RAEUME, 'laden')).toBe(LADEN)
    expect(raumAusAdresse('?raum=', RAEUME, 'laden')).toBe(LADEN)
    expect(raumAusAdresse('?raum=toString', RAEUME, 'laden')).toBe(LADEN)
    // Die Werkstatt steht in der Konfiguration, ist aber nicht gebaut.
    expect(raumAusAdresse('?raum=werkstatt', [LADEN], 'laden')).toBe(LADEN)
  })

  it('gibt es den Start-Raum nicht, gilt der erste; ohne Räume keiner', () => {
    expect(raumAusAdresse('', [WERKSTATT], 'laden')).toBe(WERKSTATT)
    expect(raumAusAdresse('?raum=x', [], 'laden')).toBeUndefined()
  })
})

describe('sucheFuerRaum', () => {
  it('setzt den Raum und lässt andere Parameter stehen', () => {
    expect(sucheFuerRaum('', 'werkstatt', 'laden')).toBe('?raum=werkstatt')
    expect(sucheFuerRaum('?debug&intro=0', 'werkstatt', 'laden')).toBe(
      '?debug&intro=0&raum=werkstatt'
    )
    expect(sucheFuerRaum('?raum=keller&debug', 'werkstatt', 'laden')).toBe(
      '?raum=werkstatt&debug'
    )
  })

  it('der Start-Raum steht ohne Parameter da', () => {
    expect(sucheFuerRaum('?raum=werkstatt', 'laden', 'laden')).toBe('')
    expect(
      sucheFuerRaum('?debug&raum=werkstatt&intro=0', 'laden', 'laden')
    ).toBe('?debug&intro=0')
    expect(sucheFuerRaum('', 'laden', 'laden')).toBe('')
  })

  it('hin und zurück: Die Adresse eines Raums führt wieder in ihn', () => {
    for (const r of RAEUME) {
      expect(
        raumAusAdresse(sucheFuerRaum('?debug', r.id, 'laden'), RAEUME, 'laden')
      ).toBe(r)
    }
  })
})
