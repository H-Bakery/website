import { defaultBackstubeTab } from './backstubeTab'
import {
  saturdayConfirmed,
  saturdayDraft,
  saturdayV2Draft,
  sundayV2Sheet,
  SAT,
} from './backzettelFixtures'

describe('defaultBackstubeTab (Z10)', () => {
  it('bleibt beim Zettel, solange nichts geladen ist oder der Tag keiner ist', () => {
    expect(defaultBackstubeTab(null)).toBe('zettel')
    expect(defaultBackstubeTab(undefined)).toBe('zettel')
    expect(
      defaultBackstubeTab({
        date: SAT,
        status: 'ruhetag',
        message: 'Ruhetag',
      } as never)
    ).toBe('zettel')
    expect(
      defaultBackstubeTab({ date: SAT, status: 'no-config', reasons: [] })
    ).toBe('zettel')
  })

  it('Tage von vor Z10 sind immer Teigtag = Backtag: Zettel', () => {
    expect(defaultBackstubeTab(saturdayDraft())).toBe('zettel')
    expect(defaultBackstubeTab(saturdayConfirmed())).toBe('zettel')
    // auch leer - ein alter Zettel hat keine Backliste
    expect(defaultBackstubeTab(saturdayDraft({ sections: [] }))).toBe('zettel')
  })

  it('Teigtag mit Zeilen: Zettel', () => {
    expect(defaultBackstubeTab(saturdayV2Draft())).toBe('zettel')
  })

  it('kein Teigtag oder leerer Zettel: Backen', () => {
    expect(defaultBackstubeTab(sundayV2Sheet())).toBe('backen')
    expect(
      defaultBackstubeTab(sundayV2Sheet({ isDoughDay: true, sections: [] }))
    ).toBe('backen')
    expect(
      defaultBackstubeTab(
        saturdayV2Draft({
          sections: [{ id: 'brot', label: 'Brot', lines: [] }],
        })
      )
    ).toBe('backen')
  })
})
