import { gruppiereEintraege } from './produktliste'
import { EINTRAEGE } from './testdaten'

describe('gruppiereEintraege', () => {
  it('fasst gleiche Produkte zusammen und behält den ersten Platz', () => {
    const zeilen = gruppiereEintraege(EINTRAEGE)
    expect(zeilen).toHaveLength(4)
    expect(zeilen.find((z) => z.produkt.id === 'testbrot-500g')?.slot).toBe(
      'theke/vitrine/ebene-1/platz-01'
    )
  })

  it('sortiert nach Name, Umlaute deutsch (Ä bei A)', () => {
    expect(gruppiereEintraege(EINTRAEGE).map((z) => z.produkt.name)).toEqual([
      'Äpfeltasche',
      'Probeweck',
      'Testbrot',
      'Zimtkringel',
    ])
  })

  it('lässt die Eingabe unverändert und kommt mit einer leeren Liste klar', () => {
    const vorher = EINTRAEGE.map((e) => e.slot)
    gruppiereEintraege(EINTRAEGE)
    expect(EINTRAEGE.map((e) => e.slot)).toEqual(vorher)
    expect(gruppiereEintraege([])).toEqual([])
  })
})
