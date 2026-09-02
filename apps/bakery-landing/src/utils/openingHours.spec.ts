import { DAY_NAMES } from '../config/openingHours'
import {
  getContactPageHours,
  getFooterHours,
  getMapDisplayHours,
  getSeoOpeningHours,
} from './openingHours'

describe('getMapDisplayHours', () => {
  it('benennt den Sonntag nur mit "So" – ohne Feiertagsanspruch', () => {
    const sunday = getMapDisplayHours().find((row) =>
      row.label.split(', ').includes(DAY_NAMES.deAbbrev.sunday)
    )

    expect(sunday).toBeDefined()
    expect(sunday!.label).toBe('So')
    expect(sunday!.value).toBe('8:00 - 11:00 Uhr')
  })

  it('listet jeden Tag einer Gruppe einzeln auf', () => {
    const rows = getMapDisplayHours()

    expect(rows.map((row) => row.label)).toEqual([
      'Mo',
      'Di, Mi, Do, Fr',
      'Sa',
      'So',
    ])
    expect(rows[0].value).toBe('Geschlossen')
    expect(rows[1].value).toBe('5:30 - 13:30 Uhr')
  })

  it('zeigt dieselben Zeiten wie die Fußzeile', () => {
    // Karte und Fußzeile speisen sich aus derselben Konfiguration und dürfen
    // nicht auseinanderlaufen – nur das Label-Format unterscheidet sich.
    const map = getMapDisplayHours()
    const footer = getFooterHours()

    expect(map.map((row) => row.value)).toEqual(footer.map((row) => row.value))
  })
})

describe('Feiertage', () => {
  it('werden in keiner Darstellung der Öffnungszeiten behauptet', () => {
    // Die Konfiguration kennt keine Feiertage. Der Hinweis auf der
    // Kontaktseite ("mögliche Änderungen an Feiertagen") ist die einzige
    // Aussage dazu; keine Ableitung aus OPENING_HOURS darf ihr widersprechen.
    const labels = [
      ...getMapDisplayHours().map((row) => row.label),
      ...getFooterHours().map((row) => row.label),
      ...getContactPageHours().map((row) => row.day),
    ]

    expect(labels.filter((label) => /feiertag/i.test(label))).toEqual([])
    expect(JSON.stringify(getSeoOpeningHours())).not.toMatch(/holiday/i)
  })
})
