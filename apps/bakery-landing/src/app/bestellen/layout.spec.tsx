import { metadata } from './layout'
import { getCompactHoursSummary } from '../../utils/openingHours'

describe('Bestellen layout metadata', () => {
  it('leitet die Bestellzeiten in der Description aus der Konfiguration ab', () => {
    const description = metadata.description as string

    expect(description).toContain(
      `während unserer Öffnungszeiten: ${getCompactHoursSummary()}.`
    )
    expect(description).toContain('06841 2229')
    expect(description).toContain('0170 6133279')
    expect(description).not.toMatch(/täglich|14:00/)
  })
})
