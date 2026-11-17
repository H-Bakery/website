import { hatLangenText } from './karte'

// Nur erfundene Texte.
describe('hatLangenText', () => {
  it('ja, wenn der lange Text mehr sagt als der Kurztext', () => {
    expect(
      hatLangenText({
        kurztext: 'Ein erfundenes Brot.',
        text: 'Ein erfundenes Brot.\n\nDer Teig ruht lange.',
      })
    ).toBe(true)
  })

  it('nein ohne langen Text', () => {
    expect(hatLangenText({ kurztext: 'Ein erfundenes Brot.', text: '' })).toBe(
      false
    )
    expect(
      hatLangenText({ kurztext: 'Ein erfundenes Brot.', text: '  \n ' })
    ).toBe(false)
  })

  it('nein, wenn er nur den Kurztext wiederholt - auch mit Leerraum am Rand', () => {
    expect(
      hatLangenText({
        kurztext: 'Ein erfundenes Teilchen.',
        text: 'Ein erfundenes Teilchen.',
      })
    ).toBe(false)
    expect(
      hatLangenText({
        kurztext: ' Ein erfundenes Teilchen.',
        text: 'Ein erfundenes Teilchen.\n',
      })
    ).toBe(false)
  })

  it('ja, wenn es nur einen langen Text gibt', () => {
    expect(hatLangenText({ kurztext: '', text: 'Nur ein langer Text.' })).toBe(
      true
    )
  })
})
