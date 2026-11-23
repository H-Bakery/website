import { metadata } from './layout'
import { getCompactHoursSummary } from '../../utils/openingHours'

describe('Bestellen layout metadata', () => {
  it('leitet die Bestellzeiten in der Description aus der Konfiguration ab', () => {
    const description = metadata.description as string

    expect(description).toContain(
      `während unserer Öffnungszeiten: ${getCompactHoursSummary()}.`
    )
    expect(description).toContain('per WhatsApp mit dem Warenkorb')
    expect(description).not.toMatch(/täglich|14:00/)
  })
})
